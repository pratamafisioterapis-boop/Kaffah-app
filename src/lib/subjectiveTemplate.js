// Template Subjective (SOAP) interaktif.
//
// Template disimpan di DB sebagai teks biasa, mis.:
//   **Keluhan Utama:** Nyeri leher sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
//   **Riwayat Sekarang:** Kesemutan (ada/tidak). Hasil rontgen: (.....).
//
// File ini mengubahnya menjadi isian yang bisa diklik (chip pilihan, stepper
// durasi, tanggal, teks bebas) lalu merangkai hasilnya menjadi teks Subjective
// yang rapi. Isian yang tidak dipilih/diisi tidak ikut ditampilkan, sehingga
// terapis tidak perlu menghapus apa pun secara manual.

const FREE_RE = /^\(\.{3,}\)/;
const PREFIXED_FREE_RE = /^\((bagian|lokasi|grade) \.{3,}\)/;
const CHOICE_RE = /^\(([^()]+\/[^()]+)\)(?!\s*:)/;
const DURATION_UNIT_RE = /^\s+(hari\/minggu\/bulan|hari\/minggu|minggu\/bulan|hari)(\s+yang lalu)?/;
const NUMERIC_UNIT_RE = /^(%|\/\d+|\s+(?:kali(?:\/\w+)?|jam(?:\/hari)?|menit(?:\/jam)?|detik|hari(?:\/minggu)?|minggu|bulan|tahun|meter|cm|derajat|jari|bungkus-tahun)(?![\p{L}]))/u;
const CONNECTOR_RE = /(?:^|\s)(?:sejak|pada|di|dari|ke|saat|sisi|setelah|dengan|tanggal|usia|selama|sebesar|hingga)\s*$/i;

export const DURATION_UNITS = ['hari', 'minggu', 'bulan', 'tahun'];

const FLAG_SETS = [['ada', 'tidak'], ['ya', 'tidak']];
const isFlag = (options) => {
  const lower = options.map((o) => o.trim().toLowerCase());
  return FLAG_SETS.some((set) => set.length === lower.length && set.every((s) => lower.includes(s)));
};

// ───────────────────────── Parsing ─────────────────────────

// Variabel kustom owner: {{key}} -> token sesuai jenis variabelnya.
const variableToken = (key, def, nextId) => {
  const base = { id: nextId(), varKey: key, hint: def?.label || key };
  switch (def?.kind) {
    case 'choice': return { ...base, t: 'choice', options: def.options || [], flag: false, single: def.multi === false, prefix: '' };
    case 'date': return { ...base, t: 'date' };
    case 'duration': return { ...base, t: 'duration', suffix: '' };
    case 'number': return { ...base, t: 'free', numeric: true, label: def.label };
    default: return { ...base, t: 'free', label: def?.label || key };
  }
};

// Pecah teks bertanda kurung menjadi token: text | free | date | duration | choice.
const VAR_RE = /^\{\{([a-z0-9_]+)\}\}/;

const tokenizeBody = (body, nextId, variables = {}) => {
  const tokens = [];
  let buf = '';
  const flush = () => {
    if (buf) tokens.push({ t: 'text', v: buf });
    buf = '';
  };
  let i = 0;
  let m;
  while (i < body.length) {
    if (body[i] === '{' && (m = body.slice(i).match(VAR_RE))) {
      flush();
      tokens.push(variableToken(m[1], variables[m[1]], nextId));
      i += m[0].length;
      continue;
    }
    if (body[i] !== '(') {
      buf += body[i++];
      continue;
    }
    const rest = body.slice(i);
    if ((m = rest.match(PREFIXED_FREE_RE))) {
      flush();
      tokens.push({ t: 'free', id: nextId(), prefix: `${m[1]} `, optional: true, label: m[1] });
      i += m[0].length;
    } else if ((m = rest.match(FREE_RE))) {
      flush();
      const after = rest.slice(m[0].length);
      const dur = after.match(DURATION_UNIT_RE);
      if (dur && (dur[1] !== 'hari' || dur[2])) {
        tokens.push({ t: 'duration', id: nextId(), suffix: dur[2] ? ' yang lalu' : '' });
        i += m[0].length + dur[0].length;
      } else {
        tokens.push({ t: 'free', id: nextId(), numeric: NUMERIC_UNIT_RE.test(after) });
        i += m[0].length;
      }
    } else if ((m = rest.match(CHOICE_RE))) {
      flush();
      // "(sudah disingkirkan DVT: ya/tidak)" -> awalan tetap tampil, hanya pilihannya yang diklik.
      const colon = m[1].indexOf(':');
      const prefix = colon >= 0 ? `${m[1].slice(0, colon).trim()}: ` : '';
      const options = (colon >= 0 ? m[1].slice(colon + 1) : m[1]).split('/').map((o) => o.trim()).filter(Boolean);
      tokens.push({
        t: 'choice',
        id: nextId(),
        options,
        flag: !prefix && isFlag(options),
        single: !!prefix || isFlag(options),
        prefix,
      });
      i += m[0].length;
    } else {
      buf += body[i++];
    }
  }
  flush();
  return tokens;
};

