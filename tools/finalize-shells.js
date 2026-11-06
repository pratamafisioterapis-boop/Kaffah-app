#!/usr/bin/env node
// Runs last in the build. Vercel serves a static file that matches the request
// path BEFORE applying vercel.json rewrites, so while dist/index.html exists,
// "/" on clinara.id always returned the Kaffah-branded HTML (title/og:image)
// and the host rewrite to index-clinara.html never fired. That is what link
// previews (Instagram/WhatsApp, which don't run JS) showed: the Kaffah logo.
// Renaming it to index-kaffah.html removes the static match so every path
// goes through the host-based rewrites in vercel.json.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const src = path.join(dist, 'index.html');
if (!fs.existsSync(src)) {
  console.warn('[finalize-shells] dist/index.html not found, skipping.');
  process.exit(0);
}
fs.renameSync(src, path.join(dist, 'index-kaffah.html'));
console.log('[finalize-shells] index.html -> index-kaffah.html');
