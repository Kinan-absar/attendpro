
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCyfBxORQy_csaM8QF0XPLe6QULz_YMZu0",
  authDomain: "attendance-pro-a9257.firebaseapp.com",
  projectId: "attendance-pro-a9257",
  storageBucket: "attendance-pro-a9257.firebasestorage.app",
  messagingSenderId: "77825011533",
  appId: "1:77825011533:web:5f2e37c4e1ff53302f5104",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ THESE TWO EXPORTS ARE REQUIRED
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

