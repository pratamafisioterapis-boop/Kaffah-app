const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

const toWords = (n) => {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${toWords(n - 10)} belas`;
  if (n < 100) return `${toWords(Math.floor(n / 10))} puluh ${toWords(n % 10)}`.trim();
  if (n < 200) return `seratus ${toWords(n - 100)}`.trim();
  if (n < 1000) return `${toWords(Math.floor(n / 100))} ratus ${toWords(n % 100)}`.trim();
  if (n < 2000) return `seribu ${toWords(n - 1000)}`.trim();
  if (n < 1e6) return `${toWords(Math.floor(n / 1000))} ribu ${toWords(n % 1000)}`.trim();
  if (n < 1e9) return `${toWords(Math.floor(n / 1e6))} juta ${toWords(n % 1e6)}`.trim();
  if (n < 1e12) return `${toWords(Math.floor(n / 1e9))} miliar ${toWords(n % 1e9)}`.trim();
  return `${toWords(Math.floor(n / 1e12))} triliun ${toWords(n % 1e12)}`.trim();
};

// 700000 -> "Tujuh Ratus Ribu Rupiah"
export const terbilangRupiah = (value) => {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const words = n === 0 ? 'nol' : toWords(n);
  return `${words} rupiah`.replace(/\b\w/g, (c) => c.toUpperCase());
};
