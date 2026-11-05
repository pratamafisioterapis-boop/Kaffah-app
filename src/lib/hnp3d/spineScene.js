import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HNP_REGIONS, HNP_DEFAULT_LAYERS } from './cases';

// Mesin 3D menu "Anatomi 3D": segmen tulang belakang prosedural (vertebra, diskus, nukleus,
// akar saraf, ligamen) dengan animasi normal <-> HNP. Tanpa file model: semua geometri dibuat
// dari kode, jadi ringan dan tidak butuh storage. Label anatomi dikelola di sini (DOM)
// supaya posisinya mengikuti kamera tiap frame tanpa render ulang React.

const TAU = Math.PI * 2;
const PHI0 = (-62 * Math.PI) / 180; // arah herniasi: posterolateral kanan
const BULGE = 0.78;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const noise = (x, y, z) => Math.sin(x * 3.1 + y * 2.3) * Math.cos(z * 2.7 + x * 1.9) * 0.6 + Math.sin(x * 7.3 + z * 5.1 + y * 3.3) * 0.4;
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

function canvasTex(size, draw, srgb) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMaterials() {
  const boneCol = canvasTex(512, (g, S) => {
    g.fillStyle = '#e0c79d'; g.fillRect(0, 0, S, S);
    const r = rng(11);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = r() < 0.55 ? `rgba(125,86,48,${0.04 + 0.08 * r()})` : `rgba(255,246,225,${0.05 + 0.1 * r()})`;
      g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 5, 0, TAU); g.fill();
    }
  }, true);
  const boneBump = canvasTex(512, (g, S) => {
    g.fillStyle = '#a8a8a8'; g.fillRect(0, 0, S, S);
    const r = rng(5);
    for (let i = 0; i < 900; i++) {
      const x = r() * S, y = r() * S, rad = 1.5 + r() * 5;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(20,20,20,.9)'); gr.addColorStop(1, 'rgba(20,20,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
  });
  boneCol.repeat.set(1.6, 1.2); boneBump.repeat.set(1.6, 1.2);
  const lam = canvasTex(256, (g, S) => {
    g.fillStyle = '#f3f0fc'; g.fillRect(0, 0, S, S); g.lineWidth = 1.6;
    for (let b = 0; b < 16; b++) {
      const y0 = b * 16;
      g.strokeStyle = b % 2 ? 'rgba(120,110,175,.55)' : 'rgba(255,255,255,.7)';
      for (let x = -S; x < S * 2; x += 7) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (b % 2 ? 16 : -16), y0 + 16); g.stroke(); }
    }
  }, true);
  lam.repeat.set(6, 0.5);
  const glowTex = canvasTex(128, (g, S) => {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,140,70,.95)'); gr.addColorStop(0.35, 'rgba(255,70,40,.5)'); gr.addColorStop(1, 'rgba(255,40,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, true);
  glowTex.wrapS = glowTex.wrapT = THREE.ClampToEdgeWrapping;
  const mats = {
    bone: new THREE.MeshStandardMaterial({ color: 0xffffff, map: boneCol, bumpMap: boneBump, bumpScale: 1.2, roughness: 0.82, metalness: 0 }),
    nerve: new THREE.MeshStandardMaterial({ color: 0xf0b400, roughness: 0.35, metalness: 0, emissive: 0x3a2600, emissiveIntensity: 0.25 }),
    nerveHot: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.35, metalness: 0, emissive: 0x3a2600, emissiveIntensity: 0.25 }),
    dura: new THREE.MeshStandardMaterial({ color: 0xffe8a0, roughness: 0.5, transparent: true, opacity: 0.12, depthWrite: false }),
    lig: new THREE.MeshStandardMaterial({ color: 0xcfd7e3, roughness: 0.5, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    nuc: new THREE.MeshPhysicalMaterial({ color: 0x5fb0ff, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x0a3a80, emissiveIntensity: 0.5 }),
    blob: new THREE.MeshPhysicalMaterial({ color: 0xff4a3a, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0xff2410, emissiveIntensity: 0.75 }),
    disc: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, map: lam, bumpMap: lam, bumpScale: 0.4, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.4, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide }),
  };
  return { mats, glowTex, textures: [boneCol, boneBump, lam, glowTex] };
}

