/* global process */
// Pratinjau tautan (WhatsApp, Telegram, dll.) untuk halaman publik /i/:id.
//
// Aplikasi ini SPA: crawler tidak menjalankan JavaScript, jadi tanpa fungsi ini semua tautan
// membawa gambar/judul bawaan situs (mis. logo Clinara). vercel.json hanya mengarahkan permintaan
// dari crawler ke sini; pengunjung biasa tetap dilayani SPA seperti sebelumnya.
//
// Fungsi mengambil index.html yang sama dengan yang dilayani untuk host itu, lalu mengganti
// tag Open Graph dengan judul klinik dan gambar pratinjau kwitansi (<nama-pdf>.jpg di Storage).

export const config = { maxDuration: 10 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dqkejdamagvlhqvxaqej.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxa2VqZGFtYWd2bGhxdnhhcWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjU1NjYsImV4cCI6MjA4MTMwMTU2Nn0.Fcp8V1AKY9ugjChUZC_b1zPpVw4BJTlMYCD3N16sXH8';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const fetchInvoice = async (id) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_invoice_url`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.pgrst.object+json',
    },
    body: JSON.stringify({ p_recap_id: id }),
  });
  if (!res.ok) return null;
  return res.json();
};

const exists = async (url) => {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
};

// Tombol Kirim Manual membuka WhatsApp lebih dulu, sementara PDF dan gambar pratinjau masih
// diunggah. Crawler biasanya datang beberapa detik setelah pesan dikirim, jadi beri waktu singkat.
const waitForPreview = async (id) => {
  let invoice = null;
  let imageUrl = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    invoice = await fetchInvoice(id);
    if (invoice?.invoice_url) {
      const candidate = invoice.invoice_url.replace(/\.pdf(\?.*)?$/i, '.jpg');
      if (candidate !== invoice.invoice_url && await exists(candidate)) {
        imageUrl = candidate;
        break;
      }
    }
    if (attempt < 2) await sleep(1200);
  }
  return { invoice, imageUrl };
};

const setTag = (html, pattern, tag) => (pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}\n</head>`));

export default async function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const id = String(req.query?.id || '');
  const isClinara = /(^|\.)clinara\.id$/i.test(host);

  const baseRes = await fetch(`https://${host}/${isClinara ? 'index-clinara.html' : 'index-kaffah.html'}`);
  if (!baseRes.ok) {
    res.status(502).send('Pratinjau tidak tersedia');
    return;
  }
  let html = await baseRes.text();

  if (UUID_RE.test(id)) {
    const { invoice, imageUrl } = await waitForPreview(id);
    const clinic = invoice?.clinic_name || '';
    const title = clinic ? `Kwitansi Terapi - ${clinic}` : 'Kwitansi Terapi';
    const description = 'Lihat atau unduh kwitansi terapi Anda.';
    // Tanpa gambar pratinjau (kwitansi lama), pakai logo Kaffah bila klinik Kaffah; selain itu biarkan bawaan.
    const image = imageUrl || (/kaffah/i.test(clinic) ? `https://${host}/kaffah-logo.png` : null);
    const url = `https://${host}/i/${id}`;

    html = setTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    html = setTag(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = setTag(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = setTag(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = setTag(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(url)}" />`);
    html = setTag(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
    html = setTag(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
    if (image) {
      const wide = Boolean(imageUrl);
      html = setTag(html, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
      html = setTag(html, /<meta\s+property="og:image:width"[^>]*>/i, `<meta property="og:image:width" content="${wide ? 1200 : 640}" />`);
      html = setTag(html, /<meta\s+property="og:image:height"[^>]*>/i, `<meta property="og:image:height" content="${wide ? 630 : 640}" />`);
      html = setTag(html, /<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
      html = setTag(html, /<meta\s+name="twitter:card"[^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
  res.status(200).send(html);
}
