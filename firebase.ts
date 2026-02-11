
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyfBxORQy_csaM8QF0XPLe6QULz_YMZu0",
  authDomain: "attendance-pro-a9257.firebaseapp.com",
  projectId: "attendance-pro-a9257",
  storageBucket: "attendance-pro-a9257.firebasestorage.app",
  messagingSenderId: "77825011533",
  appId: "1:77825011533:web:5f2e37c4e1ff53302f5104",
  measurementId: "G-2Q9N9KBLX9"
};

// Initialize Firebase with modular SDK
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
