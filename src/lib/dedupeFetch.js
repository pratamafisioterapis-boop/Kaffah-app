// Dua lapis pengurangan request GET ke Supabase:
//  1) Dedupe: GET/HEAD IDENTIK yang sedang berjalan bersamaan digabung jadi satu request.
//  2) Cache 10 detik untuk tabel referensi yang jarang berubah (clinics, users, opsi, dst.)
//     karena komponen yang berbeda memintanya bergantian saat dashboard dibuka.
// Keamanan data basi: begitu ada request tulis (POST/PATCH/PUT/DELETE, termasuk RPC)
// SEMUA cache dan antrean dikosongkan. Response gagal (non-2xx) tidak di-cache.
// Request ber-AbortSignal tidak disentuh.
const HEADERS_IN_KEY = ['authorization', 'apikey', 'accept', 'prefer', 'range', 'accept-profile', 'content-profile'];
const CACHEABLE_TABLES = new Set([
  'clinics', 'users', 'operational_options', 'physiotherapists', 'bank_accounts',
  'therapist_schedules', 'soap_first_settings', 'therapist_targets',
]);
const CACHE_TTL_MS = 10_000;

const methodOf = (input, init) =>
  String((init && init.method) || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();

const headerPairs = (input, init) => {
  const h = new Headers((init && init.headers) || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
  return HEADERS_IN_KEY.map((k) => `${k}=${h.get(k) || ''}`).join('|');
};

const tableOf = (url) => {
  const m = /\/rest\/v1\/([a-z_]+)(?:\?|$)/.exec(url);
  return m ? m[1] : null;
};

export const dedupeFetch = (baseFetch, { ttlMs = CACHE_TTL_MS, tables = CACHEABLE_TABLES } = {}) => {
  const inflight = new Map();
  const cache = new Map(); // key -> { at, promise }
  return (input, init) => {
    const method = methodOf(input, init);
    if (method !== 'GET' && method !== 'HEAD') {
      inflight.clear();
      cache.clear();
      return baseFetch(input, init);
    }
    if (init && init.signal) return baseFetch(input, init);

    const url = typeof input === 'string' ? input : input.url || String(input);
    const key = `${method} ${url} ${headerPairs(input, init)}`;
    const cacheable = method === 'GET' && tables.has(tableOf(url));

    if (cacheable) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.promise.then((res) => res.clone());
    }

    let entry = inflight.get(key);
    if (!entry) {
      const p = Promise.resolve(baseFetch(input, init));
      entry = p;
      inflight.set(key, p);
      const done = () => { if (inflight.get(key) === p) inflight.delete(key); };
      p.then(done, done);
      if (cacheable) {
        const record = { at: Date.now(), promise: p };
        cache.set(key, record);
        p.then((res) => { if (!res.ok && cache.get(key) === record) cache.delete(key); }, () => { if (cache.get(key) === record) cache.delete(key); });
      }
    }
    return entry.then((res) => res.clone());
  };
};