function limb(a, b, r0, r1, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 16, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function ball(p, r, mat, s) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.copy(p);
  if (s) m.scale.set(s[0], s[1], s[2]);
  return m;
}

function makeVertebra(c, mats) {
  const { rx, rz, hb } = c;
  const g = new THREE.Group();
  const zb = rz * 0.95, px = rx * 0.5, py = hb * 0.08;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const geo = new THREE.CylinderGeometry(1, 1, hb, 56, 10, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const yn = y / (hb / 2), rho = Math.hypot(x, z), ph = Math.atan2(z, x);
    let f = 1 - 0.07 * (1 - yn * yn) + 0.035 * Math.pow(Math.abs(yn), 6);
    const dn = wrap(ph + Math.PI / 2);
    f -= 0.13 * Math.exp((-dn * dn) / 0.12) * (rho > 0.01 ? 1 : 0);
    f += noise(x * 2, y * 2, z * 2) * 0.02;
    x *= f * rx; z *= f * rz;
    if (Math.abs(yn) > 0.99) y -= Math.sign(yn) * 0.05 * (1 - rho * rho);
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mats.bone));
  for (const s of [-1, 1]) {
    const near = s === 1; // sisi dekat kamera dipotong (model penampang) agar akar saraf terlihat
    const pa = V(s * px, py, -(zb - 0.12)), pb = V(s * px, py, -(zb + (near ? 0.22 : 0.58)));
    g.add(limb(pa, pb, 0.17, 0.15, mats.bone)); g.add(ball(pb, 0.15, mats.bone));
    const ta = V(s * px, py + 0.02, -(zb + (near ? 0.2 : 0.5)));
    const tb = V(s * (rx + (near ? 0.2 : c.tp)), py - 0.04, -(zb + (near ? 0.28 : 0.42)));
    g.add(limb(ta, tb, 0.12, 0.08, mats.bone)); g.add(ball(tb, 0.085, mats.bone));
    if (!near) {
      const a = V(s * px, 0, -(zb + 0.58)), b = V(0, 0, -(zb + 1.02));
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const lamina = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, hb * 0.62, 0.13), mats.bone);
      lamina.position.set((a.x + b.x) / 2, py + 0.04, (a.z + b.z) / 2);
      lamina.rotation.y = Math.atan2(-dz, dx);
      g.add(lamina);
      g.add(ball(V(s * (px + 0.1), py + hb * 0.38, -(zb + 0.7)), 0.14, mats.bone, [1, 1.5, 0.9]));
      g.add(ball(V(s * (px + 0.1), py - hb * 0.38, -(zb + 0.7)), 0.14, mats.bone, [1, 1.5, 0.9]));
    }
  }
  const sg = new THREE.BoxGeometry(0.17, c.spinH * hb, c.spin, 1, 1, 6);
  const sq = sg.attributes.position;
  for (let i = 0; i < sq.count; i++) {
    const k = (-sq.getZ(i) / (c.spin / 2) + 1) / 2;
    sq.setY(i, sq.getY(i) * (1 - 0.5 * k * k));
    sq.setX(i, sq.getX(i) * (1 - 0.25 * k));
  }
  sg.computeVertexNormals();
  const sp = new THREE.Mesh(sg, mats.bone);
  sp.position.set(0, py + 0.04, -(zb + 1.0 + c.spin / 2 - 0.05)); sp.rotation.x = 0.1;
  g.add(sp);
  g.add(ball(V(0, py + 0.04, -(zb + 1.0)), 0.14, mats.bone, [1, 2, 1]));
  return g;
}

