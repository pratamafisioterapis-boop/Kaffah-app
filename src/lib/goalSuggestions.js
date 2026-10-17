// Saran goal treatment dari Subjective/Objective yang sudah diisi terapis.
// Deterministik (tanpa jaringan). Jalur utama membaca format template (Inspeksi / Palpasi / Pemeriksaan Gerak /
// Kekuatan Otot / Tes Spesifik / Pengukuran, plus "Update Kondisi" di sesi lanjutan), sehingga tiap temuan
// langsung menjadi target yang terukur. Bila teks bukan hasil template dan hasilnya sedikit, dilengkapi dengan
// analyzeIcf. Terapis tinggal memilih, dan teksnya bisa diedit.
import { analyzeIcf } from '@/lib/icfAssessment';

const MAX_SUGGESTIONS = 12;

const detailOf = (item, re) => {
  for (const d of item.details || []) {
    const m = String(d).match(re);
    if (m) return m;
  }
  return null;
};

// Frasa aktivitas dalam bahasa awam, menurut kode ICF d-nya.
const ACTIVITY_PHRASE = {
  d450: 'berjalan jauh tanpa nyeri',
  d4551: 'naik dan turun tangga tanpa nyeri',
  d4552: 'berlari tanpa nyeri',
  d410: 'bangkit dari duduk dan berubah posisi tanpa nyeri',
  d4105: 'membungkuk tanpa nyeri',
  d4101: 'berjongkok tanpa nyeri',
  d4102: 'berlutut tanpa nyeri',
  d4153: 'duduk lama tanpa keluhan',
  d4154: 'berdiri lama tanpa keluhan',
  d420: 'berpindah tempat secara mandiri',
  d4300: 'mengangkat beban tanpa nyeri',
  d4401: 'menggenggam dan memegang benda tanpa nyeri',
  d4452: 'menjangkau dan mengangkat tangan tanpa nyeri',
  d510: 'mandi secara mandiri',
  d530: 'menggunakan toilet secara mandiri',
  d540: 'berpakaian secara mandiri',
  d550: 'makan secara mandiri',
  d630: 'menyiapkan makanan tanpa keluhan',
  d640: 'mengerjakan pekerjaan rumah tanpa keluhan',
  d230: 'melakukan aktivitas sehari-hari secara mandiri',
  d4751: 'berkendara tanpa keluhan',
  d850: 'bekerja kembali tanpa keluhan',
  d9201: 'berolahraga kembali tanpa nyeri',
  d930: 'beribadah (sholat) dengan nyaman tanpa nyeri',
  d910: 'mengikuti kegiatan sosial tanpa keluhan',
};

const add2 = (arr, t) => { if (!arr.includes(t)) arr.push(t); };
const halve = (n) => (n >= 3 ? Math.ceil(n / 2) : 1);


// ───────────────────────── Jalur template ─────────────────────────

const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const NEGATIVE = /\b(tidak|normal|simetris|tanpa)\b/i;

// Bagian Objective template: judul bagian tanpa "- ", isinya baris "- label : nilai".
const SECTION_RE = /^(Inspeksi|Palpasi|Pemeriksaan Gerak|Kekuatan Otot|Tes Spesifik|Pengukuran)\s*:?\s*$/i;
const parseObjective = (text) => {
  const sections = {};
  let cur = null;
  String(text || '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const head = line.match(SECTION_RE);
    if (head) { cur = head[1].toLowerCase(); sections[cur] = sections[cur] || []; return; }
    if (cur && line.startsWith('-')) sections[cur].push(line.replace(/^-\s*/, '').trim());
  });
  return sections;
};

const splitList = (t) => t.split(/,|\bserta\b|\bdan\b|\bmaupun\b/i).map((x) => x.trim()).filter(Boolean);

const painRegion = (subjective) => {
  const m = String(subjective || '').match(/keluhan nyeri ([\p{L} ]{3,40}?) (?:saat|yang|sejak|dirasakan|akibat|setelah|karena|dan|,)/iu);
  const r = m ? m[1].trim() : '';
  return r && r.split(/\s+/).length <= 5 ? r : '';
};

