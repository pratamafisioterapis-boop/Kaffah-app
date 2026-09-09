#!/usr/bin/env node
// Runs after `vite build`. Clones dist/index.html into dist/index-clinara.html
// with the head's brand meta swapped to Clinara, so clinara.id gets the right
// <title>/favicon/og tags in the initial HTML response rather than waiting on
// react-helmet to patch them in after JS hydrates (which caused a visible
// flash of "Kaffah Physiotherapy" in the browser tab). vercel.json rewrites
// clinara.id/www.clinara.id requests to this file instead of index.html; the
// script/link tags Vite injected (hashed JS/CSS) are left untouched since
// both domains share the same app bundle.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const srcPath = path.join(distDir, 'index.html');
const outPath = path.join(distDir, 'index-clinara.html');

if (!fs.existsSync(srcPath)) {
  console.warn('[generate-clinara-shell] dist/index.html not found, skipping.');
  process.exit(0);
}

// Root-relative for tags the browser itself resolves (favicon, apple-touch-icon,
// manifest icons) - same-origin, no extra DNS/CORS hop. Absolute for og:image/
// twitter:image, which social-media scrapers fetch directly and can't resolve
// a relative URL for.
const CLINARA_LOGO_PATH = '/clinara-logo.png';
const CLINARA_LOGO_ABSOLUTE_URL = 'https://clinara.id/clinara-logo.png';

let html = fs.readFileSync(srcPath, 'utf8');

const replacements = [
  [/<link rel="icon" type="image\/x-icon" href="\/favicon\.ico\?v=kaffahtech1" \/>/, `<link rel="icon" type="image/png" href="${CLINARA_LOGO_PATH}" />`],
  [/<meta name="theme-color" content="#1e3a5f" \/>/, '<meta name="theme-color" content="#0f2a4a" />'],
  [/<link rel="manifest" href="\/manifest\.json" \/>/, '<link rel="manifest" href="/manifest-clinara.json" />'],
  [/<meta name="apple-mobile-web-app-title" content="Kaffah Physiotherapy" \/>/, '<meta name="apple-mobile-web-app-title" content="Clinara" />'],
  [/<link rel="apple-touch-icon" href="\/logo192\.png\?v=kaffahtech1" \/>/, `<link rel="apple-touch-icon" href="${CLINARA_LOGO_PATH}" />`],
  [/<title>Kaffah Physiotherapy - Klinik Fisioterapi Terpercaya di Balikpapan<\/title>/, '<title>Clinara — Better Care. Smarter Management.</title>'],
  [/<meta name="description" content="Kaffah Physiotherapy adalah klinik fisioterapi[^"]*" \/>/, '<meta name="description" content="Clinara adalah Healthcare Management Platform yang membantu klinik dan pusat terapi mengelola pasien, tenaga kesehatan, jadwal, layanan, komunikasi, dan data dalam satu sistem terintegrasi." />'],
  [/<meta property="og:site_name" content="Kaffah Physiotherapy" \/>/, '<meta property="og:site_name" content="Clinara" />'],
  [/<meta property="og:url" content="https:\/\/kaffahphysio\.id\/" \/>/, '<meta property="og:url" content="https://clinara.id/" />'],
  [/<meta property="og:title" content="Kaffah Physiotherapy - Klinik Fisioterapi Terpercaya di Balikpapan" \/>/, '<meta property="og:title" content="Clinara — Better Care. Smarter Management." />'],
  [/<meta property="og:description" content="Klinik fisioterapi di Batu Ampar[^"]*" \/>/, '<meta property="og:description" content="Platform manajemen layanan kesehatan untuk klinik dan pusat terapi." />'],
  [/<meta property="og:image" content="https:\/\/kaffahphysio\.id\/logo512\.png" \/>\s*\n\s*<meta property="og:image:width" content="512" \/>\s*\n\s*<meta property="og:image:height" content="512" \/>/, `<meta property="og:image" content="${CLINARA_LOGO_ABSOLUTE_URL}" />`],
  [/<meta name="twitter:image" content="https:\/\/kaffahphysio\.id\/logo512\.png" \/>/, `<meta name="twitter:image" content="${CLINARA_LOGO_ABSOLUTE_URL}" />`],
];

let missed = [];
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(html)) {
    missed.push(pattern.toString());
    continue;
  }
  html = html.replace(pattern, replacement);
}

if (missed.length) {
  console.warn('[generate-clinara-shell] Some expected tags were not found (index.html may have changed):');
  missed.forEach((m) => console.warn('  -', m));
}

fs.writeFileSync(outPath, html);
console.log('[generate-clinara-shell] Wrote dist/index-clinara.html');
