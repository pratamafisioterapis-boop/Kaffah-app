#!/usr/bin/env node
// Runs after generate-clinara-shell. Link /p/<token> dikirim lewat WhatsApp,
// dan crawler pratinjau tidak menjalankan JS, jadi og:image harus sudah ada
// di HTML awal. Dibuat dua salinan shell dengan meta pratinjau berupa gambar
// layar masuk portal: index-portal.html (kaffahphysio.id, logo Kaffah) dan
// index-portal-clinara.html (domain lain: clinara.id, subdomain, custom domain).
// vercel.json mengarahkan /p/:token ke salah satunya.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const VARIANTS = [
  {
    src: 'index.html',
    out: 'index-portal.html',
    origin: 'https://kaffahphysio.id',
    image: 'portal-preview-kaffah.png',
    title: 'Pemulihan Anda ada di sini · Kaffah Physiotherapy',
    description: 'Masukkan tanggal lahir Anda untuk melihat perkembangan terapi di Kaffah Physiotherapy.',
  },
  {
    src: 'index-clinara.html',
    out: 'index-portal-clinara.html',
    origin: 'https://clinara.id',
    image: 'portal-preview-clinara.png',
    title: 'Pemulihan Anda ada di sini · Clinara',
    description: 'Masukkan tanggal lahir Anda untuk melihat perkembangan terapi Anda.',
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const v of VARIANTS) {
  const srcPath = path.join(distDir, v.src);
  if (!fs.existsSync(srcPath)) {
    console.error(`[generate-portal-shell] dist/${v.src} not found.`);
    process.exit(1);
  }
  const img = `${v.origin}/${v.image}`;
  const replacements = [
    [/<title>[^<]*<\/title>/, `<title>${esc(v.title)}</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(v.description)}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(v.title)}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(v.description)}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${v.origin}/" />`],
    [
      /<meta property="og:image" content="[^"]*" \/>(?:\s*\n\s*<meta property="og:image:(?:width|height)" content="\d+" \/>)*/,
      `<meta property="og:image" content="${img}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`,
    ],
    [/<meta name="twitter:card" content="[^"]*" \/>/, '<meta name="twitter:card" content="summary_large_image" />'],
    [/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${img}" />`],
  ];
  let html = fs.readFileSync(srcPath, 'utf8');
  const missed = [];
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(html)) { missed.push(pattern.toString()); continue; }
    html = html.replace(pattern, replacement);
  }
  if (missed.length) {
    console.error(`[generate-portal-shell] Tag tidak ditemukan di dist/${v.src}:`);
    missed.forEach((m) => console.error('  -', m));
    process.exit(1);
  }
  fs.writeFileSync(path.join(distDir, v.out), html);
  console.log(`[generate-portal-shell] Wrote dist/${v.out}`);
}