// Tandai isian "Label: (.....)" / tanggal, dan ambil label untuk placeholder.
const annotate = (tokens) => {
  let before = '';
  tokens.forEach((tok) => {
    if (tok.t === 'text') {
      before += tok.v;
      return;
    }
    if (tok.t === 'free' && !tok.prefix) {
      const keepLabel = tok.label;
      tok.labelType = before.trim() === '' || /:\s*$/.test(before) || /\.\s*$/.test(before);
      const labelMatch = before.match(/([^.:]*?)\s*:\s*$/);
      tok.label = keepLabel || (labelMatch ? labelMatch[1].trim() : '');
      if (!tok.varKey && /tanggal[^:.]*:?\s*$/i.test(before)) tok.t = 'date';
    }
    before += '\u0000';
  });
  return tokens;
};

const splitSentences = (tokens) => {
  const sentences = [];
  let cur = [];
  const push = () => {
    if (cur.some((t) => t.t !== 'text' || t.v.trim())) sentences.push(cur);
    cur = [];
  };
  tokens.forEach((tok) => {
    if (tok.t !== 'text') {
      cur.push(tok);
      return;
    }
    // Kalimat berakhir pada titik + spasi.
    const parts = tok.v.split(/(?<=\.)\s+/);
    parts.forEach((part, idx) => {
      if (part) cur.push({ t: 'text', v: part });
      if (idx < parts.length - 1) push();
    });
  });
  push();
  return sentences;
};

const parseCache = new Map();

