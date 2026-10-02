// Pencarian diagnosa yang toleran salah ketik, diurutkan dari yang paling sesuai.
// Dalam satu tingkat kecocokan, diagnosa yang paling sering dipakai tampil lebih dulu.

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value) => normalize(value).split(' ').filter(Boolean);

// Jarak edit Damerau-Levenshtein (transposisi huruf dihitung 1 kesalahan)
const editDistance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
};

const maxTypos = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

// Skor satu kata pencarian terhadap kata-kata label (0 = tidak cocok)
const scoreToken = (token, words) => {
  let best = 0;
  for (const word of words) {
    if (word === token) best = Math.max(best, 100);
    else if (word.startsWith(token)) best = Math.max(best, 85);
    else if (word.includes(token)) best = Math.max(best, 60);
    else {
      const allowed = maxTypos(token.length);
      if (allowed > 0) {
        const head = word.slice(0, token.length + allowed);
        const d = Math.min(editDistance(token, word, allowed), editDistance(token, head, allowed));
        if (d <= allowed) best = Math.max(best, 45 - d * 5);
      }
    }
  }
  return best;
};

const usageBonus = (usage) => Math.min(Math.log2(1 + (Number(usage) || 0)) * 3, 19);

// Skor relevansi + bonus frekuensi (bonus < 20 sehingga relevansi tetap dominan)
export const scoreDiagnosis = (option, query) => {
  const q = normalize(query);
  const bonus = usageBonus(option.usage);
  if (!q) return bonus;

  const label = normalize(option.label);
  if (!label) return 0;
  if (label === q) return 1000 + bonus;
  if (label.startsWith(q)) return 800 + bonus;

  const words = label.split(' ');
  const tokens = q.split(' ');

  // Singkatan, mis. "lbp" -> Low Back Pain, "hnp" -> Hernia Nucleus Pulposus
  if (tokens.length === 1 && q.length >= 2 && words.length >= 2) {
    const initials = words.map((w) => w[0]).join('');
    if (initials === q) return 550 + bonus;
    if (q.length >= 3 && initials.startsWith(q)) return 500 + bonus;
  }
  const tokenScores = tokens.map((t) => scoreToken(t, words));
  if (tokenScores.some((s) => s === 0)) {
    // Salah ketik pada frasa utuh (mis. spasi hilang/berlebih)
    const allowed = maxTypos(q.length);
    const compactQ = q.replace(/ /g, '');
    const compactL = label.replace(/ /g, '');
    if (allowed > 0 && editDistance(compactQ, compactL.slice(0, compactQ.length + allowed), allowed) <= allowed) {
      return 150 + bonus;
    }
    return 0;
  }

  if (label.includes(q)) return 600 + bonus;
  const avg = tokenScores.reduce((a, b) => a + b, 0) / tokenScores.length;
  // 200-499: semua kata cocok (awalan/bagian kata), lalu 100-199: ada salah ketik
  return (avg >= 60 ? 300 + avg : 100 + avg) + bonus;
};

// Urutkan opsi diagnosa. Query kosong: urut dari yang paling sering dipakai.
export const rankDiagnosisOptions = (options, query, limit = 50) => {
  const list = Array.isArray(options) ? options : [];
  const q = normalize(query);
  const alpha = (a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'id', { sensitivity: 'base' });

  if (!q) {
    return [...list]
      .sort((a, b) => (Number(b.usage) || 0) - (Number(a.usage) || 0) || alpha(a, b))
      .slice(0, limit);
  }

  return list
    .map((option) => ({ option, score: scoreDiagnosis(option, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || alpha(a.option, b.option))
    .slice(0, limit)
    .map((r) => r.option);
};
