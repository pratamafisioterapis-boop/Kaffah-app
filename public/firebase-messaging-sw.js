importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyCy-o0bk02MS4YHJEi_zWvC4wCZ9KQFmnI",
  authDomain: "kaffah-physiotherapy.firebaseapp.com",
  projectId: "kaffah-physiotherapy",
  storageBucket: "kaffah-physiotherapy.firebasestorage.app",
  messagingSenderId: "949697796706",
  appId: "1:949697796706:web:4b4b5752883fd3aa9ccf3b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "NO TITLE";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "NO BODY";

  self.registration.showNotification(
    title,
    {
      body,
      icon: "/logo192.png"
    }
  );

});
