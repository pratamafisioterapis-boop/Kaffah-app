// Lapisan (sistem tubuh) untuk menu Anatomi 3D terapis.
//
// File model disimpan di bucket Supabase publik `anatomy-3d` dengan nama `<key>.glb`
// (mis. `muscles.glb`). Boleh juga satu file gabungan `full.glb`: setiap mesh lalu
// dikelompokkan ke lapisan dari namanya (lihat classifyMeshName).
//
// Warna dan material dipilih mendekati jaringan asli (tulang gading, otot merah tua,
// ligamen/kartilago putih kebiruan, saraf kuning, arteri merah, vena biru), dipakai
// hanya bila model tidak membawa tekstur sendiri.

export const ANATOMY_BUCKET = 'anatomy-3d';
export const COMBINED_MODEL_FILE = 'full.glb';

export const ANATOMY_LAYERS = [
  { key: 'skeleton', label: 'Tulang', color: '#e9dcc3', roughness: 0.62, metalness: 0, clearcoat: 0.15, sheen: 0, defaultOn: true },
  { key: 'joints', label: 'Sendi, Ligamen & Kartilago', color: '#d9e4ea', roughness: 0.38, metalness: 0, clearcoat: 0.55, sheen: 0, defaultOn: true },
  { key: 'muscles', label: 'Otot & Tendon', color: '#9e2b25', roughness: 0.48, metalness: 0, clearcoat: 0.35, sheen: 0.6, sheenColor: '#d86a5c', defaultOn: true },
  { key: 'nerves', label: 'Saraf', color: '#e8c95a', roughness: 0.45, metalness: 0, clearcoat: 0.4, sheen: 0.2, defaultOn: false },
  { key: 'arteries', label: 'Arteri', color: '#c4161c', roughness: 0.32, metalness: 0, clearcoat: 0.7, sheen: 0, defaultOn: false },
  { key: 'veins', label: 'Vena', color: '#2f4f9e', roughness: 0.32, metalness: 0, clearcoat: 0.7, sheen: 0, defaultOn: false },
  { key: 'organs', label: 'Organ Dalam', color: '#b5655a', roughness: 0.5, metalness: 0, clearcoat: 0.45, sheen: 0.3, defaultOn: false },
  { key: 'skin', label: 'Kulit', color: '#d7a98c', roughness: 0.6, metalness: 0, clearcoat: 0.1, sheen: 0.4, defaultOn: false, defaultOpacity: 0.35 },
];

export const LAYER_BY_KEY = Object.fromEntries(ANATOMY_LAYERS.map((l) => [l.key, l]));

// Urutan cek penting: "nerve" harus dicek sebelum "muscle" (mis. "musculocutaneous nerve"),
// dan pembuluh sebelum otot ("muscular branch of artery").
const RULES = [
  ['nerves', /\b(nerve|nervus|nervi|plexus|ganglion|spinal cord|medulla spinalis|cauda equina|rootlet|ramus (?:anterior|posterior|ventralis|dorsalis))\b/],
  ['arteries', /\b(artery|arteria|arteriae|aorta|aortic|trunk(?:us)? (?:brachiocephalic|coeliac|celiac))\b/],
  ['veins', /\b(vein|vena|venae|venous|sinus (?:sagittal|transverse|sigmoid)|saphenous)\b/],
  ['joints', /\b(ligament|ligamentum|ligamenta|cartilage|cartilago|menisc(?:us|i)|labrum|intervertebral dis[ck]|discus|annulus|nucleus pulposus|joint capsule|capsula|bursa|syndesmosis|symphysis|retinacul(?:um|a))\b/],
  ['muscles', /\b(muscle|musculus|musculi|tendon|tendo|aponeuros[ie]s|fascia|diaphragm|rotator cuff|head of .* muscle)\b/],
  ['skin', /\b(skin|cutis|integument)\b/],
  ['organs', /\b(heart|lung|liver|kidney|stomach|intestin|colon|spleen|pancreas|bladder|brain|cerebr|cerebell|esophag|trachea|bronch|thyroid|eye|bulbus oculi)\b/],
  ['skeleton', /\b(bone|os|ossa|vertebra|vertebrae|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|clavicula|patella|pelvis|sacrum|coccyx|rib|costa|sternum|skull|cranium|mandible|mandibula|maxilla|carpal|metacarpal|phalan|tarsal|metatarsal|calcaneus|talus|ilium|ischium|pubis|atlas|axis|hip bone)\b/],
];

const normalize = (name) => String(name || '')
  .replace(/[_]+/g, ' ')
  .replace(/\.(?:l|r|left|right|\d{3})$/i, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// Tentukan lapisan dari nama mesh. `fallback` = lapisan dari nama file bila tidak cocok.
export const classifyMeshName = (name, fallback = 'skeleton') => {
  const n = normalize(name);
  for (const [key, re] of RULES) if (re.test(n)) return key;
  return fallback;
};

// Nama tampilan yang rapi + sisi tubuh (Z-Anatomy memakai akhiran .l/.r, BodyParts3D
// menulis "left"/"right" di depan).
export const displayNameOf = (rawName) => {
  const raw = String(rawName || '').replace(/_/g, ' ').trim();
  let side = '';
  if (/\.(l|left)(\.\d+)?$/i.test(raw) || /^left\b/i.test(raw) || /\bleft$/i.test(raw)) side = 'kiri';
  else if (/\.(r|right)(\.\d+)?$/i.test(raw) || /^right\b/i.test(raw) || /\bright$/i.test(raw)) side = 'kanan';
  const base = raw
    .replace(/\.(l|r|left|right)(\.\d+)?$/i, '')
    .replace(/\.\d{3}$/, '')
    .replace(/^(left|right)\s+/i, '')
    .replace(/\s+(left|right)$/i, '')
    .trim();
  const pretty = base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Struktur tanpa nama';
  return { name: pretty, side, label: side ? `${pretty} (${side})` : pretty };
};

export const searchTextOf = (rawName) => normalize(rawName);
