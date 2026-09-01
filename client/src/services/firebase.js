import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBDlGDIS9WTjPg8QMcqaOnTWtMXUx12AkA",
  authDomain: "attendance-portal-5f2a0.firebaseapp.com",
  projectId: "attendance-portal-5f2a0",
  storageBucket: "attendance-portal-5f2a0.firebasestorage.app",
  messagingSenderId: "314729509046",
  appId: "1:314729509046:web:4eba316efe12dc18043617",
  measurementId: "G-EE1QX4ETRF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
