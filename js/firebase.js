// Firebase Configuration - Now uses environment-based config
// Make sure config.js is loaded before this file
const firebaseConfig = window.APP_CONFIG?.firebase || {
  // Fallback config for development only
  apiKey: "AIzaSyDlft-Nu_j_ykeu_5KZ6DRN048pLL6lPEY",
  authDomain: "ai-gym-tracker-60a9a.firebaseapp.com",
  projectId: "ai-gym-tracker-60a9a",
  storageBucket: "ai-gym-tracker-60a9a.appspot.com",
  messagingSenderId: "906850891354",
  appId: "1:906850891354:web:24768d080b097a9ede8a63",
  measurementId: "G-8GZBVTL0YG"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
