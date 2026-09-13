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
