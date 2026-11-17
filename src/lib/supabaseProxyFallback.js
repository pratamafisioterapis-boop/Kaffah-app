// Fallback jaringan: bila browser tidak bisa menjangkau host Supabase (mis. DNS ISP/router
// mengalihkan *.supabase.co ke alamat lokal, yang diblokir Chrome sebagai "local address
// space"), permintaan dialihkan lewat proxy same-origin `/supabase-proxy/*` (rewrite di
// vercel.json). Jalur normal TIDAK berubah: semua permintaan tetap langsung ke Supabase;
// proxy hanya dipakai setelah permintaan gagal di level jaringan DAN pengecekan kesehatan
// memastikan host Supabase memang tidak terjangkau sementara proxy terjangkau.
//
// Tidak tercakup: WebSocket realtime (rewrite Vercel tidak mem-proxy WebSocket) dan URL
// gambar publik Storage yang dimuat langsung oleh <img>.

export const PROXY_PATH = '/supabase-proxy';
const STORAGE_KEY = 'kaffah-sb-proxy-until';
const PROXY_TTL_MS = 30 * 60 * 1000; // setelah itu coba jalur langsung lagi
const PROBE_TIMEOUT_MS = 4000;
const PROBE_CACHE_MS = 10_000;

const readUntil = () => {
  try { return Number(window.localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
};
const writeUntil = (t) => {
  try { window.localStorage.setItem(STORAGE_KEY, String(t)); } catch { /* abaikan */ }
};

const probe = async (url, apikey, baseFetch) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await baseFetch(url, { headers: { apikey }, cache: 'no-store', signal: ctrl.signal });
    return true; // ada respons HTTP apa pun = host terjangkau
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const createProxyFallbackFetch = ({
  supabaseUrl,
  anonKey,
  baseFetch = (...args) => window.fetch(...args),
}) => {
  let proxyUntil = readUntil();
  let switching = null; // single-flight: banyak request gagal bersamaan -> satu pengecekan
  let lastDecision = { at: 0, useProxy: false };

  const inProxyMode = () => Date.now() < proxyUntil;
  const isSupabaseUrl = (u) => typeof u === 'string' && u.startsWith(`${supabaseUrl}/`);
  const toProxyUrl = (u) => `${window.location.origin}${PROXY_PATH}${u.slice(supabaseUrl.length)}`;

  const decideSwitch = () => {
    if (Date.now() - lastDecision.at < PROBE_CACHE_MS) return Promise.resolve(lastDecision.useProxy);
    if (!switching) {
      switching = (async () => {
        const directOk = await probe(`${supabaseUrl}/auth/v1/health`, anonKey, baseFetch);
        let useProxy = false;
        if (!directOk) {
          useProxy = await probe(`${window.location.origin}${PROXY_PATH}/auth/v1/health`, anonKey, baseFetch);
        }
        if (useProxy) {
          proxyUntil = Date.now() + PROXY_TTL_MS;
          writeUntil(proxyUntil);
          console.warn('[supabase] Host Supabase tidak terjangkau; memakai proxy same-origin sementara.');
        }
        lastDecision = { at: Date.now(), useProxy };
        return useProxy;
      })().finally(() => { switching = null; });
    }
    return switching;
  };

  const viaProxy = (input, init) => {
    if (typeof input === 'string') return baseFetch(toProxyUrl(input), init);
    // Request object
    return baseFetch(new Request(toProxyUrl(input.url), input), init);
  };

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input && input.url;
    if (!isSupabaseUrl(url)) return baseFetch(input, init);
    if (inProxyMode()) return viaProxy(input, init);

    try {
      return await baseFetch(input, init);
    } catch (err) {
      // Hanya kegagalan jaringan (TypeError); pembatalan oleh pemanggil tidak diulang.
      if (!(err instanceof TypeError) || (init && init.signal && init.signal.aborted)) throw err;
      if (await decideSwitch()) return viaProxy(input, init);
      throw err;
    }
  };
};
