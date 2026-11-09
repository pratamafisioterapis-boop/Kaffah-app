#!/usr/bin/env node
// Ukur performa halaman SETELAH LOGIN dengan data real, dijalankan di mesin kamu.
// Kredensial hanya dibaca dari environment variable dan tidak pernah ditulis ke hasil.
//
// Persiapan (sekali):  npm i --no-save playwright && npx playwright install chromium
// Jalankan (per peran, gunakan akun read-only sebisa mungkin):
//   BASE_URL=https://clinara.id PERF_EMAIL=owner@x.com PERF_PASSWORD='...' PERF_LABEL=owner \
//     node tools/perf/measure-authed.mjs
// Opsi env: PERF_PROFILE=mobile|desktop (default mobile = Pixel 5 + 4G + CPU 4x)
//           PERF_ROUTES=/owner/a,/owner/b  (default: semua menu di sidebar)
//           PERF_RUNS=2 (jumlah ulangan per menu, ambil yang terburuk & median)
//           PERF_NO_LOGIN=1 (uji skrip pada halaman publik)
// Hasil: perf-results/<label>-<tanggal>.json dan .md  -> kirim file .md/.json itu ke Claude.
import fs from 'node:fs';
import path from 'node:path';

const { chromium, devices } = await import('playwright').catch(() => {
  console.error('Playwright belum terpasang: npm i --no-save playwright && npx playwright install chromium');
  process.exit(1);
});

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const LABEL = process.env.PERF_LABEL || 'run';
const PROFILE = process.env.PERF_PROFILE || 'mobile';
const RUNS = Number(process.env.PERF_RUNS || 2);
const NO_LOGIN = process.env.PERF_NO_LOGIN === '1';
if (!BASE) { console.error('Set BASE_URL, mis. https://clinara.id'); process.exit(1); }
if (!NO_LOGIN && (!process.env.PERF_EMAIL || !process.env.PERF_PASSWORD)) {
  console.error('Set PERF_EMAIL dan PERF_PASSWORD (atau PERF_NO_LOGIN=1)'); process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext(PROFILE === 'mobile' ? { ...devices['Pixel 5'] } : { viewport: { width: 1366, height: 800 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Performance.enable');
const perfMetrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
if (PROFILE === 'mobile') {
  // ~ slow 4G
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

// --- login ---
if (!NO_LOGIN) {
  let ok = false; let lastReason = '';
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
    const email = page.locator('input[placeholder="Email atau Username"]:visible').first();
    const pass = page.locator('input[type="password"]:visible').first();
    await email.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500); // beri waktu aplikasi siap menerima input
    await email.fill(process.env.PERF_EMAIL);
    await pass.fill(process.env.PERF_PASSWORD);
    await pass.press('Enter');
    try { await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 }); ok = true; }
    catch {
      // tampilkan alasan yang dilihat pengguna (tanpa mencetak kredensial)
      lastReason = await page.evaluate(() => {
        const el = document.querySelector('[role="alert"], .text-red-600, .text-red-500, [data-state="open"][role="status"]');
        return (el?.textContent || document.body.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 200);
      });
      console.error(`Percobaan login ${attempt}/3 gagal. Teks di layar: "${lastReason}"`);
      fs.mkdirSync('perf-results', { recursive: true });
      await page.screenshot({ path: 'perf-results/login-gagal.png' }).catch(() => {});
    }
  }
  if (!ok) { console.error('Login gagal. Screenshot: perf-results/login-gagal.png (kolom password tersamar).'); await browser.close(); process.exit(2); }
  await page.waitForLoadState('networkidle').catch(() => {});
}
const home = new URL(page.url()).pathname;
console.log(`Masuk. Halaman awal: ${home}`);

// --- daftar menu ---
let routes = (process.env.PERF_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!routes.length) {
  routes = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('a[href^="/"]').forEach((a) => {
      const h = a.getAttribute('href').split('?')[0].split('#')[0];
      if (h && h !== '/' && !/^\/(login|logout|register)/.test(h)) set.add(h);
    });
    return [...set];
  });
  if (!routes.length) routes = [home];
}
console.log(`Menu yang akan diukur (${routes.length}):`, routes.join(' '));

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(route) {
  const reqs = new Map();
  const onReq = (r) => reqs.set(r, { url: r.url(), start: Date.now(), method: r.method(), type: r.resourceType() });
  const onDone = async (r) => {
    const m = reqs.get(r); if (!m) return; m.ms = Date.now() - m.start;
    try { const s = await r.sizes(); m.bytes = s.responseBodySize + s.responseHeadersSize; } catch { m.bytes = 0; }
    m.status = (await r.response())?.status();
  };
  page.on('request', onReq); page.on('requestfinished', onDone);
  const errors = []; const onErr = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); };
  page.on('console', onErr);

  await page.addInitScript(() => {
    window.__perf = { long: 0, lcp: 0 };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__perf.long += Math.max(0, e.duration - 50); })).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__perf.lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const pm0 = await perfMetrics();
  const t0 = Date.now();
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  const tIdle = Date.now() - t0;
  const pm1 = await perfMetrics();
  const scriptMs = Math.round(((pm1.ScriptDuration || 0) - (pm0.ScriptDuration || 0)) * 1000);
  const taskMs = Math.round(((pm1.TaskDuration || 0) - (pm0.TaskDuration || 0)) * 1000);
  const dom = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr, [role="row"]').length,
    nodes: document.getElementsByTagName('*').length,
    lcp: Math.round(window.__perf?.lcp || 0),
    spinner: !!document.querySelector('.animate-spin'),
  }));
  page.off('request', onReq); page.off('requestfinished', onDone); page.off('console', onErr);

  const list = [...reqs.values()].filter((r) => r.ms != null);
  const api = list.filter((r) => /supabase\.co\/(rest|functions)/.test(r.url));
  const slow = [...api].sort((a, b) => b.ms - a.ms).slice(0, 5).map((r) => ({
    ms: r.ms, kb: Math.round((r.bytes || 0) / 1024), status: r.status,
    // buang query string berisi nilai (bisa memuat nama/ID pasien); simpan hanya tabel/RPC + kolom filter
    what: r.url.replace(/^https?:\/\/[^/]+/, '').replace(/=([^&]*)/g, '=*').slice(0, 140),
  }));
  const dupes = {}; api.forEach((r) => { const k = r.method + ' ' + r.url.replace(/=([^&]*)/g, '=*'); dupes[k] = (dupes[k] || 0) + 1; });
  const dup = Object.entries(dupes).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ n, what: k.slice(0, 140) }));
  const byType = {};
  list.forEach((r) => { byType[r.type] = byType[r.type] || { n: 0, kb: 0 }; byType[r.type].n++; byType[r.type].kb += (r.bytes || 0) / 1024; });
  const typeSummary = Object.entries(byType).map(([t, v]) => `${t}: ${v.n} file, ${Math.round(v.kb)} KB`).sort();
  const biggest = [...list].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 8).map((r) => ({
    kb: Math.round((r.bytes || 0) / 1024), type: r.type, what: r.url.replace(/^https?:\/\/[^/]+/, '').replace(/=([^&]*)/g, '=*').slice(0, 110),
  }));
  return {
    route, tIdleMs: tIdle, scriptMs, taskMs, typeSummary, biggest, lcpMs: dom.lcp,  rows: dom.rows, domNodes: dom.nodes, stuckSpinner: dom.spinner,
    requests: list.length, apiCalls: api.length, apiMsSum: api.reduce((s, r) => s + r.ms, 0),
    transferKb: Math.round(list.reduce((s, r) => s + (r.bytes || 0), 0) / 1024),
    slowestApi: slow, duplicateApi: dup, consoleErrors: errors.slice(0, 3),
  };
}

