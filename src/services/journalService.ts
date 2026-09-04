import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, isLiveFirestoreReady, handleFirestoreError, OperationType } from './firebase';
import { JournalEntry } from '../types';

// Strict Partition path helper
export function getUserJournalsCollectionPath(userId: string): string {
  if (!userId) throw new Error('Security Error: userId is required for partitioned storage.');
  return `users/${userId}/journals`;
}

// Sandbox local storage partitioning simulation for dev preview
function getSandboxStorageKey(userId: string): string {
  return `pgj_partition_users_${userId}_journals`;
}

function loadSandboxEntries(userId: string): JournalEntry[] {
  try {
    const raw = localStorage.getItem(getSandboxStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistSandboxEntries(userId: string, entries: JournalEntry[]): void {
  try {
    localStorage.setItem(getSandboxStorageKey(userId), JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to persist sandbox entries:', err);
  }
}

// Event emitter pattern for sandbox real-time updates
const sandboxListeners: Map<string, Set<(entries: JournalEntry[]) => void>> = new Map();

function notifySandboxListeners(userId: string) {
  const listeners = sandboxListeners.get(userId);
  if (listeners) {
    const entries = loadSandboxEntries(userId);
    listeners.forEach((cb) => cb(entries));
  }
}

/**
 * Subscribes to real-time updates of the user's isolated journal entries.
 * Strictly queries within users/{userId}/journals
 */
export function subscribeToJournals(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // Register for local partition updates so local writes trigger reactive re-renders
  if (!sandboxListeners.has(userId)) {
    sandboxListeners.set(userId, new Set());
  }
  const set = sandboxListeners.get(userId)!;
  set.add(onUpdate);

  // Immediately emit current local partition cache so the user sees their notes instantly
  const cachedEntries = loadSandboxEntries(userId);
  if (cachedEntries.length > 0) {
    onUpdate(cachedEntries);
  }

  let firestoreUnsubscribe: (() => void) | null = null;

  if (isLiveFirestoreReady(userId) && db) {
    try {
      // Path: users/{userId}/journals
      const journalsRef = collection(db, 'users', userId, 'journals');
      const q = query(journalsRef, orderBy('updatedAt', 'desc'));

      firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const entries: JournalEntry[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            entries.push({
              id: docSnap.id,
              userId: data.userId || userId,
              title: data.title || 'Untitled Entry',
              content: data.content || '',
              mood: data.mood || 'reflective',
              tags: Array.isArray(data.tags) ? data.tags : [],
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
              chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
              summary: data.summary || undefined,
              pinned: Boolean(data.pinned),
              wordCount: data.wordCount || 0,
            });
          });
          // Cache live cloud entries to local partition
          persistSandboxEntries(userId, entries);
          onUpdate(entries);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/journals`);
          // Fall back gracefully to local partition
          const fallback = loadSandboxEntries(userId);
          onUpdate(fallback);
          if (onError) onError(err);
        }
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/journals`);
      const fallback = loadSandboxEntries(userId);
      onUpdate(fallback);
      if (onError) onError(err);
    }
  } else {
    onUpdate(cachedEntries);
  }

  return () => {
    set.delete(onUpdate);
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

/**
 * Saves or updates a journal entry in users/{userId}/journals/{journalId}
 * Enforces ownership boundary: entry.userId must match authenticated userId
 * Always mirrors to user local partition to guarantee zero data loss.
 */
export async function saveJournal(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) {
    throw new Error('Authentication Boundary Violation: Cannot save journal without authenticated user ID.');
  }

  if (entry.userId !== userId) {
    throw new Error('Data Isolation Violation: Entry user ID does not match authenticated session partition.');
  }

  const sanitizedEntry: JournalEntry = {
    ...entry,
    userId,
    updatedAt: Date.now(),
    wordCount: entry.content ? entry.content.trim().split(/\s+/).filter(Boolean).length : 0,
  };

  // 1. Immediately mirror to user-isolated local partition (Zero Data Loss guarantee)
  const current = loadSandboxEntries(userId);
  const existingIdx = current.findIndex((item) => item.id === entry.id);
  if (existingIdx >= 0) {
    current[existingIdx] = sanitizedEntry;
  } else {
    current.unshift(sanitizedEntry);
  }
  persistSandboxEntries(userId, current);
  notifySandboxListeners(userId);

  // 2. Attempt remote sync to Cloud Firestore
  if (isLiveFirestoreReady(userId) && db) {
    try {
      const docRef = doc(db, 'users', userId, 'journals', entry.id);
      await setDoc(docRef, {
        ...sanitizedEntry,
        createdAt: Timestamp.fromMillis(sanitizedEntry.createdAt || Date.now()),
        updatedAt: Timestamp.fromMillis(sanitizedEntry.updatedAt),
      }, { merge: true });
      return;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/journals/${entry.id}`);
      // Entry is safely saved in local partition. We return gracefully so auto-save loop continues.
      return;
    }
  }
}

/**
 * Deletes a journal entry from users/{userId}/journals/{journalId}
 */
export async function deleteJournal(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) {
    throw new Error('Missing parameter for deletion.');
  }

  // 1. Remove from local partition
  const current = loadSandboxEntries(userId);
  const filtered = current.filter((item) => item.id !== entryId);
  persistSandboxEntries(userId, filtered);
  notifySandboxListeners(userId);

  // 2. Attempt Cloud Firestore deletion
  if (isLiveFirestoreReady(userId) && db) {
    try {
      const docRef = doc(db, 'users', userId, 'journals', entryId);
      await deleteDoc(docRef);
      return;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}/journals/${entryId}`);
      return;
    }
  }
}

/**
 * Syncs any locally-saved entries to Cloud Firestore once security rules are deployed
 */
export async function syncLocalEntriesToFirestore(userId: string): Promise<number> {
  if (!isLiveFirestoreReady(userId) || !db) return 0;
  const localEntries = loadSandboxEntries(userId);
  if (localEntries.length === 0) return 0;

  let synced = 0;
  for (const entry of localEntries) {
    try {
      const docRef = doc(db, 'users', userId, 'journals', entry.id);
      await setDoc(docRef, {
        ...entry,
        createdAt: Timestamp.fromMillis(entry.createdAt || Date.now()),
        updatedAt: Timestamp.fromMillis(entry.updatedAt || Date.now()),
      }, { merge: true });
      synced++;
    } catch (err) {
      console.warn(`Sync skipped for ${entry.id}:`, err);
      break;
    }
  }
  return synced;
}
