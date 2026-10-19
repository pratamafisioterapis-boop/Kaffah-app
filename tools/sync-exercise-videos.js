#!/usr/bin/env node

// Sinkronkan folder video latihan di Mac ke aplikasi, dengan NAMA FILE sebagai acuan.
//
//   node --env-file=.env tools/sync-exercise-videos.js plan  ~/Videos/latihan   -> buat video-mapping.csv (tidak mengubah apa pun)
//   (periksa/ubah video-mapping.csv bila perlu)
//   node --env-file=.env tools/sync-exercise-videos.js apply ~/Videos/latihan   -> ganti nama, buat latihan baru, unggah video
//
// Butuh di .env (JANGAN di-commit): SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.
// Nama latihan di aplikasi diubah mengikuti nama file. Kolom lain (cara melakukan, dosis, dst.) tidak disentuh;
// latihan baru dibuat dengan kolom itu kosong dan bisa diisi nanti lewat tombol Edit di halaman Video Latihan.

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { nextExerciseCode, prefixOf, generatePrefix } from '../src/lib/exerciseCodes.js';

const BUCKET = 'exercise-videos';
const MAX_BYTES = 200 * 1024 * 1024;
const MAP_FILE = 'video-mapping.csv';
const DEFAULT_GROUP = 'Lainnya';
const TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v' };
const SIMILAR_MIN = 0.6;

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
const nameFromFile = (file) => path.parse(file).name.normalize('NFC').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

const bigrams = (s) => {
  const t = norm(s).replace(/ /g, '');
  const out = new Map();
  for (let i = 0; i < t.length - 1; i += 1) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1);
  return out;
};
// Kemiripan Dice dua nama (0..1).
export const similarity = (a, b) => {
  const x = bigrams(a); const y = bigrams(b);
  let inter = 0; let total = 0;
  x.forEach((n, k) => { inter += Math.min(n, y.get(k) || 0); total += n; });
  y.forEach((n) => { total += n; });
  return total ? (2 * inter) / total : 0;
};

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const parseCsv = (text) => {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
};

const listVideos = (dir) => fs.readdirSync(dir)
  .filter((f) => !f.startsWith('.') && TYPES[path.extname(f).slice(1).toLowerCase()])
  .sort((a, b) => a.localeCompare(b));

const client = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di file .env (jalankan dengan: node --env-file=.env ...).');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
};

const plan = async (dir) => {
  const db = client();
  const { data: exercises, error } = await db.from('plan_exercises').select('id, name, grp').order('id');
  if (error) throw error;
  const taken = new Set();
  const rows = [];
  const files = listVideos(dir);
  // Kecocokan nama persis dulu, supaya nama yang sudah sama tidak "dicuri" oleh kecocokan mirip.
  const exact = new Map(exercises.map((e) => [norm(e.name), e]));
  const pending = [];
  files.forEach((file) => {
    const name = nameFromFile(file);
    const hit = exact.get(norm(name));
    if (hit && !taken.has(hit.id)) { taken.add(hit.id); rows.push({ file, aksi: 'SAMA', kode: hit.id, nama_lama: hit.name, nama_baru: name, kelompok: hit.grp || '' }); }
    else pending.push({ file, name });
  });
  pending.forEach(({ file, name }) => {
    let best = null;
    exercises.forEach((e) => {
      if (taken.has(e.id)) return;
      const s = similarity(name, e.name);
      if (!best || s > best.s) best = { e, s };
    });
    if (best && best.s >= SIMILAR_MIN) {
      taken.add(best.e.id);
      rows.push({ file, aksi: 'GANTI-NAMA', kode: best.e.id, nama_lama: best.e.name, nama_baru: name, kelompok: best.e.grp || '' });
    } else rows.push({ file, aksi: 'BARU', kode: '', nama_lama: '', nama_baru: name, kelompok: DEFAULT_GROUP });
  });
  rows.sort((a, b) => a.file.localeCompare(b.file));
  const cols = ['file', 'aksi', 'kode', 'nama_lama', 'nama_baru', 'kelompok'];
  fs.writeFileSync(MAP_FILE, `${cols.join(',')}\n${rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')).join('\n')}\n`);
  const count = (a) => rows.filter((r) => r.aksi === a).length;
  console.log(`${files.length} video dibaca. Hasil di ${MAP_FILE}:`);
  console.log(`  SAMA        ${count('SAMA')}  (nama sudah sama, hanya unggah video)`);
  console.log(`  GANTI-NAMA  ${count('GANTI-NAMA')}  (cocok dengan latihan lama, nama diubah mengikuti file)`);
  console.log(`  BARU        ${count('BARU')}  (tidak ada padanan, dibuat sebagai latihan baru)`);
  console.log('Buka CSV di Numbers/Excel. Perbaiki kolom "kode" bila padanannya salah (kosongkan = BARU). Lalu jalankan "apply".');
};