function makeDisc(c, sel, mats) {
  const geo = new THREE.CylinderGeometry(1, 1, c.hd, 72, 14, false);
  const pos = geo.attributes.position, n = pos.count;
  const base = pos.array.slice();
  const col = new Float32Array(n * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, mats.disc);
  mesh.renderOrder = 2;
  function update(t, hot) {
    for (let i = 0; i < n; i++) {
      const x0 = base[i * 3], y0 = base[i * 3 + 1], z0 = base[i * 3 + 2];
      const rho = Math.hypot(x0, z0), yn = y0 / (c.hd / 2);
      let w = 0, wp = 0;
      if (rho > 0.5 && sel) {
        const ph = Math.atan2(z0, x0), d = wrap(ph - PHI0);
        w = Math.exp((-d * d) / (2 * 0.3 * 0.3)) * Math.exp((-yn * yn) / (2 * 0.5 * 0.5));
        wp = 0.5 * (1 - Math.sin(ph));
      }
      const f = 1 + 0.07 * (1 - yn * yn) + 0.03 + BULGE * t * w;
      pos.setXYZ(i, c.rx * x0 * f, y0 * (1 - 0.2 * t * wp), c.rz * z0 * f);
      const m = hot ? clamp(1.9 * t * w, 0, 1) : 0;
      col[i * 3] = 0.76 + 0.24 * m; col[i * 3 + 1] = 0.72 - 0.32 * m; col[i * 3 + 2] = 0.96 - 0.6 * m;
    }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
  }
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mats.nuc);
  nuc.scale.set(c.rx * 0.62, c.hd * 0.42, c.rz * 0.62);
  nuc.position.set(0, 0, -c.rz * 0.06);
  update(0, false);
  return { mesh, nuc, update };
}

