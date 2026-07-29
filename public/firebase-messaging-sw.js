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

// Clinic logos used as notification icons live at a predictable storage
// path. We cache-first just those (not the app shell — see the note below)
// so showNotification() can hand the OS an icon that's already on disk
// instead of racing a fresh network fetch, which is what was causing some
// notifications to fall back to the generic monogram avatar.
const ICON_CACHE_NAME = "kaffah-push-icons-v1";
const ICON_URL_PATTERN = /\/storage\/v1\/object\/public\/clinic-assets\/clinic-logos\//;

async function warmIconCache(iconUrl) {
  try {
    const cache = await caches.open(ICON_CACHE_NAME);
    const cached = await cache.match(iconUrl);
    if (cached) return;
    const response = await fetch(iconUrl);
    if (response.ok) await cache.put(iconUrl, response.clone());
  } catch (_e) {
    // Best-effort only — showNotification still gets called either way.
  }
}

messaging.onBackgroundMessage(async (payload) => {

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "NO TITLE";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "NO BODY";

  const iconUrl = payload?.data?.icon_url || "/logo192.png?v=kaffahtech1";

  if (payload?.data?.icon_url) {
    await warmIconCache(iconUrl);
  }

  self.registration.showNotification(
    title,
    {
      body,
      icon: iconUrl,
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
// Beyond the narrow icon cache-warming above, this service worker still
// intercepts nothing else — every navigation, JS chunk and API call goes
// straight to the network, governed by normal HTTP Cache-Control headers
// (see vercel.json, which already marks index.html as no-cache). The fetch
// handler below only ever matches clinic logo image URLs, never app-shell
// files, so the "blank white screen from a stale cached index.html" class
// of bug stays structurally impossible.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'GET' && ICON_URL_PATTERN.test(req.url)) {
    event.respondWith(
      caches.open(ICON_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const response = await fetch(req);
        if (response.ok) cache.put(req, response.clone());
        return response;
      })
    );
  }
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

// One-time cleanup: delete any cache storage left over from the old
// caching logic on devices that installed an earlier version of this file.
// The icon cache from above is deliberately kept.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== ICON_CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});