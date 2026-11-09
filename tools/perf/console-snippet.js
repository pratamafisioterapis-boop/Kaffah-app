// Tempel di Console DevTools (Chrome) pada halaman yang SUDAH login, setelah halaman selesai dimuat.
// Hanya membaca data performa browser: tidak mengirim apa pun ke mana pun, nilai query
// (nama/ID pasien) dibuang, dan hasilnya disalin ke clipboard untuk kamu paste ke chat.
(async () => {
  const mask = (u) => { try { const x = new URL(u); const k = [...x.searchParams.keys()]; return x.host.replace(/\.supabase\.co$/, '.sb') + x.pathname + (k.length ? '?' + k.join('&') : ''); } catch { return String(u).slice(0, 80); } };
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource');
  const groups = {};
  res.forEach((r) => {
    const key = mask(r.name);
    const g = (groups[key] ||= { n: 0, ms: 0, max: 0, kb: 0, type: r.initiatorType });
    g.n++; g.ms += r.duration; g.max = Math.max(g.max, r.duration); g.kb += (r.transferSize || r.encodedBodySize || 0) / 1024;
  });
  const rows = Object.entries(groups).map(([k, g]) => ({ url: k.slice(0, 120), n: g.n, totalMs: Math.round(g.ms), maxMs: Math.round(g.max), kb: Math.round(g.kb), type: g.type }));
  const lcp = await new Promise((ok) => { let v = 0; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { v = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {} setTimeout(() => ok(Math.round(v)), 300); });
  const long = await new Promise((ok) => { let t = 0; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { t += Math.max(0, e.duration - 50); })).observe({ type: 'longtask', buffered: true }); } catch {} setTimeout(() => ok(Math.round(t)), 300); });
  const api = rows.filter((r) => /\.sb\/(rest|functions)/.test(r.url));
  const out = {
    halaman: location.pathname,
    domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0), loadMs: Math.round(nav.loadEventEnd || 0), lcpMs: lcp, tbtKasarMs: long,
    totalRequest: res.length, apiRequest: api.reduce((s, r) => s + r.n, 0), totalKB: rows.reduce((s, r) => s + r.kb, 0),
    domNodes: document.getElementsByTagName('*').length, barisTabel: document.querySelectorAll('tbody tr').length,
    apiTerlambat: [...api].sort((a, b) => b.maxMs - a.maxMs).slice(0, 8),
    apiDuplikat: api.filter((r) => r.n > 1).sort((a, b) => b.n - a.n).slice(0, 8),
    terbesar: [...rows].sort((a, b) => b.kb - a.kb).slice(0, 8),
  };
  console.log(JSON.stringify(out, null, 1));
  try { copy(JSON.stringify(out)); console.log('%cSudah disalin ke clipboard. Paste ke chat.', 'color:green;font-weight:bold'); } catch { console.log('Salin teks di atas secara manual.'); }
})();
