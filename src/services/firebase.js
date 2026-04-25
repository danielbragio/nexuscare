import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_kHgg4Oo21G7CBDwVr4PDJBI9gJ9xBB4",
  authDomain: "healthsystem-saas.firebaseapp.com",
  projectId: "healthsystem-saas",
  storageBucket: "healthsystem-saas.firebasestorage.app",
  messagingSenderId: "1000542166049",
  appId: "1:1000542166049:web:2209d3b89b755ad8871760",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;