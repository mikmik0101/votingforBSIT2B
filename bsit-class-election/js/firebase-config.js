/* ============================================================
   FIREBASE CONFIGURATION
   ============================================================
   1. Go to https://console.firebase.google.com
   2. Create a new project (or use an existing one)
   3. Click "Add app" -> Web app (</>)
   4. Copy the config object Firebase gives you and paste the
      values below, replacing the placeholders.
   5. In the Firebase Console, go to "Build > Firestore Database"
      and click "Create database" (start in TEST MODE for class
      projects, or set the security rules found in README.md).
   ============================================================ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (using the compat SDK loaded via <script> tags
// in index.html — no build tools / npm required)
firebase.initializeApp(firebaseConfig);

// Create a single shared Firestore reference used by app.js and import.html
const db = firebase.firestore();
