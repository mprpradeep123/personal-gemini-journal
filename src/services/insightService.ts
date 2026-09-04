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
import { WeeklyInsightReport } from '../types';

// Sandbox local storage partitioning simulation for dev preview
function getSandboxInsightsStorageKey(userId: string): string {
  return `pgj_partition_users_${userId}_insights`;
}

function loadSandboxInsights(userId: string): WeeklyInsightReport[] {
  try {
    const raw = localStorage.getItem(getSandboxInsightsStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistSandboxInsights(userId: string, reports: WeeklyInsightReport[]): void {
  try {
    localStorage.setItem(getSandboxInsightsStorageKey(userId), JSON.stringify(reports));
  } catch (err) {
    console.error('Failed to persist sandbox insights:', err);
  }
}

const sandboxInsightListeners: Map<string, Set<(reports: WeeklyInsightReport[]) => void>> = new Map();

function notifySandboxInsightListeners(userId: string) {
  const listeners = sandboxInsightListeners.get(userId);
  if (listeners) {
    const reports = loadSandboxInsights(userId);
    listeners.forEach((cb) => cb(reports));
  }
}

/**
 * Subscribes to real-time updates of the user's isolated weekly insight reports.
 * Strictly queries within users/{userId}/insights
 */
export function subscribeToWeeklyInsights(
  userId: string,
  onUpdate: (reports: WeeklyInsightReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // Register local listeners
  if (!sandboxInsightListeners.has(userId)) {
    sandboxInsightListeners.set(userId, new Set());
  }
  const set = sandboxInsightListeners.get(userId)!;
  set.add(onUpdate);

  // Immediately emit cached local insights
  const initial = loadSandboxInsights(userId);
  if (initial.length > 0) {
    onUpdate(initial);
  }

  let firestoreUnsubscribe: (() => void) | null = null;

  if (isLiveFirestoreReady(userId) && db) {
    try {
      const insightsRef = collection(db, 'users', userId, 'insights');
      const q = query(insightsRef, orderBy('generatedAt', 'desc'));

      firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const reports: WeeklyInsightReport[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            reports.push({
              id: docSnap.id,
              userId: data.userId || userId,
              generatedAt: data.generatedAt?.toMillis ? data.generatedAt.toMillis() : (data.generatedAt || Date.now()),
              periodLabel: data.periodLabel || 'Weekly Reflection',
              startDate: data.startDate?.toMillis ? data.startDate.toMillis() : (data.startDate || 0),
              endDate: data.endDate?.toMillis ? data.endDate.toMillis() : (data.endDate || Date.now()),
              totalEntriesAnalyzed: data.totalEntriesAnalyzed || 0,
              totalWordsAnalyzed: data.totalWordsAnalyzed || 0,
              dominantMood: data.dominantMood || 'reflective',
              emotionalTrajectory: data.emotionalTrajectory || '',
              moodDistribution: Array.isArray(data.moodDistribution) ? data.moodDistribution : [],
              dailyMoodTrend: Array.isArray(data.dailyMoodTrend) ? data.dailyMoodTrend : [],
              keyThemes: Array.isArray(data.keyThemes) ? data.keyThemes : [],
              recurringPatterns: Array.isArray(data.recurringPatterns) ? data.recurringPatterns : [],
              mindsetHighlights: data.mindsetHighlights || {
                strengthsNoticed: [],
                potentialBlindspots: [],
                positiveShifts: '',
              },
              actionableTakeaways: Array.isArray(data.actionableTakeaways) ? data.actionableTakeaways : [],
              synthesisNarrative: data.synthesisNarrative || '',
            });
          });
          // Cache to local partition
          persistSandboxInsights(userId, reports);
          onUpdate(reports);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, `users/${userId}/insights`);
          // Fall back gracefully to local partition
          const fallback = loadSandboxInsights(userId);
          onUpdate(fallback);
          if (onError) onError(err);
        }
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/insights`);
      const fallback = loadSandboxInsights(userId);
      onUpdate(fallback);
      if (onError) onError(err);
    }
  } else {
    onUpdate(initial);
  }

  return () => {
    set.delete(onUpdate);
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

/**
 * Saves a weekly insight report in users/{userId}/insights/{reportId}
 * Enforces ownership boundary: report.userId must match authenticated userId
 */
export async function saveWeeklyInsight(userId: string, report: WeeklyInsightReport): Promise<void> {
  if (!userId) {
    throw new Error('Authentication Boundary Violation: Cannot save insight without authenticated user ID.');
  }

  if (report.userId !== userId) {
    throw new Error('Data Isolation Violation: Report user ID does not match authenticated session partition.');
  }

  const sanitized: WeeklyInsightReport = {
    ...report,
    userId,
    generatedAt: report.generatedAt || Date.now(),
  };

  // 1. Immediately mirror to user-isolated local partition
  const current = loadSandboxInsights(userId);
  const existingIdx = current.findIndex((item) => item.id === report.id);
  if (existingIdx >= 0) {
    current[existingIdx] = sanitized;
  } else {
    current.unshift(sanitized);
  }
  persistSandboxInsights(userId, current);
  notifySandboxInsightListeners(userId);

  // 2. Attempt remote sync to Cloud Firestore
  if (isLiveFirestoreReady(userId) && db) {
    try {
      const docRef = doc(db, 'users', userId, 'insights', report.id);
      await setDoc(docRef, {
        ...sanitized,
        generatedAt: Timestamp.fromMillis(sanitized.generatedAt),
        startDate: Timestamp.fromMillis(sanitized.startDate),
        endDate: Timestamp.fromMillis(sanitized.endDate),
      }, { merge: true });
      return;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/insights/${report.id}`);
      return;
    }
  }
}

/**
 * Updates the completion state of a takeaway goal within a saved report
 */
export async function toggleTakeawayCompletion(
  userId: string,
  report: WeeklyInsightReport,
  takeawayId: string
): Promise<WeeklyInsightReport> {
  const updatedTakeaways = report.actionableTakeaways.map((item) =>
    item.id === takeawayId ? { ...item, completed: !item.completed } : item
  );

  const updatedReport: WeeklyInsightReport = {
    ...report,
    actionableTakeaways: updatedTakeaways,
  };

  await saveWeeklyInsight(userId, updatedReport);
  return updatedReport;
}

/**
 * Deletes a weekly insight report from users/{userId}/insights/{reportId}
 */
export async function deleteWeeklyInsight(userId: string, reportId: string): Promise<void> {
  if (!userId || !reportId) {
    throw new Error('Missing parameter for insight deletion.');
  }

  // 1. Delete from local partition
  const current = loadSandboxInsights(userId);
  const filtered = current.filter((item) => item.id !== reportId);
  persistSandboxInsights(userId, filtered);
  notifySandboxInsightListeners(userId);

  // 2. Attempt Cloud Firestore delete
  if (isLiveFirestoreReady(userId) && db) {
    try {
      const docRef = doc(db, 'users', userId, 'insights', reportId);
      await deleteDoc(docRef);
      return;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}/insights/${reportId}`);
      return;
    }
  }
}