const readDuration = () => null; // Node tidak membaca durasi video; kolom dibiarkan kosong.

const apply = async (dir) => {
  if (!fs.existsSync(MAP_FILE)) throw new Error(`${MAP_FILE} belum ada. Jalankan "plan" dulu.`);
  const db = client();
  const rows = parseCsv(fs.readFileSync(MAP_FILE, 'utf8'));
  const { data: exercises, error } = await db.from('plan_exercises').select('id, name');
  if (error) throw error;
  const { data: assets, error: aErr } = await db.from('exercise_video_assets').select('exercise_id, storage_path');
  if (aErr) throw aErr;
  const oldPath = Object.fromEntries(assets.map((a) => [a.exercise_id, a.storage_path]));
  const known = new Set(exercises.map((e) => e.id));
  const ids = exercises.map((e) => e.id);
  const used = new Set(ids.map(prefixOf).filter(Boolean));

  // Pemeriksaan sebelum menyentuh apa pun: kode ganda, kode tak dikenal, file hilang.
  const seen = new Map();
  const problems = [];
  rows.forEach((r) => {
    if (!fs.existsSync(path.join(dir, r.file))) problems.push(`File tidak ada di folder: ${r.file}`);
    if (r.kode) {
      if (!known.has(r.kode)) problems.push(`Kode ${r.kode} tidak ada di aplikasi (${r.file})`);
      if (seen.has(r.kode)) problems.push(`Kode ${r.kode} dipakai dua file: ${seen.get(r.kode)} dan ${r.file}`);
      seen.set(r.kode, r.file);
    }
    if (!r.nama_baru || r.nama_baru.length < 3) problems.push(`Nama terlalu pendek: ${r.file}`);
  });
  if (problems.length) { console.error(`Berhenti, ${problems.length} masalah di ${MAP_FILE}:\n- ${problems.join('\n- ')}`); process.exit(1); }

  let ok = 0; const failed = [];
  for (const r of rows) {
    try {
      const full = path.join(dir, r.file);
      const size = fs.statSync(full).size;
      if (size > MAX_BYTES) throw new Error('lebih dari 200 MB');
      // Pada percobaan ulang, latihan BARU yang sudah sempat dibuat dipakai lagi (dicocokkan lewat nama), bukan dibuat ganda.
      let id = r.kode || exercises.find((x) => norm(x.name) === norm(r.nama_baru))?.id;
      if (!id) {
        const prefix = generatePrefix(r.nama_baru, used);
        if (!prefix) throw new Error('tidak bisa membuat awalan kode');
        used.add(prefix);
        id = nextExerciseCode(prefix, ids);
        const { error: e } = await db.from('plan_exercises').insert({ id, name: r.nama_baru, grp: r.kelompok || DEFAULT_GROUP });
        if (e) throw e;
        ids.push(id);
        exercises.push({ id, name: r.nama_baru });
      } else if (exercises.find((x) => x.id === id)?.name !== r.nama_baru) {
        const { error: e } = await db.from('plan_exercises').update({ name: r.nama_baru }).eq('id', id);
        if (e) throw e;
      }
      const ext = path.extname(r.file).slice(1).toLowerCase();
      const storagePath = `${id}.${ext}`;
      const { error: uErr } = await db.storage.from(BUCKET).upload(storagePath, fs.readFileSync(full), { upsert: true, contentType: TYPES[ext] });
      if (uErr) throw uErr;
      const { error: dErr } = await db.from('exercise_video_assets').upsert(
        { exercise_id: id, storage_path: storagePath, duration_seconds: readDuration(full), size_bytes: size },
        { onConflict: 'exercise_id' },
      );
      if (dErr) throw dErr;
      if (oldPath[id] && oldPath[id] !== storagePath) await db.storage.from(BUCKET).remove([oldPath[id]]);
      ok += 1;
      console.log(`OK  ${id}  ${r.nama_baru}`);
    } catch (e) {
      failed.push(`${r.file}: ${e.message}`);
      console.error(`GAGAL  ${r.file}: ${e.message}`);
    }
  }
  console.log(`\nSelesai: ${ok} berhasil, ${failed.length} gagal.`);
  if (failed.length) console.log('Jalankan "apply" lagi untuk mencoba ulang yang gagal; yang sudah berhasil aman ditimpa.');
};

const main = async () => {
  const [cmd, dirArg] = process.argv.slice(2);
  const dir = dirArg && path.resolve(dirArg.replace(/^~(?=$|\/)/, process.env.HOME || '~'));
  if (!['plan', 'apply'].includes(cmd) || !dir || !fs.existsSync(dir)) {
    console.error('Pakai: node --env-file=.env tools/sync-exercise-videos.js <plan|apply> <folder video>');
    process.exit(1);
  }
  await (cmd === 'plan' ? plan(dir) : apply(dir));
};

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message || e); process.exit(1); });