const templateGoals = (subjective, objective) => {
  const sec = parseObjective(objective);
  const found = Object.keys(sec).length > 0;
  const out = [];
  const add = (t) => { if (t && !out.includes(t)) out.push(t); };
  const where = painRegion(subjective);
  const nyeri = where ? `Nyeri ${where}` : 'Nyeri';

  // Nyeri: NPRS di Pengukuran
  const nprs = (sec.pengukuran || []).map((l) => l.match(/^(?:NPRS|NRS|VAS)[^:]*:\s*(\d{1,2})\s*\/\s*10/i)).find(Boolean);
  // Sesi lanjutan: nilai terkini dari baris "Update Kondisi" lebih tepat sebagai titik awal target.
  const now = String(objective || '').match(/Update Kondisi:[^\n]*?nyeri sekarang\s*(\d{1,2})\s*\/\s*10/i);
  if (nprs) {
    const n = Number(now ? now[1] : nprs[1]);
    add(`${nyeri} turun dari ${n}/10 menjadi ≤${halve(n)}/10`);
    if (halve(n) > 2) add(`${nyeri} ≤2/10 saat beraktivitas sehari-hari`);
  } else if (found || /\bnyeri\b/i.test(subjective)) {
    add(`${nyeri} berkurang menjadi ≤2/10 saat beraktivitas`);
  }

  // Lingkup gerak
  const rom = [];
  (sec['pemeriksaan gerak'] || []).forEach((l) => {
    const m = l.match(/^(.+?)\s*:\s*(.+)$/);
    if (!m || /end-?feel|memprovokasi/i.test(m[1])) return;
    const deg = m[2].match(/(\d{1,3})\s*derajat/i);
    if (deg) rom.push(`Lingkup gerak ${lc(m[1])} meningkat dari ${deg[1]}° hingga penuh tanpa nyeri`);
    else if (/terbatas/i.test(m[2])) rom.push(`Lingkup gerak ${lc(m[1])} meningkat hingga penuh tanpa nyeri`);
    else if (/\bpenuh\b/i.test(m[2]) && /nyeri\s+ada/i.test(m[2])) rom.push(`Gerak ${lc(m[1])} bebas nyeri`);
  });
  rom.slice(0, 3).forEach(add);

  // Kekuatan otot
  (sec['kekuatan otot'] || []).map((l) => l.match(/^Kekuatan (.+?)\s*\(0-5\)\s*:\s*([0-5])/i)).filter(Boolean)
    .filter((m) => Number(m[2]) < 5).slice(0, 3)
    .forEach((m) => add(`Kekuatan ${lc(m[1])} meningkat dari ${m[2]}/5 menjadi ${Math.min(5, Number(m[2]) + 1)}/5`));

  // Tes spesifik: yang positif menjadi negatif
  const positives = [];
  const others = [];
  (sec['tes spesifik'] || []).forEach((l) => {
    const m = l.match(/^(.+?)\s*:\s*(.+)$/);
    if (!m) return;
    if (/positif/i.test(m[2])) positives.push(m[1].trim());
    else if (/^ada\b/i.test(m[2].trim())) others.push(`${m[1].trim()} berkurang`);
  });
  if (positives.length) add(`Tes ${positives.slice(0, 3).join(', ')} menjadi negatif`);
  others.slice(0, 2).forEach(add);

  // Pengukuran lingkar segmen (bengkak)
  (sec.pengukuran || []).forEach((l) => { if (/lingkar/i.test(l)) add(`Selisih ${lc(l.split(':')[0].trim())} berkurang menuju sisi sehat`); });

  // Palpasi
  (sec.palpasi || []).forEach((l) => {
    const tense = l.match(/peningkatan ketegangan pada (?:otot-otot |otot )?(.+?)\.?$/i);
    if (tense) {
      const muscles = splitList(tense[1]).slice(0, 3).join(', ');
      add(`Ketegangan otot ${muscles} berkurang`);
    }
    const tender = l.match(/^Nyeri tekan pada (?:area )?(.+?)\.?$/i);
    if (tender && tender[1].length <= 70) add(`Nyeri tekan pada ${tender[1]} berkurang`);
  });

  // Inspeksi
  (sec.inspeksi || []).forEach((l) => {
    if (NEGATIVE.test(l) || !/ditemukan|tampak/i.test(l)) return;
    if (/bengkak|pembengkakan/i.test(l)) add('Bengkak berkurang hingga hilang');
    else if (/atrofi/i.test(l)) add('Massa otot yang mengecil (atrofi) membaik');
    else if (/protracted|forward head|asimetris|lordosis|kifosis|skoliosis|lateral shift/i.test(l)) add('Postur tubuh membaik dan lebih simetris');
    else if (/gaya jalan|pincang|antalgik/i.test(l)) add('Pola jalan kembali normal tanpa pincang');
  });

  // Subjective: aktivitas yang sulit dilakukan, tidur, kesemutan
  const sub = String(subjective || '');
  const hard = sub.match(/kesulitan saat ([^.]+)/i);
  if (hard) splitList(hard[1]).slice(0, 3).forEach((a) => add(`Mampu ${lc(a)} tanpa nyeri`));
  if (/\b(terbangun|tidur terganggu|sulit tidur|susah tidur)\b/i.test(sub) && !/tidak (?:ada )?(?:terbangun|gangguan tidur)/i.test(sub)) add('Tidur tidak lagi terganggu oleh nyeri');
  if (/terdapat keluhan (?:baal|kesemutan)/i.test(sub) && !/tidak terdapat keluhan (?:baal|kesemutan)/i.test(sub)) add('Kesemutan/baal berkurang secara bertahap');
  return out;
};

