// Smart onset helpers: humanize "berapa lama pasien mengalami keluhan"
// (durasi sejak complaint_onset_date) untuk pengingat terapis.

/**
 * @param {string|Date} onsetDate - tanggal mulai keluhan/cedera pasien
 * @param {string|Date} [referenceDate] - default: hari ini
 * @returns {string|null} teks durasi dalam Bahasa Indonesia, mis. "2 minggu 3 hari"
 */
export const formatOnsetDuration = (onsetDate, referenceDate = new Date()) => {
  if (!onsetDate) return null;

  const start = new Date(onsetDate);
  const end = new Date(referenceDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (totalDays < 0) return null;
  if (totalDays === 0) return 'Hari ini';
  if (totalDays === 1) return '1 hari';

  if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    if (weeks === 0) return `${totalDays} hari`;
    if (days === 0) return `${weeks} minggu`;
    return `${weeks} minggu ${days} hari`;
  }

  if (totalDays < 365) {
    const months = Math.floor(totalDays / 30);
    const remDays = totalDays % 30;
    const weeks = Math.floor(remDays / 7);
    if (weeks === 0) return `${months} bulan`;
    return `${months} bulan ${weeks} minggu`;
  }

  const years = Math.floor(totalDays / 365);
  const remDays = totalDays % 365;
  const months = Math.floor(remDays / 30);
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
};

/**
 * Klasifikasi keluhan berdasarkan durasi, untuk pewarnaan badge pengingat.
 * < 3 minggu: akut, 3 minggu - 3 bulan: subakut, > 3 bulan: kronis.
 */
export const classifyOnsetPhase = (onsetDate, referenceDate = new Date()) => {
  if (!onsetDate) return null;
  const start = new Date(onsetDate);
  const end = new Date(referenceDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const totalDays = Math.floor((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (totalDays < 0) return null;
  if (totalDays <= 21) return { label: 'Akut', color: 'amber' };
  if (totalDays <= 90) return { label: 'Subakut', color: 'blue' };
  return { label: 'Kronis', color: 'rose' };
};

const UNIT_DAYS = { hari: 1, minggu: 7, bulan: 30, tahun: 365 };
const SINCE_RE = /\b(sejak)\s+(\d{1,3})\s+(hari|minggu|bulan|tahun)(\s+yang\s+lalu)?/gi;

const toIsoDate = (d) => {
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Perkirakan tanggal onset dari teks Subjective, mis. "sejak 2 minggu yang lalu"
 * yang ditulis pada tanggal catatan tersebut. Dipakai bila onset belum pernah diisi
 * di form rekam medis lengkap.
 * @returns {string|null} tanggal ISO (yyyy-mm-dd)
 */
export const deriveOnsetFromSubjective = (subjective, recordDate) => {
  if (!subjective || !recordDate) return null;
  const ref = new Date(recordDate);
  if (isNaN(ref.getTime())) return null;
  const m = new RegExp(SINCE_RE.source, 'i').exec(subjective);
  if (!m) return null;
  ref.setDate(ref.getDate() - Number(m[2]) * UNIT_DAYS[m[3].toLowerCase()]);
  return toIsoDate(ref);
};

// Durasi satu satuan untuk kalimat Subjective: "sejak 3 minggu yang lalu".
const toSinglePhrase = (onsetDate, referenceDate) => {
  const start = new Date(onsetDate);
  const end = new Date(referenceDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const days = Math.floor((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return null;
  if (days < 14) return `${Math.max(days, 1)} hari`;
  if (days < 60) return `${Math.round(days / 7)} minggu`;
  if (days < 730) return `${Math.round(days / 30)} bulan`;
  return `${Math.round(days / 365)} tahun`;
};

/**
 * Perbarui durasi onset di teks Subjective hasil salinan ("sejak 2 minggu yang lalu")
 * agar sesuai dengan hari ini.
 */
export const refreshOnsetInSubjective = (subjective, onsetDate, referenceDate = new Date()) => {
  if (!subjective || !onsetDate) return subjective;
  const phrase = toSinglePhrase(onsetDate, referenceDate);
  if (!phrase) return subjective;
  return subjective.replace(SINCE_RE, (_, word, __, ___, ago) => `${word} ${phrase}${ago || ''}`);
};
