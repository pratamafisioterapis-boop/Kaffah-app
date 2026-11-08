// Cache peta id -> label untuk operational_options per klinik.
// Sebelumnya setiap pemuatan tabel rekap mengunduh ulang SELURUH opsi klinik.
// Pengaman: TTL pendek, permintaan serentak digabung, dan jika ada id (UUID)
// yang belum ada di cache kita ambil ulang sekali, jadi opsi yang baru dibuat
// tidak pernah tampil sebagai "tidak dikenal".
const TTL_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const store = new Map(); // clinicId -> { map, at, promise }

export const invalidateOptionsMapCache = () => store.clear();

export const getOptionsMap = async (clinicId, fetchOptions, neededIds = []) => {
  const entry = store.get(clinicId);
  const fresh = entry?.map && Date.now() - entry.at < TTL_MS;
  const missing = fresh && neededIds.some((id) => typeof id === 'string' && UUID_RE.test(id) && !(id in entry.map));
  if (fresh && !missing) return entry.map;
  if (entry?.promise && !missing) return entry.promise;

  const promise = fetchOptions().then((options) => {
    if (!options) { store.delete(clinicId); return null; }
    const map = {};
    for (const o of options) map[o.id] = o.label;
    store.set(clinicId, { map, at: Date.now(), promise: null });
    return map;
  }, (err) => { store.delete(clinicId); throw err; });
  store.set(clinicId, { ...(entry || {}), promise });
  return promise;
};
