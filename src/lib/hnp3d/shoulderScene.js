import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { makeMaterials, canvasTex, clamp, rng } from './spineScene';
import { SHOULDER_STAGES, SHOULDER_MOTIONS } from './cases';

// Mesin 3D kasus Frozen Shoulder (bahu kanan, dilihat dari depan; sumbu +x = medial, +y = atas,
// +z = depan). Geometri prosedural: skapula, klavikula, humerus, kapsul sendi, manset rotator,
// dan untaian adhesi. Kondisi frozen diatur lewat tiga parameter (radang, pengerutan, adhesi)
// per tahap, dan gerakan diperagakan dengan memutar humerus dalam batas ROM normal vs frozen.

const PARAMS = [
  { red: 0, shrink: 0, adh: 0 }, // normal
  { red: 1, shrink: 0.5, adh: 0.45 }, // tahap 1: nyeri
  { red: 0.6, shrink: 1, adh: 1 }, // tahap 2: kaku
  { red: 0.25, shrink: 0.55, adh: 0.5 }, // tahap 3: pemulihan
];
const rad = (d) => (d * Math.PI) / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function limb(a, b, r0, r1, mat) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, 20, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function ball(p, r, mat, s) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
  m.position.copy(p);
  if (s) m.scale.set(s[0], s[1], s[2]);
  return m;
}
function tube(pts, r, mat, seg = 40) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 10, false), mat);
}
const lerpV = (a, b, t) => new THREE.Vector3().lerpVectors(a, b, t);