const results = [];
for (const route of routes) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) { try { runs.push(await measure(route)); } catch (e) { runs.push({ route, error: String(e).slice(0, 120) }); } }
  const good = runs.filter((r) => !r.error);
  if (!good.length) { results.push(runs[0]); console.log('GAGAL', route); continue; }
  const worst = good.reduce((a, b) => (b.tIdleMs > a.tIdleMs ? b : a));
  results.push({ ...worst, tIdleMedianMs: median(good.map((r) => r.tIdleMs)), runs: good.length });
  console.log(`${route.padEnd(36)} idle ${worst.tIdleMs}ms  api ${worst.apiCalls}  rows ${worst.rows}  script ${worst.scriptMs}ms`);
}
await browser.close();

fs.mkdirSync('perf-results', { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const base = path.join('perf-results', `${LABEL}-${stamp}`);
fs.writeFileSync(base + '.json', JSON.stringify({ label: LABEL, profile: PROFILE, base: BASE, results }, null, 2));
const md = [`# ${LABEL} (${PROFILE}) — ${BASE}`, '', '| Menu | idle (ms) | LCP | script (ms) | API | baris | KB | spinner nyangkut |', '|---|---|---|---|---|---|---|---|',
  ...results.map((r) => r.error ? `| ${r.route} | ERROR ${r.error} |||||||` : `| ${r.route} | ${r.tIdleMs} | ${r.lcpMs} | ${r.scriptMs} | ${r.apiCalls} | ${r.rows} | ${r.transferKb} | ${r.stuckSpinner ? 'ya' : ''} |`), '',
  '## Rincian per menu: ukuran, request API terlambat & duplikat', '',
  ...results.filter((r) => !r.error).flatMap((r) => [`### ${r.route}`, `Transfer: ${r.typeSummary.join(' · ')}`, 'File terbesar:', ...r.biggest.map((b) => `- ${b.kb} KB · ${b.type} · ${b.what}`), 'API terlambat:', ...r.slowestApi.map((s) => `- ${s.ms} ms · ${s.kb} KB · ${s.what}`), ...r.duplicateApi.map((d) => `- DUPLIKAT x${d.n}: ${d.what}`), ''])].join('\n');
fs.writeFileSync(base + '.md', md);
console.log(`\nSelesai. Kirim file ini ke Claude: ${base}.md (dan .json)`);
