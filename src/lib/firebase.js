import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCy-o0bk02MS4YHJEi_zWvC4wCZ9KQFmnI",
  authDomain: "kaffah-physiotherapy.firebaseapp.com",
  projectId: "kaffah-physiotherapy",
  storageBucket: "kaffah-physiotherapy.firebasestorage.app",
  messagingSenderId: "949697796706",
  appId: "1:949697796706:web:4b4b5752883fd3aa9ccf3b",
  measurementId: "G-H67NWMQ7BY"
};

export const firebaseApp = initializeApp(firebaseConfig);

export const messaging =
  typeof window !== "undefined"
    ? getMessaging(firebaseApp)
    : null;