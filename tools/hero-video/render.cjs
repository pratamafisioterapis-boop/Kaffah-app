#!/usr/bin/env node
/*
 * Renders scene.html frame-by-frame in headless Chromium and pipes the frames
 * into ffmpeg.
 *
 *   node tools/hero-video/render.cjs                 # full render, landscape + portrait
 *   node tools/hero-video/render.cjs --stills 1,4,7  # PNG stills only (for review)
 *
 * Output goes to public/hero/kaffah/.
 * Requires: ffmpeg in PATH, playwright (global install is fine).
 */
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/hero/kaffah');
const WORK = process.env.HERO_WORK_DIR || path.join(require('os').tmpdir(), 'kaffah-hero');
const FPS = 30, DUR = 15;
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const VARIANTS = [
  { name: 'landscape', w: 1920, h: 1080 },
  { name: 'portrait', w: 1080, h: 1920 },
].filter(v => !only || v.name === only);

const run = (cmd, a) => new Promise((res, rej) => {
  const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('close', c => c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`)));
});

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  // serve over http: file:// images would taint the canvas
  const http = require('http');
  const server = http.createServer((req, res) => {
    const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  for (const v of VARIANTS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { console.error(e); process.exit(1); });
    await page.goto(`${origin}/scene.html?w=${v.w}&h=${v.h}`);
    await page.waitForFunction(() => window.ready === true);
    const grab = t => page.evaluate(tt => { window.render(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);

    if (stillsArg) {
      for (const s of stillsArg.split(',').map(Number)) {
        fs.writeFileSync(path.join(WORK, `${v.name}-${s.toFixed(2)}.png`), Buffer.from(await grab(s), 'base64'));
      }
      console.log(`stills -> ${WORK}`);
      await page.close();
      continue;
    }

    // 1) near-lossless master
    const master = path.join(WORK, `${v.name}-master.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv420p', master], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = FPS * DUR;
    for (let f = 0; f < total; f++) {
      const buf = Buffer.from(await grab(f / FPS), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) process.stdout.write(`\r${v.name}: frame ${f}/${total}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    // poster = frame 0 so the swap from poster to video is invisible
    fs.writeFileSync(path.join(WORK, `${v.name}-poster.png`), Buffer.from(await grab(0), 'base64'));
    console.log(`\n${v.name}: master done`);
    await page.close();

    // 2) web deliverables
    const base = path.join(OUT, `kaffah-hero-${v.name}`);
    const scale = v.name === 'portrait' ? ['-vf', 'scale=720:1280:flags=lanczos'] : [];
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, ...scale, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', v.name === 'portrait' ? '24' : '25',
      '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-g', '60', '-movflags', '+faststart', '-an', `${base}.mp4`]);
    const vp9 = ['-i', master, ...scale, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', v.name === 'portrait' ? '36' : '37', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-g', '60', '-an'];
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...vp9, '-pass', '1', '-passlogfile', path.join(WORK, v.name), '-f', 'webm', '/dev/null']);
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...vp9, '-pass', '2', '-passlogfile', path.join(WORK, v.name), `${base}.webm`]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WORK, `${v.name}-poster.png`), ...scale, '-quality', '82', `${base}-poster.webp`]);
    if (v.name === 'landscape') {
      // 720p fallback for slow connections
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '25',
        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-movflags', '+faststart', '-an', path.join(OUT, 'kaffah-hero-landscape-720p.mp4')]);
    }
    console.log(`${v.name}: deliverables done`);
  }
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
