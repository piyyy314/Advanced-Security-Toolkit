import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, type Auth } from 'firebase/auth';

const firebaseConfigModules = import.meta.glob('../../firebase-applet-config.json', { eager: true }) as Record<
  string,
  { default?: FirebaseOptions } & FirebaseOptions
>;
const firstConfigModule = Object.values(firebaseConfigModules)[0];
const resolvedConfig: FirebaseOptions | null = firstConfigModule
  ? (firstConfigModule.default ?? firstConfigModule)
  : null;
const hasValidFirebaseConfig = Boolean(resolvedConfig && resolvedConfig.apiKey && resolvedConfig.projectId);

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts'
];

let firebaseAuthInstance: Auth | null = null;
if (hasValidFirebaseConfig && resolvedConfig) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(resolvedConfig);
    firebaseAuthInstance = getAuth(app);
  } catch (err) {
    console.warn('Firebase Drive Vault initialization skipped:', err);
    firebaseAuthInstance = null;
  }
}

export const auth: Auth | null = firebaseAuthInstance;

export const isDriveConfigured = (): boolean => Boolean(firebaseAuthInstance);

const provider = new GoogleAuthProvider();
GOOGLE_DRIVE_SCOPES.forEach(scope => {
  provider.addScope(scope);
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!firebaseAuthInstance) {
    cachedAccessToken = null;
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(firebaseAuthInstance, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we don't have token cached in memory, prompt user to connect/sign in to refresh OAuth credentials
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!firebaseAuthInstance) {
    throw new Error('Google Drive Vault requires firebase-applet-config.json (Firebase & OAuth setup not configured).');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuthInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive OAuth access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  if (!firebaseAuthInstance) return;
  await signOut(firebaseAuthInstance);
};
