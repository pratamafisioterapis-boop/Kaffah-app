// Warna & format angka bersama untuk dashboard finance (layout bento).
// Class Tailwind ditulis literal supaya ikut ter-generate oleh JIT.
export const TONES = {
  pos: { hex: '#059669', icon: 'bg-emerald-50 text-emerald-600', tint: 'bg-gradient-to-b from-emerald-50 to-white', soft: 'bg-emerald-50', text: 'text-emerald-600' },
  neg: { hex: '#e11d48', icon: 'bg-rose-50 text-rose-600', tint: 'bg-gradient-to-b from-rose-50 to-white', soft: 'bg-rose-50', text: 'text-rose-600' },
  warn: { hex: '#d97706', icon: 'bg-amber-50 text-amber-600', tint: 'bg-gradient-to-b from-amber-50 to-white', soft: 'bg-amber-50', text: 'text-amber-600' },
  acc: { hex: '#0d9488', icon: 'bg-teal-50 text-teal-600', tint: 'bg-gradient-to-b from-teal-50 to-white', soft: 'bg-teal-50', text: 'text-teal-600' },
  vio: { hex: '#7c3aed', icon: 'bg-violet-50 text-violet-600', tint: 'bg-gradient-to-b from-violet-50 to-white', soft: 'bg-violet-50', text: 'text-violet-600' },
  sky: { hex: '#2563eb', icon: 'bg-blue-50 text-blue-600', tint: 'bg-gradient-to-b from-blue-50 to-white', soft: 'bg-blue-50', text: 'text-blue-600' },
};

export const CHART_COLORS = ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#059669', '#06b6d4', '#ec4899'];

const dec = (n) => n.toFixed(1).replace('.', ',').replace(/,0$/, '');

// 84600000 -> "84,6 jt"
export const fmtShort = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${dec(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}${dec(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`;
  return `${sign}${Math.round(abs)}`;
};

export const fmtRp = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
export const fmtPct = (value) => `${dec(Number(value) || 0)}%`;

// Warna stabil per teks (mis. nama kategori) supaya kategori yang sama selalu sama warnanya.
const CATEGORY_TONES = ['acc', 'sky', 'warn', 'vio', 'pos', 'neg'];
export const toneFor = (text = '') => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 997;
  return CATEGORY_TONES[h % CATEGORY_TONES.length];
};