/**
 * @returns {string[]} kalimat goal siap pakai (tanpa duplikat, maksimal 8), yang paling relevan lebih dulu.
 */
export const suggestGoals = ({ subjective = '', objective = '', diagnoses = [] } = {}) => {
  if (!String(objective).trim() && !String(subjective).trim() && !diagnoses.length) return [];
  const out = templateGoals(subjective, objective);
  // Teks bebas (bukan template) atau template yang tipis: lengkapi dari analisis ICF.
  if (out.length >= 4) {
    add2(out, 'Pasien mampu melakukan program latihan di rumah secara mandiri dan rutin');
    add2(out, 'Kembali ke aktivitas sehari-hari tanpa keluhan');
    return out.slice(0, MAX_SUGGESTIONS);
  }
  const icf = analyzeIcf({ subjective, objective, diagnoses });
  const add = (t) => { if (t && !out.includes(t)) out.push(t); };
  const has = (code) => icf.b.find((x) => x.code === code);

  // Nyeri
  const pain = icf.b.find((x) => x.code.startsWith('b280'));
  if (pain) {
    const max = detailOf(pain, /tertinggi (\d{1,2}(?:\.\d)?)\/10/);
    const area = detailOf(pain, /^area: (.+)$/);
    const where = area && !/,/.test(area[1]) ? ` ${area[1]}` : '';
    if (max) {
      const n = Math.round(Number(max[1]));
      add(`Nyeri${where} turun dari ${n}/10 menjadi ≤${halve(n)}/10`);
      if (n >= 4) add(`Nyeri${where} ≤2/10 saat beraktivitas sehari-hari`);
    } else {
      add(`Nyeri${where} berkurang menjadi ≤2/10 saat beraktivitas`);
    }
  }

  // Lingkup gerak
  const rom = has('b7100') || has('b7101');
  if (rom) {
    const sendi = detailOf(rom, /^ROM (.+) terbatas$/);
    add(`Lingkup gerak ${sendi && !/,/.test(sendi[1]) ? sendi[1] : 'sendi'} meningkat hingga penuh tanpa nyeri`);
  }

  // Kekuatan otot
  const power = has('b7300');
  if (power) {
    const mmt = detailOf(power, /MMT terendah (\d)\/5/);
    const part = detailOf(power, /^otot (.+)$/);
    const target = mmt ? Math.min(5, Number(mmt[1]) + 1) : 4;
    add(`Kekuatan otot${part && !/,/.test(part[1]) ? ` ${part[1]}` : ''} meningkat ke MMT ≥${Math.max(target, 4)}/5`);
  }

  // Kekakuan, ketegangan, bengkak, jalan, keseimbangan, tidur
  if (has('b7801') || has('b735')) add('Ketegangan otot berkurang sehingga gerak terasa ringan');
  if (has('b7800')) add('Kekakuan sendi/otot berkurang, terutama saat bangun tidur');
  if (has('b4352')) add('Bengkak berkurang dan lingkar segmen mendekati sisi sehat');
  if (has('b770')) add('Pola jalan kembali normal tanpa pincang');
  if (has('b2351') || has('b755')) add('Keseimbangan membaik dan risiko jatuh menurun');
  if (has('b840') || has('b265')) add('Kesemutan/baal berkurang secara bertahap');
  if (has('b134')) add('Tidur tidak lagi terganggu oleh nyeri');
  if (has('b152')) add('Pasien percaya diri bergerak dan tidak takut bergerak');

  // Skor fungsional
  (icf.functional || []).forEach((f) => {
    const now = Math.round(f.pct);
    if (now >= 10) add(`Skor ${f.name} turun dari ${now}% menjadi ≤${Math.max(5, Math.round(now / 2 / 5) * 5)}%`);
  });

  // Aktivitas yang terganggu
  icf.d.forEach((x) => { if (ACTIVITY_PHRASE[x.code]) add(`Mampu ${ACTIVITY_PHRASE[x.code]}`); });

  // Penutup umum, selalu relevan untuk home program
  if (out.length) {
    add('Pasien mampu melakukan program latihan di rumah secara mandiri dan rutin');
    add('Kembali ke aktivitas sehari-hari tanpa keluhan');
  }
  return out.slice(0, MAX_SUGGESTIONS);
};
