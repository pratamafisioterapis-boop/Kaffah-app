// Menggabungkan permintaan GET/HEAD yang IDENTIK dan sedang berjalan bersamaan
// (mis. 5 komponen yang sama-sama meminta data klinik saat dashboard dibuka)
// menjadi satu request jaringan. Tanpa cache berumur: begitu ada request tulis
// (POST/PATCH/PUT/DELETE) antrean dikosongkan, jadi tak ada data basi setelah
// penyimpanan. Request ber-AbortSignal tidak digabung.
const HEADERS_IN_KEY = ['authorization', 'apikey', 'accept', 'prefer', 'range', 'accept-profile', 'content-profile'];

const methodOf = (input, init) =>
  String((init && init.method) || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();

const headerPairs = (input, init) => {
  const h = new Headers((init && init.headers) || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
  return HEADERS_IN_KEY.map((k) => `${k}=${h.get(k) || ''}`).join('|');
};

export const dedupeFetch = (baseFetch) => {
  const inflight = new Map();
  return (input, init) => {
    const method = methodOf(input, init);
    if (method !== 'GET' && method !== 'HEAD') {
      inflight.clear();
      return baseFetch(input, init);
    }
    if (init && init.signal) return baseFetch(input, init);
    const url = typeof input === 'string' ? input : input.url || String(input);
    const key = `${method} ${url} ${headerPairs(input, init)}`;
    let entry = inflight.get(key);
    if (!entry) {
      const p = Promise.resolve(baseFetch(input, init));
      entry = p;
      inflight.set(key, p);
      const done = () => { if (inflight.get(key) === p) inflight.delete(key); };
      p.then(done, done);
    }
    return entry.then((res) => res.clone());
  };
};
