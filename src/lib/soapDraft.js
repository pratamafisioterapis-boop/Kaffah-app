// Draf SOAP otomatis di perangkat. Dipakai agar isian terapis tidak hilang saat ponsel
// me-refresh halaman, browser dimatikan sistem, atau layar mati sebelum sempat disimpan.
// Disimpan di localStorage per terapis + sesi (rekap) / pasien, kedaluwarsa setelah 3 hari.

const PREFIX = 'kaffah.soap-draft.v1:';
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_CHARS = 400000;

export const soapDraftKey = (therapistId, scopeId) => (therapistId && scopeId ? `${PREFIX}${therapistId}:${scopeId}` : null);

export const loadSoapDraft = (key) => {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || draft.v !== 1 || !draft.savedAt || Date.now() - draft.savedAt > TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

export const saveSoapDraft = (key, data) => {
  if (!key) return false;
  try {
    const raw = JSON.stringify({ v: 1, savedAt: Date.now(), ...data });
    if (raw.length > MAX_CHARS) return false;
    window.localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
};

export const clearSoapDraft = (key) => {
  if (!key) return;
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
};

const TEXT_FIELDS = ['subjective', 'objective', 'assessment', 'plan', 'education'];

/** Ada isian buatan terapis (bukan sekadar bawaan form) yang layak disimpan. */
export const hasSoapContent = (formData, diagnosis) => (
  TEXT_FIELDS.some((k) => String(formData?.[k] || '').trim()) || (Array.isArray(diagnosis) && diagnosis.length > 0)
);

/** Draf berbeda dari isi form sekarang pada kolom teks atau diagnosa. */
export const draftDiffers = (draft, formData, diagnosis) => {
  if (!draft) return false;
  const f = draft.formData || {};
  if (TEXT_FIELDS.some((k) => String(f[k] || '').trim() !== String(formData?.[k] || '').trim())) return true;
  return JSON.stringify(draft.diagnosis || []) !== JSON.stringify(diagnosis || []);
};