function rootPts(c, style, side, shift, sp, zb, t, compressed) {
  const kx = c.rx / 1.15;
  const U = style === 'traverse'
    ? [[0.18, 0.8, 0.525], [0.4, 0.4, 0.475], [0.68, 0, 0.395], [0.95, -0.4, 0.265], [1.35, -0.84, 0.145], [1.9, -1.33, 0.045]]
    : [[0.15, 0.22, 0.525], [0.5, 0.12, 0.46], [0.85, 0, 0.36], [1.25, -0.12, 0.24], [1.8, -0.4, 0.12], [2.4, -0.7, 0]];
  return U.map(([x, y, a]) => {
    let X = side * x * kx, Z = -(zb + a);
    const Y = (y + shift) * sp;
    if (compressed) { const w = Math.exp(-Math.pow(y / 0.42, 2)) * t; X += side * 0.12 * w; Z -= 0.12 * w; }
    return new THREE.Vector3(X, Y, Z);
  });
}
function tubeWithColors(curve, r, seg, hotU, t) {
  const g = new THREE.TubeGeometry(curve, seg, r, 12, false);
  const n = g.attributes.position.count, col = new Float32Array(n * 3), per = 13;
  for (let i = 0; i < n; i++) {
    const u = Math.floor(i / per) / seg;
    const m = clamp(Math.exp(-Math.pow((u - hotU) / 0.09, 2)) * t * 0.85, 0, 1);
    col[i * 3] = 1; col[i * 3 + 1] = 0.82 - 0.52 * m; col[i * 3 + 2] = 0.1 - 0.02 * m;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function createHnpViewer({ canvas, stage, labelsEl, leadersEl, onInteract }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 2.6, maxDistance: 14, autoRotateSpeed: 3, rotateSpeed: 0.8, zoomSpeed: 0.8 });

  scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x2b2016, 2.6));
  const key = new THREE.DirectionalLight(0xfff1de, 3.9); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6aa5ff, 2.8); rim.position.set(-5, 2, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe0c0, 1.1); fill.position.set(5, -3, -2); scene.add(fill);

  const { mats, glowTex, textures } = makeMaterials();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });

  const state = { region: 'lumbal', di: 0, t: 1, tt: 1, layers: { ...HNP_DEFAULT_LAYERS }, xray: false };
  let rootG = null, S = null, labels = [], tw = null, raf = 0, disposed = false, last = performance.now();
  const defPos = new THREE.Vector3(), defTgt = new THREE.Vector3();

  function disposeRoot() {
    if (!rootG) return;
    rootG.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); });
    scene.remove(rootG); rootG = null;
  }

  function build() {
    disposeRoot();
    const R = HNP_REGIONS[state.region], D = R.discs[state.di], c = R.dims, d = D.i, n = R.levels.length;
    const sp = c.hb + c.hd, zb = c.rz * 0.95;
    rootG = new THREE.Group(); scene.add(rootG);
    const gBone = new THREE.Group(), gDisc = new THREE.Group(), gNerve = new THREE.Group(), gHer = new THREE.Group(), gLig = new THREE.Group();
    rootG.add(gBone, gDisc, gNerve, gHer, gLig);
    for (let k = 0; k < n; k++) { const v = makeVertebra(c, mats); v.position.y = (d - k) * sp + sp / 2; gBone.add(v); }
    let sel = null;
    for (let j = 0; j < n - 1; j++) {
      const disc = makeDisc(c, j === d, mats);
      disc.mesh.position.y = disc.nuc.position.y = (d - j) * sp;
      disc.nuc.renderOrder = 1;
      gDisc.add(disc.mesh, disc.nuc);
      if (j === d) sel = disc;
    }
    const blob = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 26), mats.blob); blob.renderOrder = 1;
    const glow = new THREE.Sprite(glowMat.clone()); glow.renderOrder = 3;
    const hotLight = new THREE.PointLight(0xff5a2a, 0, 4, 2);
    gHer.add(blob, glow, hotLight);

    const topY = d * sp + sp / 2 + c.hb / 2 + 0.55, botY = (d - (n - 1)) * sp + sp / 2 - c.hb / 2 - 0.55;
    const zc = -(zb + 0.525), Ly = topY - botY;
    const dura = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, Ly, 28, 1, true), mats.dura);
    dura.position.set(0, (topY + botY) / 2, zc); gNerve.add(dura);
    const r = rng(3);
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU + 0.4, pts = [];
      for (let s = 0; s <= 14; s++) { const y = botY + (Ly * s) / 14, a = a0 + y * 0.9; pts.push(new THREE.Vector3(0.15 * Math.cos(a), y, zc + 0.15 * Math.sin(a))); }
      gNerve.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.042 + r() * 0.012, 8, false), mats.nerve));
    }
    for (const [side, shift] of [[-1, 0], [-1, 1], [1, 1]]) {
      const cv = new THREE.CatmullRomCurve3(rootPts(c, R.style, side, shift, sp, zb, 0, false));
      gNerve.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 60, 0.068, 10, false), mats.nerve));
    }
    const hotMesh = new THREE.Mesh(new THREE.BufferGeometry(), mats.nerveHot); gNerve.add(hotMesh);
    const probe = new THREE.CatmullRomCurve3(rootPts(c, R.style, 1, 0, sp, zb, 0, false));
    let uc = 0.4, best = 9;
    for (let s = 0; s <= 100; s++) { const q = probe.getPoint(s / 100); if (Math.abs(q.y) < best) { best = Math.abs(q.y); uc = s / 100; } }
    const H = topY - botY - 0.3;
    const all = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, H, 48, 1, true, -0.95, 1.9), mats.lig);
    all.scale.set(c.rx * 1.07, 1, c.rz * 1.07); all.position.y = (topY + botY) / 2; gLig.add(all);
    const pll = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, H, 48, 1, true, Math.PI - 0.38, 0.76), mats.lig);
    pll.scale.set(c.rx * 1.02, 1, c.rz * 1.02); pll.position.y = (topY + botY) / 2; gLig.add(pll);

    S = { cfg: c, D, R, d, sp, zb, sel, blob, glow, hotLight, hotMesh, uc, gBone, gDisc, gNerve, gHer, gLig, curve: null, nucAnchor: new THREE.Vector3() };
    labels = []; // label lama milik build sebelumnya
    applyT(); applyLayers(); buildLabels();
    const dist = c.rx > 1.1 ? 10.2 : 9.4;
    defTgt.set(c.rx * 0.12, 0, -0.72);
    defPos.copy(defTgt).addScaledVector(new THREE.Vector3(0.8, 0.2, -0.55).normalize(), dist);
  }

  function applyT() {
    const t = state.t, c = S.cfg, hot = state.layers.hernia;
    S.sel.update(t, hot);
    const rb = 0.6 + 0.72 * t, cx = c.rx * Math.cos(PHI0) * rb, cz = c.rz * Math.sin(PHI0) * rb, sc = 0.05 + 0.4 * t;
    S.blob.position.set(cx, 0, cz); S.blob.scale.set(sc * 1.1, c.hd * (0.18 + 0.5 * t), sc); S.blob.visible = t > 0.03 && hot;
    S.glow.position.set(cx * 1.12, 0, cz * 1.12);
    const gs = 0.6 + 2 * t; S.glow.scale.set(gs, gs, 1); S.glow.material.opacity = 0.85 * t; S.glow.visible = hot && t > 0.03;
    S.hotLight.position.set(cx * 1.15, 0, cz * 1.2); S.hotLight.intensity = hot ? 7 * t : 0;
    const cv = new THREE.CatmullRomCurve3(rootPts(c, S.R.style, 1, 0, S.sp, S.zb, t, true));
    S.curve = cv;
    S.hotMesh.geometry.dispose();
    S.hotMesh.geometry = tubeWithColors(cv, 0.075, 60, S.uc, hot ? t : 0);
    S.nucAnchor.set(c.rx * 0.3, 0, c.rz * 0.12);
    updateLabelText();
  }
  function applyLayers() {
    const L = state.layers;
    S.gBone.visible = L.bone; S.gDisc.visible = L.disc; S.gNerve.visible = L.nerve; S.gLig.visible = L.lig;
    S.gHer.visible = L.hernia && state.t > 0.03;
    mats.bone.transparent = state.xray; mats.bone.opacity = state.xray ? 0.32 : 1; mats.bone.depthWrite = !state.xray; mats.bone.needsUpdate = true;
    applyT();
  }

  // ── label anatomi ─────────────────────────────────────────────
  function buildLabels() {
    labelsEl.innerHTML = ''; leadersEl.innerHTML = ''; labels = [];
    const c = S.cfg, d = S.d, sp = S.sp, lv = S.R.levels, D = S.D;
    const mk = (html, cls, off, anchor, layer) => {
      const el = document.createElement('div'); el.className = `h3d-lbl ${cls}`; el.innerHTML = html; labelsEl.appendChild(el);
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '3.6');
      if (cls.includes('hot')) ln.classList.add('hot');
      leadersEl.append(ln, dot);
      const o = { el, ln, dot, off, anchor, layer, vis: () => true, w: 0, h: 0 }; labels.push(o); return o;
    };
    mk(`Vertebra<br>(${lv[d]})`, '', [-175, -70], () => new THREE.Vector3(c.rx * 0.97, sp / 2 + 0.1, -0.12), 'bone');
    mk(`Diskus<br>Intervertebralis<br>(${D.name})`, '', [-190, -8], () => new THREE.Vector3(c.rx * 0.95, 0, c.rz * 0.3), 'disc');
    mk(`Vertebra<br>(${lv[d + 1]})`, '', [-165, 86], () => new THREE.Vector3(c.rx * 0.97, -sp / 2 - 0.1, -0.12), 'bone');
    S.lblHer = mk('Herniasi Diskus<br>(HNP)', 'hot', [120, -96], () => S.blob.position.clone().multiplyScalar(1.02), 'hernia');
    S.lblNuc = mk('Nukleus<br>Pulposus', 'nuc', [130, -80], () => S.nucAnchor.clone(), 'disc');
    mk(`Akar Saraf<br>(${D.root})`, '', [100, 92], () => S.curve.getPoint(S.uc), 'nerve');
    updateLabelText(); measureLabels();
  }
  function updateLabelText() {
    if (!labels.length) return;
    const hn = state.t > 0.5;
    S.lblHer.vis = () => hn && state.layers.hernia;
    S.lblNuc.vis = () => !hn;
  }
  function measureLabels() { for (const l of labels) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; } }
  const tmp = new THREE.Vector3();
  function updateLabels(W, H) {
    const sc = clamp(W / 900, 0.5, 1);
    for (const l of labels) {
      const show = l.vis() && state.layers[l.layer];
      l.el.classList.toggle('off', !show);
      l.ln.style.display = l.dot.style.display = show ? '' : 'none';
      if (!show) continue;
      tmp.copy(l.anchor()); rootG.localToWorld(tmp); tmp.project(camera);
      if (tmp.z > 1) { l.el.classList.add('off'); l.ln.style.display = l.dot.style.display = 'none'; continue; }
      const ax = (tmp.x * 0.5 + 0.5) * W, ay = (-tmp.y * 0.5 + 0.5) * H;
      let cx = ax + l.off[0] * sc, cy = ay + l.off[1] * sc;
      const hw = l.w / 2, hh = l.h / 2, pad = 8;
      cx = clamp(cx, hw + (W > 900 ? 136 : pad + 54), W - hw - pad);
      cy = clamp(cy, hh + 60, H - hh - 70);
      l.el.style.transform = `translate(${(cx - hw).toFixed(1)}px,${(cy - hh).toFixed(1)}px)`;
      const dx = ax - cx, dy = ay - cy;
      const k = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
      if (k >= 1) { l.ln.style.display = 'none'; }
      else {
        l.ln.setAttribute('x1', (cx + dx * k).toFixed(1)); l.ln.setAttribute('y1', (cy + dy * k).toFixed(1));
        l.ln.setAttribute('x2', ax.toFixed(1)); l.ln.setAttribute('y2', ay.toFixed(1));
      }
      l.dot.setAttribute('cx', ax.toFixed(1)); l.dot.setAttribute('cy', ay.toFixed(1));
    }
  }

  // ── kamera ───────────────────────────────────────────────────
  function tweenTo(p, t, ms = 650) { tw = { s: performance.now(), ms, p0: camera.position.clone(), t0: controls.target.clone(), p, t }; }
  controls.addEventListener('start', () => { tw = null; onInteract?.(); });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 46 : 34; // layar sempit: sudut lebih lebar agar model tetap utuh
    camera.updateProjectionMatrix();
    measureLabels();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!S) return;
    if (Math.abs(state.t - state.tt) > 0.002) {
      state.t += (state.tt - state.t) * Math.min(1, dt * 4.2);
      if (Math.abs(state.t - state.tt) <= 0.002) state.t = state.tt;
      S.gHer.visible = state.layers.hernia && state.t > 0.03;
      applyT();
    }
    if (tw) {
      const k = Math.min(1, (now - tw.s) / tw.ms), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tw.p0, tw.p, e); controls.target.lerpVectors(tw.t0, tw.t, e);
      if (k >= 1) tw = null;
    }
    controls.update();
    renderer.render(scene, camera);
    updateLabels(stage.clientWidth, stage.clientHeight);
  }

  function setCase(region, di, animate) {
    state.region = region; state.di = di; build();
    if (animate) tweenTo(defPos.clone(), defTgt.clone(), 700);
    else { camera.position.copy(defPos); controls.target.copy(defTgt); controls.update(); }
  }
  setCase('lumbal', 0, false);
  resize();
  raf = requestAnimationFrame(tick);

  return {
    setCase: (region, di) => setCase(region, di, true),
    setHnp(on) { state.tt = on ? 1 : 0; },
    setLayers(l) { state.layers = { ...l }; if (S) applyLayers(); },
    setXray(on) { state.xray = on; if (S) applyLayers(); },
    setAuto(on) { controls.autoRotate = on; },
    zoom(f) {
      const off = camera.position.clone().sub(controls.target);
      off.setLength(clamp(off.length() * f, controls.minDistance, controls.maxDistance));
      tweenTo(controls.target.clone().add(off), controls.target.clone(), 320);
    },
    resetView() { tweenTo(defPos.clone(), defTgt.clone(), 700); },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      disposeRoot();
      Object.values(mats).forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); glowMat.dispose();
      renderer.dispose();
    },
  };
}
