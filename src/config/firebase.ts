// Firebase Configuration for Bhavishya Road Carrier
// Replace with your actual Firebase project credentials

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2lZdJNVDr0q1EjCtJG-Qd4L9dBXKjYVg",
  authDomain: "bhavishya-road-carriers.firebaseapp.com",
  projectId: "bhavishya-road-carriers",
  storageBucket: "bhavishya-road-carriers.firebasestorage.app",
  messagingSenderId: "293845698413",
  appId: "1:293845698413:web:ac5e36b2f141dc5300bc64",
  measurementId: "G-PGV583R364"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

// Environment-based configuration
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "your-api-key-here";
};

// Demo mode fallback
export const isDemoMode = () => {
  return !isFirebaseConfigured();
};
