// ─────────────────────────────────────────────────────────────
//  FINB Platinum — Firebase bootstrap
//  Web client config is public by design; security lives in
//  firestore.rules (deploy with Firebase CLI).
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyB0URNB2fpwM9FOwVbX7zjtbXr6uRgnKqI',
  authDomain: 'finbplatinum.firebaseapp.com',
  projectId: 'finbplatinum',
  storageBucket: 'finbplatinum.firebasestorage.app',
  messagingSenderId: '829316154126',
  appId: '1:829316154126:web:ea7d699340a0552df88d5f',
  measurementId: 'G-JCHHHJEQ2C',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Usernames are unique handles like "elonmusk_tesla12". Firebase Auth only
// speaks emails, so we map username <-> a synthetic, hidden email address.
export const usernameEmail = (u) => `${u}@users.finbplatinum.game`;

export function validUsername(u) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

export async function signUp({ username, name, password }) {
  const u = username.trim().toLowerCase();
  if (!validUsername(u)) {
    throw new Error('Username must be 3–20 chars: lowercase letters, numbers or _');
  }
  if (!name.trim()) throw new Error('Please enter your name.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const cred = await createUserWithEmailAndPassword(auth, usernameEmail(u), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  return cred.user;
}

export async function signIn({ username, password }) {
  const u = username.trim().toLowerCase().replace(/^@/, '');
  await signInWithEmailAndPassword(auth, usernameEmail(u), password);
}

export async function signInWithGoogle() {
  const r = await signInWithPopup(auth, googleProvider);
  return r.user;
}

export async function linkGoogleAccount(user) {
  // Links a Google identity to a password account so we can grant the
  // one-time 100-credit welcome bonus.
  const r = await linkWithPopup(user, googleProvider);
  return r.user;
}

export async function signOut() {
  await fbSignOut(auth);
}
