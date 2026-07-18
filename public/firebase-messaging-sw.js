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

// --- Caching logic (dipindah dari public/sw.js supaya cuma 1 service worker aktif di scope '/') ---
const CACHE_NAME = 'kaffah-care-v103';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Navigation requests (index.html) must always be revalidated against the
  // network. A cached/stale index.html references JS chunk filenames from a
  // previous deploy that no longer exist, which is what causes "Failed to
  // fetch dynamically imported module" after a new deploy. Only fall back to
  // the cached copy when truly offline.
  const isNavigation = event.request.mode === 'navigate' || event.request.destination === 'document';

  event.respondWith(
    fetch(event.request, isNavigation ? { cache: 'no-store' } : undefined)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});