// FIX: Changed import to use the Firebase v9 compat layer for app initialization. This can resolve issues where the modular `firebase/app` package fails to provide the `initializeApp` export due to environment or versioning conflicts, while remaining compatible with the v9 modular services used elsewhere in the application.
import firebase from 'firebase/compat/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project's configuration!
// See README.md for instructions on how to get this.
const firebaseConfig = {
  apiKey: 'AIzaSyCuzYej9NGg1NwI2yi86RUjzGHw3gqxWIU',
  authDomain: 'caro-ai-arena-bk.firebaseapp.com',
  databaseURL:
    'https://caro-ai-arena-bk-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'caro-ai-arena-bk',
  storageBucket: 'caro-ai-arena-bk.firebasestorage.app',
  messagingSenderId: '1081664228289',
  appId: '1:1081664228289:web:58e2878225f50a0f243d40',
  measurementId: 'G-CP84LEHFSC',
};

// Initialize Firebase
// FIX: Use `firebase.initializeApp` from the compat import.
const app = firebase.initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, db, rtdb, enableNetwork, disableNetwork };
