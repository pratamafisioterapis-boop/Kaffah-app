// Template Subjective & Objective (SOAP) interaktif.
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
const NUMERIC_UNIT_RE = /^(%|\/\d+|\/\(\.{3,}\)|\s+(?:kali(?:\/\w+)?|jam(?:\/hari)?|menit(?:\/jam)?|detik|hari(?:\/minggu)?|minggu|bulan|tahun|meter|cm|mm|kg|ml|derajat|jari|repetisi|mmHg|x\/menit|L\/menit|m\/detik|m|C|bungkus-tahun)(?![\p{L}]))/u;
const SIDE_RE = /(?:^|\s)(?:kanan|kiri)\s*$/i;
const CONNECTOR_RE = /(?:^|\s)(?:sejak|pada|di|dari|ke|saat|sisi|setelah|dengan|tanggal|usia|selama|sebesar|hingga)\s*$/i;

export const DURATION_UNITS = ['hari', 'minggu', 'bulan', 'tahun'];

const FLAG_SETS = [['ada', 'tidak'], ['ya', 'tidak']];
// Pasangan "Terdapat/Tidak terdapat", "mengalami/tidak mengalami": hanya boleh satu.
const isNegPair = (options) => {
  if (options.length !== 2) return false;
  const [a, b] = options.map((o) => o.trim().toLowerCase());
  return b === `tidak ${a}` || a === `tidak ${b}` || b === `belum ${a}` || a === `belum ${b}`;
};
// Pilihan yang saling meniadakan (Positif/Negatif, normal/menurun/hilang, 0/1/2/3/4, ...).
const EXCLUSIVE_WORDS = new Set([
  'normal', 'positif', 'negatif', 'ada', 'tidak', 'ya', 'ditemukan', 'terdapat', 'simetris', 'asimetris',
  'kuat', 'baik', 'kurang', 'menurun', 'meningkat', 'hilang', 'mudah', 'sulit', 'mampu', 'mandiri',
]);
const isExclusive = (options) => {
  const lower = options.map((o) => o.trim().toLowerCase());
  if (lower.some((o) => o === 'kanan' || o === 'kiri')) return false;
  if (lower.every((o) => /^\d/.test(o))) return true;
  return lower.some((o) => EXCLUSIVE_WORDS.has(o) || /^(tidak|belum|bukan) /.test(o));
};
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
const FORM_RE = /^\{\{form:([a-z0-9_|]+)\}\}/;
const SCALE_AFTER_RE = /^\/(\d{1,2})(?!\d)/;
const PLUS_MINUS = ['+', '-'];

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
    if (body[i] === '{' && (m = body.slice(i).match(FORM_RE))) {
      flush();
      tokens.push({ t: 'form', id: nextId(), forms: m[1].split('|') });
      i += m[0].length;
      continue;
    }
    if (body[i] === '[' || body[i] === ']') {
      // [ ... ] = kelompok opsional: hilang seluruhnya bila isinya tak terisi
      flush();
      tokens.push({ t: body[i] === '[' ? 'gopen' : 'gclose' });
      i += 1;
      continue;
    }
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
        const sc = after.match(SCALE_AFTER_RE);
        if (sc && Number(sc[1]) <= 12) {
          tokens.push({ t: 'scale', id: nextId(), min: 0, max: Number(sc[1]), numeric: true });
        } else {
          tokens.push({ t: 'free', id: nextId(), numeric: NUMERIC_UNIT_RE.test(after) });
        }
        i += m[0].length;
      }
    } else if ((m = rest.match(CHOICE_RE))) {
      flush();
      // "(sudah disingkirkan DVT: ya/tidak)" -> awalan tetap tampil, hanya pilihannya yang diklik.
      const colon = m[1].indexOf(':');
      const prefix = colon >= 0 ? `${m[1].slice(0, colon).trim()}: ` : '';
      const options = (colon >= 0 ? m[1].slice(colon + 1) : m[1]).split('/').map((o) => o.trim()).filter(Boolean);
      const plusMinus = options.length === 2 && options.every((o, k) => o === PLUS_MINUS[k]);
      tokens.push({
        t: 'choice',
        id: nextId(),
        options,
        flag: !prefix && isFlag(options),
        single: !!prefix || isFlag(options) || plusMinus || isNegPair(options) || isExclusive(options),
        wrap: plusMinus,
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
    if (tok.t === 'gopen' || tok.t === 'gclose') return;
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

// Isian di bagian "Kekuatan (0-5)" / "MMT" / "Tonus (Modified Ashworth)" otomatis
// menjadi deretan angka yang tinggal diklik.
const applySectionKind = (tokens, title, nextId) => tokens.map((tok) => {
  if (tok.t !== 'free' || tok.prefix || tok.varKey) return tok;
  if (/\b0-5\b|MMT|Oxford/i.test(title)) return { ...tok, t: 'scale', min: 0, max: 5, numeric: false };
  if (/Ashworth/i.test(title)) {
    return { t: 'choice', id: tok.id, options: ['0', '1', '1+', '2', '3', '4'], flag: false, single: true, prefix: '', hint: tok.label };
  }
  void nextId;
  return tok;
});


// ───────────── Format daftar (Objective) ─────────────
//
//   Inspeksi
//   - (Ditemukan/Tidak ditemukan) atrofi otot.
//   Nadi : (.....) x/menit
//
// Baris tanpa "- " dan tanpa " : " adalah judul bagian; "- ..." poin kalimat;
// "Nama : nilai" satu pengukuran/tes per baris.

const LIST_HEAD_CHOICE_RE = /^(.*?)\s*\(([^()]+\/[^()]+)\)\s*$/;
const ZERO_FIVE_RE = /\b0-5\b|MMT|Oxford/i;
const ASHWORTH = ['0', '1', '1+', '2', '3', '4'];

const isListFormat = (text) => !/^\*\*.+?:\*\*/m.test(text) && text.split('\n').some((l) => /^- /.test(l) || / : /.test(l));

// Tanda kurung bersarang "(udara ruangan/O2 (.....) L/menit)" dijadikan pilihan + kelompok opsional.
const flattenNested = (body) => {
  const pre = body.replace('(udara ruangan/O2 (.....) L/menit)', '(udara ruangan/O2) [(.....) L/menit]');
  let out = '';
  let i = 0;
  while (i < pre.length) {
    if (pre[i] !== '(') {
      out += pre[i++];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < pre.length; j += 1) {
      if (pre[j] === '(') depth += 1;
      else if (pre[j] === ')') {
        depth -= 1;
        if (!depth) break;
      }
    }
    const inner = pre.slice(i + 1, j);
    out += j < pre.length && inner.includes('(') ? `[${inner}]` : pre.slice(i, j + 1);
    i = j + 1;
  }
  return out;
};

// Pisahkan "Label : nilai" pada titik dua di luar tanda kurung.
const splitKV = (line) => {
  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ':' && depth === 0) {
      const rest = line.slice(i + 1);
      if (/^\s/.test(rest) && (/^\s*\S/.test(rest)) && (line[i - 1] === ' ' || /^\s*\(\.{3,}\)/.test(rest))) {
        return [line.slice(0, i).trim(), rest.trim()];
      }
    }
  }
  return null;
};

// "Label (rincian : (.....))" -> "Label : rincian (.....)"; beberapa pola bersarang dirapikan.
const tidyLine = (line) => line
  .replace('(ukuran : (.....) cm, lunak/keras)', ': ukuran (.....) cm, (lunak/keras)')
  .replace('(normal/deviasi: (.....))', '(normal/deviasi) [(.....)]')
  .replace(/^(.*?)\s*\(([^():]+) : (\(\.{3,}\))\)$/, '$1 : $2 $3');

// Baris alat ukur ("Berg Balance : (.....)/56") otomatis dapat tombol formulir fungsional.
const FORM_WORDS = {
  barthel: 'barthel', berg: 'berg', ndi: 'ndi', odi: 'odi', oswestry: 'odi', lefs: 'lefs', spadi: 'spadi',
  fesi: 'fesi', koos: 'koos', womac: 'womac', hoos: 'hoos', dash: 'dash', quickdash: 'quickdash',
  prwe: 'prwe', tinetti: 'tinetti', ikdc: 'ikdc', psfs: 'psfs', nihss: 'nihss', sppb: 'sppb', minibest: 'minibest',
};
const formsForLabel = (label) => {
  const found = [];
  (label.toLowerCase().match(/[a-z]+/g) || []).forEach((w) => {
    const id = FORM_WORDS[w];
    if (id && !found.includes(id)) found.push(id);
  });
  return found;
};

const parseListTemplate = (text, variables) => {
  let counter = 0;
  const nextId = () => `v${counter++}`;
  const sections = [];
  let cur = null;
  const openSection = (title, valueOptions = null) => {
    cur = { title, layout: 'lines', key: title.toLowerCase(), valueOptions, sentences: [] };
    sections.push(cur);
    return cur;
  };
  const push = (kind, rawTokens) => {
    // Label sudah tampil di baris, jadi placeholder isian cukup "isi...".
    const tokens = rawTokens.map((t) => (t.t === 'free' && t.label ? { ...t, label: '' } : t));
    const hasSlot = tokens.some((t) => t.t !== 'text' && t.t !== 'gopen' && t.t !== 'gclose');
    if (hasSlot) {
      cur.sentences.push({ kind, tokens });
      return;
    }
    const line = tokens.map((t) => t.v).join('').trim();
    if (line) cur.sentences.push({ kind: 'bullet', tokens: [{ t: 'toggle', id: nextId(), text: line }] });
  };

  text.split('\n').map((l) => tidyLine(l.trimEnd())).filter((l) => l.trim()).forEach((line) => {
    const bullet = line.startsWith('- ');
    const kv = bullet ? null : splitKV(line);

    // Baris tanpa titik dua tetapi punya isian bukan judul bagian.
    if (!bullet && !kv && /\(\.{3,}\)/.test(line)) {
      push('kv', annotate(tokenizeBody(flattenNested(line), nextId, variables)));
      return;
    }

    if (!bullet && !kv) {
      let title = line.trim();
      let valueOptions = null;
      let side = null;
      const hm = !/\.{3,}/.test(title) && title.match(LIST_HEAD_CHOICE_RE);
      if (hm) {
        const opts = hm[2].split('/').map((o) => o.trim()).filter(Boolean);
        title = hm[1].trim();
        if (opts.some((o) => /^(kanan|kiri)$/i.test(o))) side = opts;
        else valueOptions = opts;
      }
      openSection(title, valueOptions);
      if (side) {
        cur.sentences.push({
          kind: 'kv',
          tokens: [
            { t: 'text', v: 'Sisi', label: true },
            { t: 'text', v: ' : ' },
            { t: 'choice', id: nextId(), options: side, flag: false, single: false, prefix: '' },
          ],
        });
      }
      return;
    }
    if (!cur) openSection('');

    if (bullet) {
      push('bullet', annotate(tokenizeBody(flattenNested(line.slice(2)), nextId, variables)));
      return;
    }

    const [labelPart, valuePart] = kv;
    const forms = formsForLabel(labelPart);
    if (forms.length) {
      const labelText = labelPart.replace(/\s*\(\.{3,}\)%?/g, '').replace(/\s*sesuai lokasi/, '').replace(/[()]/g, '').trim();
      push('kv', [
        { t: 'text', v: labelText, label: true },
        { t: 'text', v: ' : ', sep: true },
        { t: 'form', id: nextId(), forms },
      ]);
      return;
    }
    const labelTokens = tokenizeBody(flattenNested(labelPart), nextId, variables).map((t) => (t.t === 'text' ? { ...t, label: true } : t));
    let valueTokens = tokenizeBody(flattenNested(valuePart), nextId, variables);
    const slots = valueTokens.filter((t) => t.t !== 'text' && t.t !== 'gopen' && t.t !== 'gclose');
    const zeroFive = ZERO_FIVE_RE.test(labelPart) || ZERO_FIVE_RE.test(cur.title);
    valueTokens = valueTokens.map((t) => {
      if (t.t !== 'free' || t.prefix || t.varKey) return t;
      if (zeroFive) return { ...t, t: 'scale', min: 0, max: 5, numeric: false };
      if (/Ashworth/i.test(cur.title)) return { t: 'choice', id: t.id, options: ASHWORTH, flag: false, single: true, prefix: '' };
      if (cur.valueOptions && slots.length === 1) return { t: 'choice', id: t.id, options: cur.valueOptions, flag: false, single: true, prefix: '' };
      return t;
    });
    push('kv', annotate([...labelTokens, { t: 'text', v: ' : ', sep: true }, ...valueTokens]));
  });

  const kept = sections.filter((sec) => sec.sentences.length);
  return kept.length ? { sections: kept, slotCount: counter } : null;
};

const parseCache = new Map();

export const parseTemplate = (text, variables = {}) => {
  if (!text) return null;
  const cacheKey = /\{\{/.test(text) ? `${text}\u0000${JSON.stringify(variables)}` : text;
  if (parseCache.has(cacheKey)) return parseCache.get(cacheKey);
  if (isListFormat(text)) {
    const listParsed = parseListTemplate(text, variables);
    parseCache.set(cacheKey, listParsed);
    return listParsed;
  }
  let counter = 0;
  const nextId = () => `v${counter++}`;
  const sections = [];
  let plain = 0;
  text.split('\n').forEach((line) => {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    // Template narasi: paragraf tanpa judul bagian ditampilkan sebagai paragraf biasa.
    if (!m && !line.trim()) return;
    const title = m ? m[1].trim() : '';
    const tokens = applySectionKind(annotate(tokenizeBody(m ? m[2] : line.trim(), nextId, variables)), title, nextId);
    sections.push({
      title,
      key: m ? title.toLowerCase() : `\u0000p${plain++}`,
      sentences: splitSentences(tokens).map((tok) => ({ tokens: tok })),
    });
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
  if (tok.t === 'form') return !!value && !!value.text;
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
    case 'form': return value.text;
    case 'choice':
      if (tok.wrap) return `(${value[0]})`;
      if (tok.flag) return value;
      return tok.prefix ? `(${tok.prefix}${joinList(value)})` : joinList(value);
    case 'duration': return `${value.n} ${value.unit || 'hari'}${tok.suffix}`;
    case 'date': return formatDateId(value);
    default: return `${tok.prefix || ''}${value.trim()}`;
  }
};

// ───────────────────────── Render ─────────────────────────

const isSlot = (t) => t.t !== 'text' && t.t !== 'gopen' && t.t !== 'gclose';

// Selesaikan kelompok [ ... ]: dibuang bila tak ada isian di dalamnya yang terisi.
const resolveGroups = (tokens, values) => {
  if (!tokens.some((t) => t.t === 'gopen')) return tokens;
  const root = [];
  const stack = [root];
  tokens.forEach((t) => {
    if (t.t === 'gopen') {
      const g = { group: [] };
      stack[stack.length - 1].push(g);
      stack.push(g.group);
    } else if (t.t === 'gclose' && stack.length > 1) {
      stack.pop();
    } else {
      stack[stack.length - 1].push(t);
    }
  });
  const flatten = (items) => items.flatMap((it) => {
    if (!it.group) return [it];
    const inner = flatten(it.group);
    return inner.some((x) => isSlot(x) && isFilled(x, values[x.id])) ? inner : [];
  });
  return flatten(root);
};

const renderSentence = (rawTokens, values, { plain = false } = {}) => {
  // Baris "Nama : isian": nama tes/gerakan selalu ikut tampil selama ada bagian isian yang terisi,
  // meski bagian lain (mis. derajat) kosong -> "Dorsofleksi : nyeri Ada".
  const sepIdx = rawTokens.findIndex((t) => t.sep);
  if (plain && sepIdx > 0 && !rawTokens.slice(0, sepIdx).some(isSlot)) {
    const tail = renderSentence(rawTokens.slice(sepIdx + 1), values, { plain });
    if (!tail) return null;
    return `${rawTokens.slice(0, sepIdx).map((t) => t.v).join('').trim()} : ${tail}`;
  }
  const tokens = resolveGroups(rawTokens, values);
  // Kalimat yang seluruh isiannya berada di kelompok yang gugur ikut dibuang.
  if (rawTokens.some(isSlot) && !tokens.some(isSlot)) return null;
  if (tokens.length === 1 && tokens[0].t === 'toggle') return values[tokens[0].id] === true ? tokens[0].text : null;
  const slots = tokens.filter(isSlot);
  if (slots.length === 0) return tokens.map((t) => t.v).join('').trim();
  if (!slots.some((t) => isFilled(t, values[t.id]))) return null;

  const clauses = [{ str: '', sep: '', drop: false, hasSlot: false, filled: 0 }];
  const cur = () => clauses[clauses.length - 1];
  let skipUnit = false;
  let skipSlash = false;

  tokens.forEach((tok) => {
    if (tok.t === 'text') {
      let v = tok.v;
      if (skipUnit) {
        v = v.replace(NUMERIC_UNIT_RE, '');
        skipUnit = false;
      }
      if (skipSlash) {
        v = v.replace(/^\//, '');
        skipSlash = false;
      }
      v.split(/(\s*\|\s*|[,;]\s+)/).forEach((piece, idx) => {
        if (idx % 2 === 1) {
          const bar = piece.includes('|');
          if (!bar && !cur().hasSlot) {
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
    cur().str = cur().str.replace(CONNECTOR_RE, '').replace(/\/\s*$/, '');
    if (tok.t === 'free' || tok.t === 'scale') cur().str = cur().str.replace(SIDE_RE, ' ');
    if ((tok.t === 'free' || tok.t === 'scale') && tok.numeric) skipUnit = true;
    skipSlash = true;
  });

  // Klausa yang punya isian tapi tak satu pun terisi (mis. "perjalanan") ikut dibuang.
  const kept = clauses.filter((c) => !c.drop && c.str.trim() && (!c.hasSlot || c.filled > 0));
  if (!kept.length) return null;
  let out = kept.map((c, i) => c.str.trim() + (i < kept.length - 1 ? (c.sep === '|' ? ' |' : c.sep) : '')).join(' ');
  out = out
    .replace(plain ? /\s+([.,;%])/g : /\s+([.,;:%])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;|]\s*$/, '')
    .trim();
  if (!out) return null;
  if (plain) {
    const last = rawTokens[rawTokens.length - 1];
    return last?.t === 'text' && /\.\s*$/.test(last.v) && !/[.!?]$/.test(out) ? `${out}.` : out;
  }
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return /[.!?]$/.test(out) ? out : `${out}.`;
};

const renderSections = (parsed, values) => {
  if (!parsed) return [];
  return parsed.sections
    .map((section) => ({
      title: section.title,
      key: section.key,
      layout: section.layout,
      sentences: section.sentences
        .map((s) => {
          const text = renderSentence(s.tokens, values, { plain: section.layout === 'lines' });
          return text && section.layout === 'lines' ? `- ${text}` : text;
        })
        .filter(Boolean),
    }))
    .filter((s) => s.sentences.length);
};

const joinSections = (sections, inline) => sections
  .map((s, idx) => {
    if (s.layout === 'lines') return s.title ? `${s.title}\n${s.sentences.join('\n')}` : s.sentences.join('\n');
    const body = s.sentences.join(' ');
    if (!s.title) return body;
    return idx === 0 && !inline ? `${s.title}:\n${body}` : `${s.title}: ${body}`;
  })
  .reduce((acc, part, idx) => {
    if (idx === 0) return part;
    return `${acc}${!sections[idx].title && !sections[idx - 1].title ? '\n\n' : '\n'}${part}`;
  }, '');

export const renderTemplate = (parsed, values, { inline = false } = {}) =>
  joinSections(renderSections(parsed, values), inline);

// Gabungkan beberapa diagnosa menjadi satu rangkaian: bagian bernama sama
// (mis. "Keluhan Utama") disatukan, kalimat kembar dibuang.
// entries: [{ parsed, values }]
export const renderMergedTemplates = (entries, { inline = false } = {}) => {
  const order = [];
  const byTitle = new Map();
  entries.forEach(({ parsed, values }) => {
    renderSections(parsed, values).forEach((section) => {
      const key = section.key || section.title.toLowerCase();
      if (!byTitle.has(key)) {
        byTitle.set(key, { title: section.title, layout: section.layout, sentences: [] });
        order.push(key);
      }
      const target = byTitle.get(key);
      section.sentences.forEach((sentence) => {
        if (!target.sentences.includes(sentence)) target.sentences.push(sentence);
      });
    });
  });
  return joinSections(order.map((k) => byTitle.get(k)), inline);
};

// Jumlah isian yang sudah terisi / total (indikator progres).
export const countProgress = (parsed, values) => {
  let filled = 0;
  let total = 0;
  parsed?.sections.forEach((s) => s.sentences.forEach((sn) => sn.tokens.forEach((tok) => {
    if (!isSlot(tok)) return;
    total += 1;
    if (isFilled(tok, values[tok.id])) filled += 1;
  })));
  return { filled, total };
};
