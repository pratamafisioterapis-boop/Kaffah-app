#!/usr/bin/env node
/*
 * Renders the opening-hours reel (scene.html) + synthesized soundtrack (audio.py)
 * into tools/hours-video/dist/kaffah-jam-buka.mp4 (1080×1920, 30 fps, AAC).
 *
 *   node tools/hours-video/render.cjs                # full render
 *   node tools/hours-video/render.cjs --stills 2,5   # PNG stills to $HERO_WORK_DIR
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

const TOOLS = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'dist');
const WORK = process.env.HERO_WORK_DIR || path.join(require('os').tmpdir(), 'kaffah-hours');
const FPS = 30, DUR = 15, W = 1080, H = 1920;
const args = process.argv.slice(2);
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const run = (cmd, a) => new Promise((res, rej) => {
  const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('close', c => c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`)));
});

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  // serve tools/ over http: file:// images would taint the canvas
  const server = http.createServer((req, res) => {
    const f = path.join(TOOLS, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(TOOLS) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => { console.error(e); process.exit(1); });
  await page.goto(`http://127.0.0.1:${server.address().port}/hours-video/scene.html`);
  await page.waitForFunction(() => window.ready === true);
  const grab = t => page.evaluate(tt => { window.render(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);

  if (stills) {
    for (const s of stills.split(',').map(Number)) fs.writeFileSync(path.join(WORK, `hours-${s.toFixed(2)}.png`), Buffer.from(await grab(s), 'base64'));
    console.log(`stills -> ${WORK}`);
  } else {
    const master = path.join(WORK, 'hours-master.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv420p', master], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < FPS * DUR; f++) {
      const b = Buffer.from(await grab(f / FPS), 'base64');
      if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 30 === 0) process.stdout.write(`\rframe ${f}/${FPS * DUR}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('\nvideo master done');
    const wav = path.join(WORK, 'hours-audio.wav');
    await run('python3', [path.join(__dirname, 'audio.py'), wav]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-af', 'loudnorm=I=-14:TP=-1:LRA=9', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest',
      path.join(OUT, 'kaffah-jam-buka.mp4')]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-an', path.join(OUT, 'kaffah-jam-buka-tanpa-audio.mp4')]);
    console.log(`done -> ${OUT}`);
  }
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
