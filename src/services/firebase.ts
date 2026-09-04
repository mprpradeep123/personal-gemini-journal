import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { UserProfile } from '../types';

export interface FirebaseConfigParams {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// Retrieve config from Vite environment variables or local developer configuration
export function getFirebaseConfig(): FirebaseConfigParams | null {
  const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envKey && envProject && envKey !== '' && !envKey.startsWith('MY_')) {
    return {
      apiKey: envKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
      projectId: envProject,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProject}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  // Check if user manually saved credentials in local storage for preview testing
  const storedConfig = localStorage.getItem('pgj_custom_firebase_config');
  if (storedConfig) {
    try {
      const parsed = JSON.parse(storedConfig);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function saveCustomFirebaseConfig(config: FirebaseConfigParams | null): void {
  if (!config) {
    localStorage.removeItem('pgj_custom_firebase_config');
  } else {
    localStorage.setItem('pgj_custom_firebase_config', JSON.stringify(config));
  }
  // Reload to re-initialize SDK cleanly
  window.location.reload();
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

const config = getFirebaseConfig();

if (config) {
  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

export { app, auth, db };

export const isFirebaseConfigured = (): boolean => {
  return Boolean(app && auth && db);
};

// Validates that both the Firebase SDK is configured AND a real user session is actively authenticated
export const isLiveFirestoreReady = (userId?: string): boolean => {
  if (!app || !auth || !db) return false;
  if (!auth.currentUser) return false;
  if (userId && auth.currentUser.uid !== userId) return false;
  return true;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  if (anyErr.code === 'permission-denied') return true;
  const msg = typeof anyErr.message === 'string' ? anyErr.message : String(anyErr);
  return (
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('insufficient permissions') ||
    msg.includes('permission-denied')
  );
}

export interface FirestoreRulesInfo {
  projectId: string;
  rulesConsoleUrl: string;
  rulesContent: string;
}

export function getFirestoreRulesInfo(): FirestoreRulesInfo {
  const config = getFirebaseConfig();
  const projectId = config?.projectId || 'pradeep-test-507608';
  return {
    projectId,
    rulesConsoleUrl: `https://console.firebase.google.com/project/${projectId}/firestore/rules`,
    rulesContent: `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /users/{userId} {\n      allow read, write: if request.auth != null && request.auth.uid == userId;\n\n      match /journals/{journalId} {\n        allow read, write: if request.auth != null && request.auth.uid == userId;\n      }\n\n      match /insights/{insightId} {\n        allow read, write: if request.auth != null && request.auth.uid == userId;\n      }\n\n      match /{subcollection=**} {\n        allow read, write: if request.auth != null && request.auth.uid == userId;\n      }\n    }\n  }\n}`,
  };
}

// Global permission error listeners
type PermissionListener = (isPermissionDenied: boolean) => void;
const permissionListeners: Set<PermissionListener> = new Set();
let globalPermissionDenied = false;

export function hasFirestorePermissionError(): boolean {
  return globalPermissionDenied;
}

export function setFirestorePermissionState(denied: boolean): void {
  if (globalPermissionDenied !== denied) {
    globalPermissionDenied = denied;
    permissionListeners.forEach((l) => l(denied));
  }
}

export function subscribeToFirestorePermissionChanges(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  listener(globalPermissionDenied);
  return () => {
    permissionListeners.delete(listener);
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  if (isPermissionDeniedError(error)) {
    setFirestorePermissionState(true);
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

export async function testAndVerifyFirestoreConnection(userId: string): Promise<boolean> {
  if (!isLiveFirestoreReady(userId) || !db) return false;
  try {
    const { doc, setDoc, deleteDoc, Timestamp } = await import('firebase/firestore');
    const testDocRef = doc(db, 'users', userId, 'test_connection', 'probe');
    await setDoc(testDocRef, { timestamp: Timestamp.now() }, { merge: true });
    await deleteDoc(testDocRef);
    setFirestorePermissionState(false);
    return true;
  } catch (err: any) {
    if (isPermissionDeniedError(err)) {
      setFirestorePermissionState(true);
    }
    return false;
  }
}

export interface AuthDomainInfo {
  currentHostname: string;
  projectId: string;
  isAuthorizedDomainCandidate: boolean;
  consoleUrl: string;
}

export function getAuthDomainInfo(): AuthDomainInfo {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const config = getFirebaseConfig();
  const projectId = config?.projectId || 'pradeep-test-507608';
  return {
    currentHostname,
    projectId,
    isAuthorizedDomainCandidate: Boolean(currentHostname && !['localhost', '127.0.0.1'].includes(currentHostname)),
    consoleUrl: `https://console.firebase.google.com/project/${projectId}/authentication/settings`,
  };
}

export class UnauthorizedDomainError extends Error {
  readonly domain: string;
  readonly projectId: string;
  readonly consoleUrl: string;

  constructor(domain: string, projectId: string) {
    super(`Firebase Auth Error: Domain '${domain}' is not authorized in Firebase project '${projectId}'.`);
    this.name = 'UnauthorizedDomainError';
    this.domain = domain;
    this.projectId = projectId;
    this.consoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
  }
}

// Sandbox session storage key for local development preview before cloud credentials are setup
const DEMO_USER_STORAGE_KEY = 'pgj_sandbox_user';

export function signInWithDemoUser(customName?: string): UserProfile {
  let existingUid = localStorage.getItem('pgj_demo_uid');
  if (!existingUid) {
    existingUid = 'demo_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pgj_demo_uid', existingUid);
  }
  const mockUser: UserProfile = {
    uid: existingUid,
    email: 'mindful.journaler@example.com',
    displayName: customName || 'Mindful Journaler (Demo)',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isDemo: true,
  };
  localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(mockUser));
  return mockUser;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (auth) {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Clear sandbox demo user if signed in with real account
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isDemo: false,
      };
    } catch (err: any) {
      if (
        err?.code === 'auth/unauthorized-domain' ||
        (typeof err?.message === 'string' && err.message.includes('auth/unauthorized-domain'))
      ) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : '';
        const config = getFirebaseConfig();
        const projectId = config?.projectId || 'pradeep-test-507608';
        throw new UnauthorizedDomainError(domain, projectId);
      }
      throw err;
    }
  } else {
    // Fallback sandbox authentication if live credentials are not configured
    return signInWithDemoUser();
  }
}

export async function signOutUser(): Promise<void> {
  localStorage.removeItem(DEMO_USER_STORAGE_KEY);
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
  }
}

export async function getCurrentUserToken(currentUser: UserProfile | null): Promise<string> {
  if (!currentUser) return '';
  if (auth && auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(true);
    } catch {
      return `firebase-client-token-${currentUser.uid}`;
    }
  }
  return `sandbox-bearer-token-${currentUser.uid}`;
}

export function subscribeToAuthChanges(callback: (user: UserProfile | null) => void): () => void {
  if (auth) {
    return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isDemo: false,
        });
      } else {
        // If not signed in via Firebase, check if user launched a demo session
        const saved = localStorage.getItem(DEMO_USER_STORAGE_KEY);
        if (saved) {
          try {
            callback(JSON.parse(saved));
            return;
          } catch {
            // ignore
          }
        }
        callback(null);
      }
    });
  } else {
    // Check sandbox user
    const saved = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (saved) {
      try {
        callback(JSON.parse(saved));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
    return () => {};
  }
}