export const parseTemplate = (text, variables = {}) => {
  if (!text) return null;
  const cacheKey = /\{\{/.test(text) ? `${text}\u0000${JSON.stringify(variables)}` : text;
  if (parseCache.has(cacheKey)) return parseCache.get(cacheKey);
  let counter = 0;
  const nextId = () => `v${counter++}`;
  const sections = [];
  text.split('\n').forEach((line) => {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) return;
    const tokens = annotate(tokenizeBody(m[2], nextId, variables));
    sections.push({ title: m[1].trim(), sentences: splitSentences(tokens).map((tk) => ({ tokens: tk })) });
  });
  // Kalimat tanpa isian (selain kalimat keluhan pertama) berisi klaim klinis yang
  // belum tentu berlaku untuk pasien ini, jadi dijadikan pilihan centang (default mati).
  sections.forEach((section, sIdx) => {
    section.sentences = section.sentences.map((sentence, idx) => {
      const literal = sentence.tokens.every((t) => t.t === 'text');
      if (!literal || (sIdx === 0 && idx === 0)) return sentence;
      return { tokens: [{ t: 'toggle', id: nextId(), text: sentence.tokens.map((t) => t.v).join('').trim() }] };
    });
  });
  const parsed = sections.length ? { sections, slotCount: counter } : null;
  parseCache.set(cacheKey, parsed);
  return parsed;
};

// ───────────────────────── Nilai isian ─────────────────────────

export const isFilled = (tok, value) => {
  if (tok.t === 'choice') return tok.flag ? !!value : Array.isArray(value) && value.length > 0;
  if (tok.t === 'duration') return !!value && Number(value.n) > 0;
  if (tok.t === 'toggle') return value === true;
  return typeof value === 'string' && value.trim() !== '';
};

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const formatDateId = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]} ${m[1]}`;
};

const joinList = (items) => (items.length <= 1 ? items[0] || '' : `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`);

const valueText = (tok, value) => {
  switch (tok.t) {
    case 'choice':
      if (tok.flag) return value;
      return tok.prefix ? `(${tok.prefix}${joinList(value)})` : joinList(value);
    case 'duration': return `${value.n} ${value.unit || 'hari'}${tok.suffix}`;
    case 'date': return formatDateId(value);
    default: return `${tok.prefix || ''}${value.trim()}`;
  }
};

// ───────────────────────── Render ─────────────────────────

const renderSentence = (tokens, values) => {
  if (tokens.length === 1 && tokens[0].t === 'toggle') return values[tokens[0].id] === true ? tokens[0].text : null;
  const slots = tokens.filter((t) => t.t !== 'text');
  if (slots.length === 0) return tokens.map((t) => t.v).join('').trim();
  if (!slots.some((t) => isFilled(t, values[t.id]))) return null;

  const clauses = [{ str: '', sep: '', drop: false, hasSlot: false, filled: 0 }];
  const cur = () => clauses[clauses.length - 1];
  let skipUnit = false;

  tokens.forEach((tok) => {
    if (tok.t === 'text') {
      let v = tok.v;
      if (skipUnit) {
        v = v.replace(NUMERIC_UNIT_RE, '');
        skipUnit = false;
      }
      v.split(/([,;]\s+)/).forEach((piece, idx) => {
        if (idx % 2 === 1) {
          if (!cur().hasSlot) {
            // daftar tanpa isian ("Mengi, nyeri dada (ada/tidak)") tetap satu klausa
            cur().str += piece.trim().startsWith(';') ? '; ' : ', ';
            return;
          }
          cur().sep = piece.trim();
          clauses.push({ str: '', sep: '', drop: false, hasSlot: false, filled: 0 });
        } else {
          cur().str += piece;
        }
      });
      return;
    }
    cur().hasSlot = true;
    const value = values[tok.id];
    if (isFilled(tok, value)) {
      cur().filled += 1;
      cur().str += valueText(tok, value);
      return;
    }
    // Pertanyaan ya/tidak & isian berlabel dibuang seluruhnya bila kosong;
    // isian lain cukup dilepas bersama kata penghubungnya ("sejak", "sisi", ...).
    const mustHave = (tok.t === 'choice' && tok.flag) || ((tok.t === 'free' || tok.t === 'date') && tok.labelType);
    if (mustHave) {
      cur().drop = true;
      return;
    }
    cur().str = cur().str.replace(CONNECTOR_RE, '');
    if (tok.t === 'free' && tok.numeric) skipUnit = true;
  });

  // Klausa yang punya isian tapi tak satu pun terisi (mis. "perjalanan") ikut dibuang.
  const kept = clauses.filter((c) => !c.drop && c.str.trim() && (!c.hasSlot || c.filled > 0));
  if (!kept.length) return null;
  let out = kept.map((c, i) => c.str.trim() + (i < kept.length - 1 ? c.sep : '')).join(' ');
  out = out
    .replace(/\s+([.,;:%])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;]\s*$/, '')
    .trim();
  if (!out) return null;
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return /[.!?]$/.test(out) ? out : `${out}.`;
};

export const renderTemplate = (parsed, values) => {
  if (!parsed) return '';
  const lines = [];
  parsed.sections.forEach((section, idx) => {
    const sentences = section.sentences.map((s) => renderSentence(s.tokens, values)).filter(Boolean);
    if (!sentences.length) return;
    const body = sentences.join(' ');
    lines.push(idx === 0 ? `${section.title}:\n${body}` : `${section.title}: ${body}`);
  });
  return lines.join('\n');
};

// Jumlah isian yang sudah terisi / total (indikator progres).
export const countProgress = (parsed, values) => {
  let filled = 0;
  let total = 0;
  parsed?.sections.forEach((s) => s.sentences.forEach((sn) => sn.tokens.forEach((tok) => {
    if (tok.t === 'text') return;
    total += 1;
    if (isFilled(tok, values[tok.id])) filled += 1;
  })));
  return { filled, total };
};
