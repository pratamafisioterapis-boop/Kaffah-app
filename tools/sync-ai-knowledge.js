#!/usr/bin/env node
// Menyalin docs/AI_KNOWLEDGE_KAFFAH.md ke supabase/functions/_shared/wa_ai_knowledge.ts
// supaya fungsi edge (yang tidak bisa membaca folder docs saat berjalan) memakai knowledge
// yang sama. Jalankan ulang setiap kali dokumen diubah: node tools/sync-ai-knowledge.js
import fs from 'fs';

const src = 'docs/AI_KNOWLEDGE_KAFFAH.md';
const dst = 'supabase/functions/_shared/wa_ai_knowledge.ts';
const md = fs.readFileSync(src, 'utf8');
fs.writeFileSync(
  dst,
  `// DIHASILKAN OTOMATIS dari ${src} oleh tools/sync-ai-knowledge.js. Jangan edit manual.\n` +
    `export const KAFFAH_KNOWLEDGE = ${JSON.stringify(md)};\n`,
);
console.log(`ok: ${dst} (${md.length} karakter)`);
