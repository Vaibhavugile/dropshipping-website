// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
  apiKey: "AIzaSyC0Zz1pLewzfFf88oCYLmWvE1YPBkbIwbA",
  authDomain: "multistore-46e9f.firebaseapp.com",
  projectId: "multistore-46e9f",
  storageBucket: "multistore-46e9f.firebasestorage.app",
  messagingSenderId: "505080290162",
  appId: "1:505080290162:web:7234ef577b7c1e938e1beb",
  measurementId: "G-5WSX7H9Z9B"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
// src/firebase.js
export const functions = getFunctions(app, "us-central1");

export default app;
