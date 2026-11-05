// Mesin viewer three.js untuk menu Anatomi 3D. Imperatif (bukan React) supaya ribuan mesh
// tidak ikut siklus render React; komponen React hanya memanggil method dan menerima callback.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANATOMY_LAYERS, LAYER_BY_KEY, classifyMeshName, displayNameOf, searchTextOf } from './layers';

const PROBLEM_COLOR = new THREE.Color('#ff2b2b');
const PROBLEM_EMISSIVE = new THREE.Color('#8a0000');
const SELECT_EMISSIVE = new THREE.Color('#1f8fff');
const GHOST_OPACITY = 0.12;

const makeLayerMaterial = (layer) => new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(layer.color),
  roughness: layer.roughness,
  metalness: layer.metalness,
  clearcoat: layer.clearcoat,
  clearcoatRoughness: 0.45,
  sheen: layer.sheen || 0,
  sheenColor: new THREE.Color(layer.sheenColor || '#ffffff'),
  sheenRoughness: 0.6,
  side: THREE.DoubleSide,
});

const numberTexture = (n) => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e11d2a';
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export class AnatomyEngine {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.cb = callbacks;
    this.mode = 'select';
    this.entries = new Map(); // id -> entry
    this.layerState = Object.fromEntries(ANATOMY_LAYERS.map((l) => [l.key, { visible: l.defaultOn, opacity: l.defaultOpacity ?? 1 }]));
    this.problemIds = new Set();
    this.presetIds = null; // Set saat preset diagnosa aktif (struktur yang diwarnai merah)
    this.contextIds = null; // tulang patokan preset: tetap utuh, tidak merah
    this.hiddenIds = new Set();
    this.isolatedIds = null;
    this.selectedId = null;
    this.pins = [];
    this.framed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1c2127');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
    this.scene = scene;

    const key = new THREE.DirectionalLight('#fff6ec', 1.6);
    key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight('#cfe3ff', 0.8);
    rim.position.set(-3, 2, -4);
    scene.add(key, rim, new THREE.HemisphereLight('#ffffff', '#3a2f2a', 0.35));
    this.keyLight = key;

    this.root = new THREE.Group();
    this.pinGroup = new THREE.Group();
    scene.add(this.root, this.pinGroup);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    this.camera.position.set(0, 1, 4);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;

    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    draco.setDecoderConfig({ type: 'wasm' });
    this.loader.setDRACOLoader(draco);
    this.draco = draco;

    this.layerMaterials = Object.fromEntries(ANATOMY_LAYERS.map((l) => [l.key, makeLayerMaterial(l)]));
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.tween = null;

    this._onPointerDown = (e) => { this._down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this._onPointerUp = (e) => {
      const d = this._down; this._down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
      this._handleClick(e);
    };
    renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    renderer.domElement.addEventListener('pointerup', this._onPointerUp);

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();

    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ── Siklus hidup ───────────────────────────────────────────────────────
  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.start) / this.tween.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    // Lampu utama ikut kamera supaya sisi yang dilihat selalu terang (seperti lampu periksa).
    this.keyLight.position.copy(this.camera.position).add(new THREE.Vector3(0.6, 0.8, 0).multiplyScalar(this._radius || 1));
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    this.controls.dispose();
    this.draco.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    Object.values(this.layerMaterials).forEach((m) => m.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ── Memuat model ───────────────────────────────────────────────────────
  // fileLayer: lapisan default dari nama file (mis. 'muscles'); 'auto' untuk file gabungan.
  async loadModel(url, fileLayer = 'auto', onProgress) {
    const gltf = await this.loader.loadAsync(url, (ev) => {
      if (onProgress && ev.total) onProgress(ev.loaded / ev.total);
    });
    const added = [];
    const duplicates = [];
    this.seenNames ||= new Set();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const raw = this._meshName(o);
      const fallback = fileLayer === 'auto' ? 'skeleton' : fileLayer;
      // File khusus satu sistem (sendi, saraf, arteri, vena, kulit) dipercaya apa adanya.
      // File tulang/otot hanya memisahkan ligamen & kartilago ke lapisan sendi.
      // File gabungan/organ (mis. heart.glb) dikelompokkan per nama (arteri/vena di dalamnya).
      const layer = ['joints', 'nerves', 'arteries', 'veins', 'skin'].includes(fileLayer)
        ? fileLayer
        : ['muscles', 'skeleton'].includes(fileLayer)
          ? this._refineLayer(raw, fileLayer)
          : classifyMeshName(raw, fallback);
      // Struktur yang sama bisa ada di dua file (mis. arteri di heart.glb dan arteries.glb):
      // pakai yang pertama dimuat supaya tidak saling menimpa (z-fighting).
      const dupKey = `${layer}|${raw}`;
      if (this.seenNames.has(dupKey)) { duplicates.push(o); return; }
      this.seenNames.add(dupKey);
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const hasTexture = !!src?.map;
      let mat;
      if (hasTexture) {
        mat = new THREE.MeshPhysicalMaterial({ map: src.map, normalMap: src.normalMap || null, roughness: 0.55, clearcoat: 0.25, side: THREE.DoubleSide });
      } else {
        mat = this.layerMaterials[layer].clone();
      }
      if (!o.geometry.index && !hasTexture && o.geometry.attributes.position.count < 300000) {
        // Mesh hasil scan (OBJ/STL) sering diekspor tanpa index dengan normal datar sehingga
        // tampak bersegi. Gabungkan vertex lalu hitung normal halus agar permukaan tampak organik.
        try {
          const g = o.geometry.clone();
          g.deleteAttribute('normal');
          const merged = mergeVertices(g, 1e-5);
          merged.computeVertexNormals();
          o.geometry.dispose();
          g.dispose();
          o.geometry = merged;
        } catch { /* biarkan apa adanya */ }
      } else if (!o.geometry.attributes.normal) {
        o.geometry.computeVertexNormals();
      }
      o.material = mat;
      o.castShadow = false;
      o.receiveShadow = false;
      const id = o.uuid;
      const disp = displayNameOf(raw);
      const entry = { id, mesh: o, layer, raw, name: disp.label, baseName: disp.name, side: disp.side, search: searchTextOf(raw), baseColor: mat.color.clone() };
      o.userData.anatomyId = id;
      this.entries.set(id, entry);
      added.push(entry);
    });
    duplicates.forEach((o) => { o.geometry?.dispose(); o.removeFromParent(); });
    this.root.add(gltf.scene);
    this._refreshAll();
    if (!this.framed) { this.frameAll(false); this.framed = true; }
    return added;
  }

  _meshName(o) {
    // GLTFLoader mengubah o.name (titik dan spasi dihapus/diganti), padahal akhiran ".l"/".r"
    // Z-Anatomy menandai sisi tubuh. Nama asli disimpan di userData.name. Banyak exporter
    // juga memberi nama di node induk, bukan di mesh/primitive.
    const generic = (n) => !n || /^(mesh|object|primitive|node)?[_ .]?\d*$/i.test(n);
    for (const n of [o.userData?.name, o.parent?.userData?.name, o.name, o.parent?.name, o.material?.name]) {
      if (!generic(n)) return n;
    }
    return 'Struktur';
  }

  _refineLayer(raw, fileLayer) {
    // Di file otot/tulang, ligamen & kartilago tetap dipisah ke lapisan sendi.
    const c = classifyMeshName(raw, fileLayer);
    return c === 'joints' ? 'joints' : fileLayer;
  }

  // ── Lapisan & tampilan ────────────────────────────────────────────────
  setLayerVisible(key, visible) { this.layerState[key].visible = visible; this._refreshAll(); }
  setLayerOpacity(key, opacity) { this.layerState[key].opacity = opacity; this._refreshAll(); }
  layerCounts() {
    const c = {};
    for (const e of this.entries.values()) c[e.layer] = (c[e.layer] || 0) + 1;
    return c;
  }

  _refreshAll() { for (const e of this.entries.values()) this._applyEntry(e); }

  _applyEntry(e) {
    const ls = this.layerState[e.layer] || { visible: true, opacity: 1 };
    const m = e.mesh.material;
    const inIsolation = !this.isolatedIds || this.isolatedIds.has(e.id);
    const isProblem = this.problemIds.has(e.id) || (this.presetIds?.has(e.id) ?? false);
    e.mesh.visible = (ls.visible || isProblem) && !this.hiddenIds.has(e.id) && inIsolation;

    let opacity = ls.opacity;
    const isContext = this.contextIds?.has(e.id) ?? false;
    if (isContext) e.mesh.visible = !this.hiddenIds.has(e.id) && inIsolation;
    if (this.presetIds && !isProblem && !isContext) opacity = Math.min(opacity, GHOST_OPACITY);
    if (isProblem) opacity = 1;
    m.transparent = opacity < 0.999;
    m.opacity = opacity;
    m.depthWrite = opacity > 0.5;

    if (isProblem) {
      m.color.copy(e.baseColor).lerp(PROBLEM_COLOR, 0.9);
      m.emissive.copy(PROBLEM_EMISSIVE);
      m.emissiveIntensity = 0.55;
    } else {
      m.color.copy(e.baseColor);
      m.emissive.setRGB(0, 0, 0);
      m.emissiveIntensity = 0;
    }
    if (this.selectedId === e.id) {
      m.emissive.copy(SELECT_EMISSIVE);
      m.emissiveIntensity = isProblem ? 0.35 : 0.5;
    }
    e.mesh.renderOrder = m.transparent ? 1 : 0;
    m.needsUpdate = true;
  }

  // ── Interaksi ─────────────────────────────────────────────────────────
  setMode(mode) { this.mode = mode; }

  _handleClick(ev) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [];
    for (const e of this.entries.values()) {
      if (!e.mesh.visible) continue;
      if (e.mesh.material.opacity <= GHOST_OPACITY + 0.01 && this.mode === 'select') continue;
      targets.push(e.mesh);
    }
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) { if (this.mode === 'select') this.select(null); return; }
    const id = hit.object.userData.anatomyId;
    if (this.mode === 'pin') {
      const local = this.root.worldToLocal(hit.point.clone());
      this.addPin({ point: local.toArray(), meshId: id });
    } else {
      this.select(id);
    }
  }

  select(id) {
    const prev = this.selectedId;
    this.selectedId = id;
    if (prev && this.entries.get(prev)) this._applyEntry(this.entries.get(prev));
    if (id && this.entries.get(id)) this._applyEntry(this.entries.get(id));
    this.cb.onSelect?.(id ? this._public(this.entries.get(id)) : null);
  }

  _public(e) { return e && { id: e.id, name: e.name, baseName: e.baseName, side: e.side, layer: e.layer, raw: e.raw }; }

  getEntry(id) { return this._public(this.entries.get(id)); }

  listEntries() { return [...this.entries.values()].map((e) => ({ ...this._public(e), search: e.search })); }

  toggleProblem(id, on) {
    if (on ?? !this.problemIds.has(id)) this.problemIds.add(id); else this.problemIds.delete(id);
    const e = this.entries.get(id);
    if (e) this._applyEntry(e);
    this.cb.onProblemsChange?.([...this.problemIds].map((x) => this._public(this.entries.get(x))).filter(Boolean));
  }

  clearProblems() {
    this.problemIds.clear();
    this._refreshAll();
    this.cb.onProblemsChange?.([]);
  }

  hide(id) { this.hiddenIds.add(id); this._applyEntry(this.entries.get(id)); }
  isolate(ids) { this.isolatedIds = ids ? new Set(ids) : null; this._refreshAll(); }
  showAll() { this.hiddenIds.clear(); this.isolatedIds = null; this._refreshAll(); }

  // Preset diagnosa: struktur yang cocok diwarnai merah, struktur lain transparan.
  applyPreset(regexes, layers) {
    if (!regexes) {
      this.presetIds = null;
      this.contextIds = null;
      this._refreshAll();
      return [];
    }
    if (layers) for (const l of ANATOMY_LAYERS) this.layerState[l.key].visible = layers.includes(l.key);
    const matched = [...this.entries.values()].filter((e) => regexes.some((r) => r.test(e.search)));
    // Bila preset mengenai jaringan lunak (otot, ligamen, saraf…), tulang yang ikut cocok hanya
    // dipakai sebagai patokan lokasi: tampil utuh tapi tidak merah. Preset khusus tulang
    // (mis. osteoporosis) tetap mewarnai tulangnya.
    const soft = matched.some((e) => e.layer !== 'skeleton');
    const ids = new Set(matched.filter((e) => !soft || e.layer !== 'skeleton').map((e) => e.id));
    this.contextIds = new Set(soft ? matched.filter((e) => e.layer === 'skeleton').map((e) => e.id) : []);
    this.presetIds = ids;
    this._refreshAll();
    if (matched.length) this.focusOn(ids.size ? [...ids] : [...this.contextIds]);
    return [...ids].map((id) => this._public(this.entries.get(id)));
  }

  // ── Pin penanda nyeri/lokasi ──────────────────────────────────────────
  addPin({ point, meshId, note = '' }) {
    const n = this.pins.length + 1;
    const p = new THREE.Vector3().fromArray(point);
    const r = (this._radius || 1) * 0.012;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color: '#ff1f2d', emissive: '#a00010', emissiveIntensity: 0.7 }));
    dot.position.copy(p);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(n), depthTest: false, transparent: true }));
    spr.scale.setScalar(r * 4.5);
    spr.position.copy(p).add(new THREE.Vector3(0, r * 4, 0));
    spr.renderOrder = 10;
    const g = new THREE.Group();
    g.add(dot, spr);
    this.pinGroup.add(g);
    const entry = this.entries.get(meshId);
    const pin = { id: `pin-${Date.now()}-${n}`, n, point, meshId, structure: entry?.name || '', note, obj: g };
    this.pins.push(pin);
    this._emitPins();
    return pin;
  }

  updatePinNote(id, note) {
    const p = this.pins.find((x) => x.id === id);
    if (p) { p.note = note; this._emitPins(); }
  }

  removePin(id) {
    const idx = this.pins.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const [p] = this.pins.splice(idx, 1);
    this._disposeObj(p.obj);
    // Nomor ulang supaya urut.
    this.pins.forEach((x, i) => {
      x.n = i + 1;
      const spr = x.obj.children[1];
      spr.material.map.dispose();
      spr.material.map = numberTexture(x.n);
      spr.material.needsUpdate = true;
    });
    this._emitPins();
  }

  clearPins() {
    this.pins.forEach((p) => this._disposeObj(p.obj));
    this.pins = [];
    this._emitPins();
  }

  focusPin(id) {
    const p = this.pins.find((x) => x.id === id);
    if (!p) return;
    const v = new THREE.Vector3().fromArray(p.point);
    this._flyTo(new THREE.Box3().setFromCenterAndSize(v, new THREE.Vector3(1, 1, 1).multiplyScalar((this._radius || 1) * 0.25)));
  }

  _disposeObj(g) {
    g.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    g.removeFromParent();
  }

  _emitPins() {
    this.cb.onPinsChange?.(this.pins.map(({ obj, ...rest }) => rest));
  }

  // ── Kamera ────────────────────────────────────────────────────────────
  _boxOf(ids) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) box.expandByObject(e.mesh);
    }
    return box;
  }

  frameAll(animate = true) {
    const box = new THREE.Box3();
    for (const e of this.entries.values()) if (e.mesh.visible) box.expandByObject(e.mesh);
    if (box.isEmpty()) for (const e of this.entries.values()) box.expandByObject(e.mesh);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this._radius = sphere.radius;
    this.camera.near = sphere.radius / 500;
    this.camera.far = sphere.radius * 50;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = sphere.radius * 0.02;
    this.controls.maxDistance = sphere.radius * 8;
    this._flyTo(box, animate, new THREE.Vector3(0, 0, 1));
  }

  focusOn(ids) {
    const box = this._boxOf(ids);
    if (!box.isEmpty()) this._flyTo(box);
  }

  // Arah pandang standar. Model anatomi umumnya menghadap +Z dan tegak di +Y.
  setView(view) {
    const dirs = {
      front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.001],
    };
    const box = new THREE.Box3();
    for (const e of this.entries.values()) if (e.mesh.visible) box.expandByObject(e.mesh);
    if (box.isEmpty()) return;
    // Pertahankan target saat ini bila sedang zoom ke area tertentu.
    const dist = this.camera.position.distanceTo(this.controls.target);
    const dir = new THREE.Vector3(...dirs[view]).normalize();
    this.tween = {
      start: performance.now(), dur: 650,
      fromPos: this.camera.position.clone(), toPos: this.controls.target.clone().add(dir.multiplyScalar(dist)),
      fromTarget: this.controls.target.clone(), toTarget: this.controls.target.clone(),
    };
  }

  _flyTo(box, animate = true, forceDir = null) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = Math.max(sphere.radius / Math.sin(fov / 2), (this._radius || sphere.radius) * 0.08) * 1.15;
    const dir = forceDir ? forceDir.clone() : this.camera.position.clone().sub(this.controls.target).normalize();
    if (!Number.isFinite(dir.x) || dir.lengthSq() === 0) dir.set(0, 0, 1);
    const toPos = sphere.center.clone().add(dir.multiplyScalar(dist));
    if (!animate) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(sphere.center);
      this.controls.update();
      return;
    }
    this.tween = {
      start: performance.now(), dur: 750,
      fromPos: this.camera.position.clone(), toPos,
      fromTarget: this.controls.target.clone(), toTarget: sphere.center.clone(),
    };
  }

  // ── Ekspor ────────────────────────────────────────────────────────────
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

export { LAYER_BY_KEY };
