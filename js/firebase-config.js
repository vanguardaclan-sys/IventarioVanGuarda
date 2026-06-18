// ============================================
// FIREBASE CONFIGURATION — inventariovanguarda
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyDHWdLGFIHTprE8U_ZbO5AQnB0NUf3OH34",
  authDomain: "inventariovanguarda.firebaseapp.com",
  projectId: "inventariovanguarda",
  storageBucket: "inventariovanguarda.firebasestorage.app",
  messagingSenderId: "562276823208",
  appId: "1:562276823208:web:a3e99a174e0018a9e1d29d"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
