// Dikte / tulis bebas -> teks Subjective rapi.
//
// Terapis bercerita seperti biasa ("nyeri punggung bawah sejak 2 minggu, nyeri 6 dari 10,
// bertambah saat duduk lama ..."). Fungsi ini tidak butuh diagnosa atau template terpilih:
// ia hanya merapikan kalimat dan menarik tiga hal yang pasti bisa dikenali (NRS, pemberat,
// peringan) serta penegasan "tidak ada red flag". Deterministik, tanpa jaringan.
//
// Format keluaran mengikuti template Subjective ("**Label:** isi") dan tetap memuat kalimat
// "sejak N hari/minggu/bulan yang lalu" agar deteksi onset (onsetHelpers) tetap jalan.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const sentence = (s) => {
  const t = clean(s).replace(/[,;]+$/, '');
  if (!t) return '';
  const cap = `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
};

const lower = (s) => clean(s).replace(/[.,;]+$/, '');

const NRS_RE = /(?:nyeri|nrs|skala|vas)?[^\d.]{0,12}?\b(\d{1,2})\s*(?:dari|per|\/)\s*10\b/i;
const SINCE_RE = /\bsejak\s+(\d{1,3})\s+(hari|minggu|bulan|tahun)(\s+yang\s+lalu)?/i;
const WORSE_RE = /\b(?:bertambah|bertambah\s+berat|memberat|diperberat|makin\s+sakit|lebih\s+sakit)\s+(?:saat|kalau|ketika|bila|jika|setelah|oleh)\s+([^.,;]+)/gi;
const BETTER_RE = /\b(?:berkurang|membaik|mereda|reda|enakan|lebih\s+enak|diringankan)\s+(?:saat|kalau|ketika|bila|jika|dengan|oleh)\s+([^.,;]+)/gi;
const NO_RED_FLAG_RE = /\b(?:tidak\s+ada|tanpa|nihil)\s+red\s*flags?\b/i;

const collect = (re, text) => {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags);
  // eslint-disable-next-line no-cond-assign
  while ((m = r.exec(text)) !== null) {
    const v = lower(m[1]).replace(/^(?:di\s+)?(?:saat|kalau|ketika)\s+/i, '');
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
};

/**
 * @param {string} raw teks dikte / ketikan bebas
 * @returns {{ text: string, found: string[] }} text kosong bila tidak ada isi
 */
export const parseSubjectiveDictation = (raw) => {
  const body = clean(raw);
  if (!body) return { text: '', found: [] };

  const found = [];
  const lines = [`**Keluhan Utama:** ${body.split(/(?<=[.!?])\s+/).map(sentence).join(' ')}`];

  const nrs = NRS_RE.exec(body);
  if (nrs && Number(nrs[1]) <= 10) {
    lines.push(`**Skala Nyeri (NRS):** ${Number(nrs[1])}/10.`);
    found.push(`NRS ${Number(nrs[1])}/10`);
  }
  if (SINCE_RE.test(body)) found.push('onset');

  const worse = collect(WORSE_RE, body);
  if (worse.length) {
    lines.push(`**Diperberat oleh:** ${worse.join(', ')}.`);
    found.push(`${worse.length} pemberat`);
  }
  const better = collect(BETTER_RE, body);
  if (better.length) {
    lines.push(`**Diringankan oleh:** ${better.join(', ')}.`);
    found.push(`${better.length} peringan`);
  }
  if (NO_RED_FLAG_RE.test(body)) {
    lines.push('**Skrining red flag:** tidak ditemukan.');
    found.push('red flag');
  }

  return { text: lines.join('\n'), found };
};

/** Gabungkan hasil dikte ke Subjective yang sudah ada tanpa menimpa isinya. */
export const appendSubjective = (existing, addition) => {
  const base = String(existing || '').replace(/\s+$/, '');
  return base ? `${base}\n\n${addition}` : addition;
};
