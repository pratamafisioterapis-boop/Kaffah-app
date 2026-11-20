#!/usr/bin/env node
// Knowledge AI WhatsApp disimpan di database (wa_ai_settings.knowledge_override) supaya bisa
// diperbarui tanpa deploy ulang fungsi wa-ai-reply. Sumber kebenarannya docs/AI_KNOWLEDGE_KAFFAH.md.
//
// Jalankan setelah dokumen diubah: node tools/sync-ai-knowledge.js
// Hasilnya supabase/.temp-knowledge.sql (tidak di-commit); jalankan isinya di SQL Editor Supabase.
// supabase/functions/_shared/wa_ai_knowledge.ts hanya cadangan singkat bila kolom itu kosong.
import fs from 'fs';

const src = 'docs/AI_KNOWLEDGE_KAFFAH.md';
const md = fs.readFileSync(src, 'utf8');
const tag = '$' + 'kk' + '$';
if (md.includes(tag)) throw new Error('dokumen memuat penanda kutip SQL');
const sqlPath = 'supabase/.temp-knowledge.sql';
fs.writeFileSync(
  sqlPath,
  `update public.wa_ai_settings set knowledge_override = ${tag}${md}${tag}, updated_at = now();\n`,
);
console.log(`ok: ${sqlPath} (${md.length} karakter)`);
