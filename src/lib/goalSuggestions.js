// Saran goal treatment dari diagnosa + Subjective/Objective yang sudah diisi terapis.
// Deterministik (tanpa jaringan): memakai hasil analyzeIcf (nyeri, ROM, kekuatan, kekakuan, aktivitas, skor
// fungsional) lalu menyusun kalimat target yang terukur. Terapis tinggal memilih, dan teksnya bisa diedit.
import { analyzeIcf } from '@/lib/icfAssessment';

const MAX_SUGGESTIONS = 8;

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

const halve = (n) => (n >= 6 ? Math.ceil(n / 2) : n >= 3 ? 2 : 1);

/**
 * @returns {string[]} kalimat goal siap pakai (tanpa duplikat, maksimal 8), yang paling relevan lebih dulu.
 */
export const suggestGoals = ({ subjective = '', objective = '', diagnoses = [] } = {}) => {
  if (!String(objective).trim() && !String(subjective).trim() && !diagnoses.length) return [];
  const icf = analyzeIcf({ subjective, objective, diagnoses });
  const out = [];
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
