import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCAy9JPvV3v7J8mhqa7K1cotTWebmURgtI",
  authDomain: "schoolspace-53f0d.firebaseapp.com",
  projectId: "schoolspace-53f0d",
  storageBucket: "schoolspace-53f0d.firebasestorage.app",
  messagingSenderId: "832888496203",
  appId: "1:832888496203:web:237bc6c641b72b2886edce",
  measurementId: "G-83DE80YW9R"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
