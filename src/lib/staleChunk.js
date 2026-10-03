// Setelah tiap deploy nama file hasil build (hash) berubah. Tab/PWA yang masih
// memegang index.html atau chunk lama akan meminta file yang sudah tidak ada;
// server lalu membalas index.html (text/html), dan browser melaporkannya dengan
// pesan yang berbeda-beda:
//   Chrome : "Failed to fetch dynamically imported module" /
//            "Failed to load module script: Expected a JavaScript module script
//             but the server responded with a MIME type of "text/html""
//   Safari : "'text/html' is not a valid JavaScript MIME type for module script"
//            / "Importing a module script failed."
//   Firefox: "error loading dynamically imported module"
// Satu pengenal bersama supaya semua penangkap error (lazyRetry, ErrorBoundary,
// AuthErrorBoundary, listener global) mengenali semua varian tersebut.
const STALE_CHUNK_RE = new RegExp(
  [
    'dynamically imported module',
    'loading chunk .* failed',
    'loading css chunk',
    'failed to fetch dynamically',
    'unable to preload css',
    'importing a module script failed',
    'failed to load module script',
    'not a valid javascript mime type',
    'expected a javascript.*module script',
    "cannot access '.*' before initialization",
    // React.lazy menerima modul kosong saat chunk lama/baru tidak cocok
    // setelah deploy beruntun: "Cannot read properties of undefined (reading 'default')".
    "undefined \\(reading 'default'\\)",
  ].join('|'),
  'i'
);

export const isStaleChunkError = (errorOrMessage) => {
  const message =
    typeof errorOrMessage === 'string'
      ? errorOrMessage
      : errorOrMessage?.message || String(errorOrMessage || '');
  return STALE_CHUNK_RE.test(message);
};

const RELOAD_LOG_KEY = 'stale-chunk-reload-log';
const MAX_RELOADS = 3; // per jendela waktu
const WINDOW_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 5 * 1000;

// Reload untuk mengambil versi terbaru. Bukan sekali-seumur-tab (guard lama
// membuat tab yang terbuka lama gagal reload di deploy berikutnya), tapi
// dibatasi beberapa kali dalam 10 menit agar tidak pernah jadi reload loop.
// Mengembalikan true bila reload dijalankan.
export const reloadForStaleChunk = (reason = 'stale-chunk') => {
  try {
    const now = Date.now();
    const log = JSON.parse(sessionStorage.getItem(RELOAD_LOG_KEY) || '[]').filter(
      (t) => now - t < WINDOW_MS
    );
    if (log.length >= MAX_RELOADS || (log.length && now - log[log.length - 1] < MIN_GAP_MS)) {
      return false;
    }
    log.push(now);
    sessionStorage.setItem(RELOAD_LOG_KEY, JSON.stringify(log));
    sessionStorage.setItem(
      'last-auto-reload-reason',
      JSON.stringify({ type: reason, at: new Date(now).toISOString(), path: window.location.pathname })
    );
  } catch {
    // sessionStorage tidak tersedia: tetap coba reload satu kali lewat guard di memori
    if (window.__staleChunkReloaded) return false;
    window.__staleChunkReloaded = true;
  }
  window.location.reload();
  return true;
};

// Bersihkan semua cache & service worker lalu muat ulang dengan URL segar.
export const hardRefresh = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // abaikan; tetap lanjut reload
  }
  const url = new URL(window.location.href);
  url.searchParams.set('_r', Date.now().toString(36));
  window.location.replace(url.toString());
};
