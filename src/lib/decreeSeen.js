// Penanda "SK sudah dibuka" per akun, di perangkat ini saja (kemudahan
// per-viewer, bukan data penting): dipakai banner "Ada SK baru".
const key = (userId) => `seen_decrees_${userId || 'anon'}`;

export const getSeenDecreeIds = (userId) => {
  try { return JSON.parse(localStorage.getItem(key(userId)) || '[]'); } catch { return []; }
};

export const markDecreesSeen = (userId, ids) => {
  try {
    const merged = Array.from(new Set([...getSeenDecreeIds(userId), ...ids]));
    localStorage.setItem(key(userId), JSON.stringify(merged));
  } catch { /* penyimpanan tidak tersedia */ }
};
