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
      icon: "/logo192.png",
      data: {
        url: payload?.data?.url,
        appointment_date: payload?.data?.appointment_date,
        appointment_id: payload?.data?.appointment_id
      }
    }
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {

      for (const client of clientList) {

        if ("focus" in client) {

          client.navigate(url);

          return client.focus();
        }
      }

      return clients.openWindow(url);
    })
  );
});

// --- No custom caching on purpose ---
// This service worker previously cached the app shell (index.html + JS
// chunks) so it could work offline. In practice, every time new code was
// deployed, browsers with an already-installed service worker kept serving
// the OLD cached index.html, which references JS chunk filenames from the
// previous build that no longer exist on the server — that's what caused
// the "blank white screen" incidents (the cache version here churned
// through v100-v104 chasing this same bug). This app is a live,
// database-backed clinic system; there is no real offline mode to support,
// so the trade-off isn't worth it.
//
// With no `fetch` listener at all, this service worker never intercepts
// any request — every navigation and asset load goes straight to the
// network, governed by normal HTTP Cache-Control headers (see
// vercel.json, which already marks index.html as no-cache). That makes
// this whole class of bug structurally impossible going forward: there's
// nothing left here that could ever serve a stale response.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// One-time cleanup: delete any cache storage left over from the old
// caching logic on devices that installed an earlier version of this file.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});