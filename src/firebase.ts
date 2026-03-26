
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCV-asxgaex9hs84DSn7cYpDTanUPMlg3M",
  authDomain: "airesumeanalyse.firebaseapp.com",
  projectId: "airesumeanalyse",
  storageBucket: "airesumeanalyse.firebasestorage.app",
  messagingSenderId: "653838936950",
  appId: "1:653838936950:web:b02fc3f7df26b1ab42a857",
  measurementId: "G-DKKHM67SQF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