export function createShoulderViewer({ canvas, stage, labelsEl, leadersEl, onInteract, onRom }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 2.5, maxDistance: 22, autoRotateSpeed: 3, rotateSpeed: 0.8, zoomSpeed: 0.8 });

  scene.add(new THREE.HemisphereLight(0xc4d6ff, 0x2b2016, 2.6));
  const key = new THREE.DirectionalLight(0xfff1de, 3.9); key.position.set(3, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6aa5ff, 2.8); rim.position.set(-5, 2, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe0c0, 1.1); fill.position.set(-4, -3, 3); scene.add(fill);

  const { mats: shared, textures } = makeMaterials();
  const fiberTex = canvasTex(256, (g, S) => {
    g.fillStyle = '#f2effa'; g.fillRect(0, 0, S, S); g.lineWidth = 1.4;
    const r = rng(9);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(110,100,170,${0.25 + 0.35 * r()})`; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120); g.stroke(); }
  }, true);
  fiberTex.repeat.set(4, 2);
  textures.push(fiberTex);
  const M = {
    bone: shared.bone,
    cart: new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.35 }),
    muscle: new THREE.MeshStandardMaterial({ color: 0xc9473b, roughness: 0.55, emissive: 0x2a0805 }),
    adh: new THREE.MeshStandardMaterial({ color: 0xff6a55, emissive: 0xff2a14, emissiveIntensity: 0.55, roughness: 0.4 }),
    cap: new THREE.MeshPhysicalMaterial({ color: 0xb9b3e8, map: fiberTex, bumpMap: fiberTex, bumpScale: 0.5, roughness: 0.45, clearcoat: 0.4, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, emissive: 0xff2a10, emissiveIntensity: 0 }),
  };
  const LAV = new THREE.Color(0xb9b3e8), RED = new THREE.Color(0xe8584a);

  // ── bangun model ─────────────────────────────────────────────
  const root = new THREE.Group(); scene.add(root);
  const gBone = new THREE.Group(), gMus = new THREE.Group(), gCap = new THREE.Group(), gAdh = new THREE.Group(), humG = new THREE.Group();
  root.add(gBone, gMus, gCap, gAdh, humG);

  // humerus (berputar saat peragaan gerak)
  humG.add(ball(V(0, 0, 0), 0.95, M.bone));
  humG.add(limb(V(-0.1, -0.7, 0), V(-0.55, -4.6, 0), 0.58, 0.42, M.bone));
  humG.add(ball(V(-0.72, 0.3, -0.1), 0.42, M.bone, [1, 1.2, 1]));
  humG.add(ball(V(-0.15, -0.1, 0.78), 0.3, M.bone));
  humG.add(ball(V(-0.58, -4.6, 0), 0.46, M.bone));
  humG.add(limb(V(-0.58, -4.6, 0), V(-0.58, -4.6, 2.9), 0.4, 0.3, M.bone)); // lengan bawah (siku 90°)

  // skapula
  const sh = new THREE.Shape();
  [[1.05, 0.9], [1.2, -0.8], [1.8, -2.2], [3.0, -2.3], [3.6, -0.5], [3.5, 1.0], [2.4, 1.1]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const sc = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 4 }), M.bone);
  sc.position.z = -0.85; gBone.add(sc);
  gBone.add(limb(V(1.25, 0, -0.55), V(1.05, 0.02, -0.05), 0.4, 0.34, M.bone));
  const glen = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), M.cart); glen.scale.set(0.16, 0.78, 0.55); glen.position.set(1.02, 0.02, 0.05); gBone.add(glen);
  const lab = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 10, 48), M.cart); lab.rotation.y = Math.PI / 2; lab.scale.set(1, 1.2, 0.85); lab.position.set(0.94, 0.02, 0.05); gBone.add(lab);
  gBone.add(tube([V(3.5, 0.9, -0.85), V(2.7, 1.5, -0.75), V(1.7, 1.75, -0.45), V(0.4, 1.8, -0.1), V(-0.55, 1.7, 0.12), V(-0.95, 1.55, 0.28)], 0.2, M.bone, 50));
  gBone.add(ball(V(-0.95, 1.55, 0.28), 0.2, M.bone));
  gBone.add(tube([V(3.8, 1.6, 1.0), V(2.8, 2.05, 0.9), V(1.6, 2.2, 0.65), V(0.1, 2.05, 0.35), V(-0.75, 1.85, 0.2)], 0.2, M.bone, 50));
  gBone.add(tube([V(1.25, 1.0, -0.2), V(1.2, 1.2, 0.5), V(0.6, 1.1, 1.0)], 0.17, M.bone, 24));
  gBone.add(ball(V(0.6, 1.1, 1.0), 0.17, M.bone));

  // kapsul sendi
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), M.cap); cap.renderOrder = 2; gCap.add(cap);

  // manset rotator: serat otot dalam kipas
  const fan = (o0, o1, i0, i1, n, over, r) => {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      gMus.add(tube([lerpV(o0, o1, u), over(u), lerpV(i0, i1, u)], r, M.muscle, 36));
    }
  };
  fan(V(3.4, 1.45, -0.7), V(1.9, 1.65, -0.55), V(-0.35, 0.95, 0.15), V(-0.85, 0.65, -0.15), 8, (u) => V(0.0, 1.4 + 0.05 * Math.sin(u * 3), -0.4 + 0.7 * u), 0.06); // supraspinatus
  fan(V(2.9, 0.95, -0.3), V(2.9, 0.45, -0.3), V(-0.2, 0.4, 0.95), V(-0.2, -0.05, 0.95), 4, (u) => V(1.0, 0.95 - 0.5 * u, 1.38), 0.05); // subscapularis (bagian atas)
  fan(V(3.0, 0.8, -0.9), V(3.0, 0.0, -0.9), V(-0.75, 0.5, -0.6), V(-0.75, -0.1, -0.6), 6, (u) => V(1.2, 0.55 - 0.5 * u, -1.38), 0.06); // infraspinatus

  // untaian adhesi antara kepala humerus dan kapsul
  const R = rng(21), strands = [];
  for (let i = 0; i < 52; i++) {
    const d = V((R() - 0.5) * 1.4 - 0.2, (R() - 0.7) * 1.2, 0.5 + R() * 0.8).normalize();
    const P = d.clone().multiplyScalar(0.95), Q = d.clone().multiplyScalar(1.08 + R() * 0.08).add(V((R() - 0.5) * 0.18, (R() - 0.5) * 0.18, (R() - 0.5) * 0.18));
    const mid = lerpV(P, Q, 0.5).add(V((R() - 0.5) * 0.1, (R() - 0.5) * 0.1, (R() - 0.5) * 0.1));
    const m = tube([P, mid, Q], 0.016 + R() * 0.016, M.adh, 10);
    m.userData.th = i === 0 ? 0 : R(); gAdh.add(m); strands.push({ m, mid });
  }
  const adhAnchor = strands[0].mid.clone();

  // ── status ──────────────────────────────────────────────────
  const state = { tab: 'anatomi', t: 1, tt: 1, stage: 2, muscles: true, motion: 'flexion' };
  let eff = { ...PARAMS[2] }, tw = null, raf = 0, disposed = false, last = performance.now(), phase = 0, lastRom = 0, labels = [];
  const defPos = new THREE.Vector3(), defTgt = new THREE.Vector3();

  function effParams() {
    const P = PARAMS[state.stage], t = state.t;
    return { red: P.red * t, shrink: P.shrink * t, adh: P.adh * t };
  }
  function applyCondition() {
    eff = effParams();
    const s = 1.2 * (1 - 0.14 * eff.shrink);
    cap.scale.set(s, s * (1 - 0.1 * eff.shrink), s);
    M.cap.color.copy(LAV).lerp(RED, clamp(eff.red * 0.85, 0, 1));
    M.cap.opacity = 0.36 + 0.24 * eff.shrink;
    M.cap.emissiveIntensity = 0.35 * eff.red;
    for (const st of strands) st.m.visible = st.m.userData.th < eff.adh;
    updateLabelText();
  }
  function applyVisibility() {
    const motion = state.tab === 'gerakan', patho = state.tab === 'patologi';
    gMus.visible = state.muscles && !motion;
    M.muscle.transparent = patho; M.muscle.opacity = patho ? 0.22 : 1; M.muscle.depthWrite = !patho; M.muscle.needsUpdate = true;
    gAdh.visible = !motion;
    M.bone.transparent = patho; M.bone.opacity = patho ? 0.45 : 1; M.bone.depthWrite = !patho; M.bone.needsUpdate = true;
  }

  // ── label ──────────────────────────────────────────────────
  function buildLabels() {
    labelsEl.innerHTML = ''; leadersEl.innerHTML = ''; labels = [];
    const mk = (id, html, cls, off, anchor, sets) => {
      const el = document.createElement('div'); el.className = `h3d-lbl ${cls}`; el.innerHTML = html; labelsEl.appendChild(el);
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '3.6');
      leadersEl.append(ln, dot);
      const o = { id, el, ln, dot, off, anchor, sets, cls, w: 0, h: 0 }; labels.push(o); return o;
    };
    const A = ['anatomi', 'terapi'], P = ['patologi'];
    mk('akr', 'Akromion', '', [-130, -50], () => V(-0.3, 1.78, 0.25), A);
    mk('clv', 'Klavikula<small>(tulang selangka)</small>', '', [160, -55], () => V(1.8, 2.22, 0.65), A);
    mk('cuff', 'Rotator<br>Cuff', '', [-190, 5], () => V(0.0, 1.34, -0.1), A);
    mk('gle', 'Glenoid<small>(rongga sendi)</small>', '', [190, 25], () => V(1.05, 0.35, 0.5), A);
    mk('cap', 'Kapsul Sendi', '', [-200, 100], () => V(-0.75, 0.05, 0.95), A.concat(P));
    mk('adh', 'Adhesi<small>(perlekatan jaringan parut)</small>', 'hot', [175, 120], () => adhAnchor.clone(), A.concat(P));
    mk('hum', 'Humerus<small>(tulang lengan atas)</small>', '', [-185, 185], () => V(-0.55, -2.1, 0.45), A);
    mk('axl', 'Recessus aksilaris<small>(mengerut)</small>', 'hot', [-190, 150], () => V(-0.2, -0.95, 0.45), P);
    updateLabelText(); measure();
  }
  function updateLabelText() {
    if (!labels.length) return;
    const fz = state.t > 0.5;
    for (const l of labels) {
      if (l.id === 'cap') { l.el.className = `h3d-lbl ${fz ? 'hot' : ''}`; l.el.innerHTML = fz ? 'Kapsul Sendi<small>(menebal &amp; mengecil)</small>' : 'Kapsul Sendi'; }
    }
    measure();
  }
  const measure = () => { for (const l of labels) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; } };
  const tmp = new THREE.Vector3();
  function updateLabels(W, H) {
    const scl = clamp(W / 900, 0.5, 1), fz = state.t > 0.5;
    for (const l of labels) {
      let show = l.sets.includes(state.tab);
      if (l.id === 'adh' || l.id === 'axl') show = show && fz;
      l.el.classList.toggle('off', !show);
      l.ln.style.display = l.dot.style.display = show ? '' : 'none';
      if (!show) continue;
      tmp.copy(l.anchor()); tmp.project(camera);
      if (tmp.z > 1) { l.el.classList.add('off'); l.ln.style.display = l.dot.style.display = 'none'; continue; }
      const ax = (tmp.x * 0.5 + 0.5) * W, ay = (-tmp.y * 0.5 + 0.5) * H;
      let cx = ax + l.off[0] * scl, cy = ay + l.off[1] * scl;
      const hw = l.w / 2, hh = l.h / 2;
      cx = clamp(cx, hw + (W > 900 ? 136 : 62), W - hw - 8);
      cy = clamp(cy, hh + 60, H - hh - 70);
      l.el.style.transform = `translate(${(cx - hw).toFixed(1)}px,${(cy - hh).toFixed(1)}px)`;
      const dx = ax - cx, dy = ay - cy, k = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
      l.ln.classList.toggle('hot', l.cls.includes('hot') || (l.id === 'cap' && fz));
      if (k >= 1) l.ln.style.display = 'none';
      else { l.ln.setAttribute('x1', (cx + dx * k).toFixed(1)); l.ln.setAttribute('y1', (cy + dy * k).toFixed(1)); l.ln.setAttribute('x2', ax.toFixed(1)); l.ln.setAttribute('y2', ay.toFixed(1)); }
      l.dot.setAttribute('cx', ax.toFixed(1)); l.dot.setAttribute('cy', ay.toFixed(1));
    }
  }

  // ── kamera per tab ──────────────────────────────────────────
  function setView() {
    let dir = V(-0.12, 0.2, 1), dist = 10.2, tgt = V(0.9, 0.1, 0.1);
    if (state.tab === 'patologi') { dist = 7.4; tgt = V(0.3, 0, 0.2); }
    if (state.tab === 'gerakan') {
      if (state.motion === 'flexion') { dir = V(-1, 0.12, 0.18); dist = 15; tgt = V(0, -1.8, 0.8); }
      else if (state.motion === 'abduction') { dir = V(0.05, 0.1, 1); dist = 15; tgt = V(-1.6, -1.3, 0); }
      else { dir = V(0.35, 0.95, 0.35); dist = 12; tgt = V(-0.5, -3, 0.9); }
    }
    defTgt.copy(tgt); defPos.copy(tgt).addScaledVector(dir.normalize(), dist);
  }
  const tweenTo = (p, t, ms = 650) => { tw = { s: performance.now(), ms, p0: camera.position.clone(), t0: controls.target.clone(), p, t }; };
  controls.addEventListener('start', () => { tw = null; onInteract?.(); });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 46 : 34; camera.updateProjectionMatrix(); measure();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);

  function romLimit() {
    const m = SHOULDER_MOTIONS.find((x) => x.key === state.motion);
    const fz = SHOULDER_STAGES[state.stage - 1].rom[state.motion];
    return { normal: m.normal, limit: m.normal + (fz - m.normal) * state.t };
  }
  function applyMotion(angle) {
    humG.rotation.set(0, 0, 0);
    if (state.motion === 'flexion') humG.rotation.x = -rad(angle);
    else if (state.motion === 'abduction') humG.rotation.z = -rad(angle);
    else humG.rotation.y = -rad(angle);
  }

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (Math.abs(state.t - state.tt) > 0.002) {
      state.t += (state.tt - state.t) * Math.min(1, dt * 4.2);
      if (Math.abs(state.t - state.tt) <= 0.002) state.t = state.tt;
      applyCondition();
    }
    if (state.tab === 'gerakan') {
      phase += dt * 0.6;
      const { normal, limit } = romLimit(), a = limit * (0.5 - 0.5 * Math.cos(phase));
      applyMotion(a);
      if (now - lastRom > 100) { lastRom = now; onRom?.({ angle: Math.round(a), limit: Math.round(limit), normal }); }
    }
    if (tw) {
      const k = Math.min(1, (now - tw.s) / tw.ms), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tw.p0, tw.p, e); controls.target.lerpVectors(tw.t0, tw.t, e);
      if (k >= 1) tw = null;
    }
    controls.update(); renderer.render(scene, camera);
    updateLabels(stage.clientWidth, stage.clientHeight);
  }

  buildLabels(); applyCondition(); applyVisibility(); setView();
  camera.position.copy(defPos); controls.target.copy(defTgt); controls.update();
  resize();
  raf = requestAnimationFrame(tick);

  return {
    setTab(tab) {
      state.tab = tab; humG.rotation.set(0, 0, 0); phase = 0; applyVisibility(); setView(); tweenTo(defPos.clone(), defTgt.clone(), 700);
    },
    setCondition(on) { state.tt = on ? 1 : 0; },
    setStage(n) { state.stage = n; applyCondition(); },
    setMuscles(on) { state.muscles = on; applyVisibility(); },
    setMotion(k) { state.motion = k; humG.rotation.set(0, 0, 0); phase = 0; setView(); tweenTo(defPos.clone(), defTgt.clone(), 700); },
    setAuto(on) { controls.autoRotate = on; },
    zoom(f) {
      const off = camera.position.clone().sub(controls.target);
      off.setLength(clamp(off.length() * f, controls.minDistance, controls.maxDistance));
      tweenTo(controls.target.clone().add(off), controls.target.clone(), 320);
    },
    resetView() { setView(); tweenTo(defPos.clone(), defTgt.clone(), 700); },
    // Gambar mini kapsul normal dan tiap tahap, dirender dari model yang sama.
    snapshots() {
      const keep = { t: state.t, stage: state.stage, tab: state.tab, rot: humG.rotation.clone(), vis: [gMus.visible, gAdh.visible] };
      const savedPos = camera.position.clone(), savedTgt = controls.target.clone();
      const out = {};
      renderer.setPixelRatio(1); renderer.setSize(360, 270, false); camera.aspect = 360 / 270; camera.fov = 34; camera.updateProjectionMatrix();
      camera.position.set(0.8, 0.5, 5.6); controls.target.set(0.3, 0, 0.2); camera.lookAt(controls.target);
      state.tab = 'anatomi'; humG.rotation.set(0, 0, 0); gMus.visible = true; gAdh.visible = true;
      for (const [name, stg, t] of [['normal', 2, 0], ['s1', 1, 1], ['s2', 2, 1], ['s3', 3, 1]]) {
        state.stage = stg; state.t = t; applyCondition(); applyVisibility();
        renderer.render(scene, camera); out[name] = canvas.toDataURL('image/png');
      }
      Object.assign(state, { t: keep.t, stage: keep.stage, tab: keep.tab }); humG.rotation.copy(keep.rot);
      applyCondition(); applyVisibility(); gMus.visible = keep.vis[0]; gAdh.visible = keep.vis[1];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.position.copy(savedPos); controls.target.copy(savedTgt); resize();
      return out;
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
