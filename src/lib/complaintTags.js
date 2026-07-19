// Canonical vocabulary shared between the therapist "keahlian" editor
// (TherapistManager) and Smart Booking's recommendation matching. Keep the
// slugs stable — they're persisted in physiotherapists.complaint_tags.

export const COMPLAINT_TAGS = [
  { slug: 'saraf_terjepit', label: 'Saraf Terjepit' },
  { slug: 'nyeri_otot_sendi', label: 'Nyeri Otot/Sendi' },
  { slug: 'stroke', label: 'Stroke' },
  { slug: 'cedera_olahraga', label: 'Cedera Olahraga' },
  { slug: 'recovery_paska_olahraga', label: 'Recovery Paska Olahraga' },
  { slug: 'paska_operasi', label: 'Paska Operasi' },
  { slug: 'lansia', label: 'Lansia' },
  { slug: 'atlet', label: 'Atlet' },
];

export const complaintLabel = (slug) => COMPLAINT_TAGS.find(t => t.slug === slug)?.label || slug;

// Ordered so "nearest window" fallback logic can walk outward from any index.
export const TIME_WINDOWS = [
  { id: 'pagi', label: 'Pagi', desc: '06:00 - 11:00', start: '06:00', end: '11:00' },
  { id: 'siang', label: 'Siang', desc: '11:00 - 15:00', start: '11:00', end: '15:00' },
  { id: 'sore', label: 'Sore', desc: '15:00 - 18:00', start: '15:00', end: '18:00' },
  { id: 'malam', label: 'Malam', desc: '18:00 - 21:00', start: '18:00', end: '21:00' },
];

export const WHEN_OPTIONS = [
  { id: 'asap', label: 'Secepatnya', desc: 'Jadwal terdekat yang tersedia' },
  { id: 'tomorrow', label: 'Besok', desc: 'Mulai besok' },
  { id: 'this_week', label: 'Dalam Minggu Ini', desc: 'Sebelum akhir minggu ini' },
  { id: 'custom', label: 'Tanggal Khusus', desc: 'Pilih tanggal sendiri' },
];
