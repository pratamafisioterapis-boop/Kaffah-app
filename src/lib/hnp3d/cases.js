// Data kasus untuk menu "Anatomi 3D" (viewer 3D per kasus).
// Satu kasus = satu segmen diskus. Geometri (dims/style) dipakai mesin three.js di spineScene.js,
// teks (desc/clin) dipakai panel informasi. Kasus baru ditambahkan di sini.

export const HNP_REGIONS = {
  lumbal: {
    label: 'Lumbal',
    title: 'HNP Lumbal',
    levels: ['L2', 'L3', 'L4', 'L5', 'S1'],
    dims: { rx: 1.15, rz: 0.9, hb: 0.75, hd: 0.38, spin: 0.95, spinH: 0.62, tp: 0.8 },
    style: 'traverse',
    discs: [
      {
        i: 2, name: 'L4–L5', root: 'L5',
        desc: 'Kondisi ketika inti diskus (nukleus pulposus) menonjol keluar melalui robekan cincin diskus (annulus fibrosus) dan dapat menekan akar saraf, menyebabkan nyeri, kesemutan, atau kelemahan.',
        clin: [
          ['Nyeri', 'Menjalar dari bokong ke sisi luar tungkai hingga punggung kaki (iskialgia).'],
          ['Sensorik', 'Kesemutan atau baal di punggung kaki dan ibu jari.'],
          ['Motorik', 'Kelemahan dorsofleksi pergelangan kaki dan ekstensi ibu jari (EHL).'],
        ],
      },
      {
        i: 3, name: 'L5–S1', root: 'S1',
        desc: 'Kondisi ketika inti diskus (nukleus pulposus) pada segmen L5–S1 menonjol keluar melalui robekan cincin diskus dan dapat menekan akar saraf S1, menyebabkan nyeri, kesemutan, atau kelemahan.',
        clin: [
          ['Nyeri', 'Menjalar dari bokong ke belakang paha, betis, hingga tumit.'],
          ['Sensorik', 'Kesemutan atau baal di sisi luar kaki dan telapak kaki.'],
          ['Motorik', 'Kelemahan plantarfleksi (jinjit); refleks Achilles dapat menurun.'],
        ],
      },
    ],
  },
  servikal: {
    label: 'Servikal',
    title: 'HNP Servikal',
    levels: ['C4', 'C5', 'C6', 'C7', 'T1'],
    dims: { rx: 1.0, rz: 0.72, hb: 0.62, hd: 0.34, spin: 0.62, spinH: 0.42, tp: 0.5 },
    style: 'exit',
    discs: [
      {
        i: 1, name: 'C5–C6', root: 'C6',
        desc: 'Kondisi ketika inti diskus pada segmen C5–C6 menonjol keluar melalui robekan cincin diskus dan dapat menekan akar saraf C6, menyebabkan nyeri leher yang menjalar ke lengan, kesemutan, atau kelemahan.',
        clin: [
          ['Nyeri', 'Leher menjalar ke bahu, sisi lateral lengan, hingga ibu jari dan telunjuk.'],
          ['Sensorik', 'Kesemutan atau baal di ibu jari dan telunjuk.'],
          ['Motorik', 'Kelemahan fleksi siku dan ekstensi pergelangan tangan; refleks bisep dapat menurun.'],
        ],
      },
      {
        i: 2, name: 'C6–C7', root: 'C7',
        desc: 'Kondisi ketika inti diskus pada segmen C6–C7 menonjol keluar melalui robekan cincin diskus dan dapat menekan akar saraf C7, menyebabkan nyeri leher yang menjalar ke lengan, kesemutan, atau kelemahan.',
        clin: [
          ['Nyeri', 'Leher menjalar ke belakang lengan hingga jari tengah.'],
          ['Sensorik', 'Kesemutan atau baal di jari tengah.'],
          ['Motorik', 'Kelemahan ekstensi siku dan fleksi pergelangan; refleks triseps dapat menurun.'],
        ],
      },
    ],
  },
};

export const HNP_LAYERS = [
  { key: 'bone', name: 'Tulang Belakang (Vertebra)', color: '#4f9bff' },
  { key: 'disc', name: 'Diskus Intervertebralis', color: '#d9d2ea' },
  { key: 'hernia', name: 'Herniasi Diskus (HNP)', color: '#ff4a3a' },
  { key: 'nerve', name: 'Akar Saraf', color: '#f3c63a' },
  { key: 'lig', name: 'Ligamen', color: '#c9d1db' },
];
export const HNP_DEFAULT_LAYERS = { bone: true, disc: true, hernia: true, nerve: true, lig: false };

// ── Frozen shoulder ────────────────────────────────────────────────────────
export const SHOULDER_STAGES = [
  {
    k: 1, name: 'Frozen', sub: '(Painful Stage)', dur: '± 2–9 bulan',
    path: 'Sinovitis pada kapsul sendi bahu. Nyeri hebat, terutama malam hari dan saat bergerak; gerak mulai terbatas.',
    rom: { flexion: 120, abduction: 100, er: 40 },
    therapy: [
      'Kendalikan nyeri: edukasi, modalitas pereda nyeri (mis. TENS atau kompres), dan aktivitas dalam batas nyeri.',
      'Latihan pendulum serta gerak pasif atau aktif-asistif ringan dalam rentang tanpa nyeri.',
      'Hindari peregangan agresif yang memicu nyeri hebat.',
      'Koordinasikan dengan dokter untuk obat atau injeksi kortikosteroid bila diperlukan.',
    ],
  },
  {
    k: 2, name: 'Frozen', sub: '(Stiffness Stage)', dur: '± 4–12 bulan',
    path: 'Kapsul menebal dan mengerut, adhesi matang. Nyeri berkurang tetapi kaku mendominasi, terutama rotasi eksternal.',
    rom: { flexion: 90, abduction: 80, er: 15 },
    therapy: [
      'Mobilisasi sendi glenohumeral (grade I–II, lalu III–IV sesuai toleransi) dan peregangan kapsul progresif.',
      'Latihan ROM aktif-asistif: tongkat (wand), wall climb, cross-body stretch.',
      'Fokus pada rotasi eksternal dan abduksi yang paling terbatas.',
      'Latihan skapula dan postur untuk mengurangi gerak kompensasi.',
    ],
  },
  {
    k: 3, name: 'Thawing', sub: '(Recovery Stage)', dur: '± 6–24 bulan',
    path: 'Kapsul berangsur melonggar dan adhesi mengendur. Gerak pulih bertahap, nyeri minimal.',
    rom: { flexion: 130, abduction: 110, er: 35 },
    therapy: [
      'Lanjutkan peregangan untuk mempertahankan dan menambah ROM.',
      'Penguatan rotator cuff dan stabilisator skapula (isometrik, lalu theraband).',
      'Latihan fungsional: menjangkau ke atas dan ke belakang punggung.',
      'Evaluasi berkala; rujuk kembali bila tidak membaik.',
    ],
  },
];
export const SHOULDER_MOTIONS = [
  { key: 'flexion', label: 'Fleksi', hint: 'angkat ke depan', normal: 180 },
  { key: 'abduction', label: 'Abduksi', hint: 'angkat ke samping', normal: 180 },
  { key: 'er', label: 'Rotasi Eksternal', hint: 'putar ke luar', normal: 90 },
];
export const SHOULDER_CASE = {
  title: 'Frozen Shoulder',
  sub: '(Adhesive Capsulitis)',
  desc: 'Kondisi ketika kapsul sendi bahu mengalami peradangan, penebalan, dan pengerutan, yang menyebabkan nyeri, kaku, dan keterbatasan gerak bahu.',
  mechanism: [
    'Sinovitis: lapisan dalam kapsul glenohumeral meradang.',
    'Fibrosis: kapsul menebal dan mengerut sehingga volume sendi menyusut.',
    'Recessus aksilaris melipat dan melekat (adhesi) pada kepala humerus.',
    'Ligamen coracohumeral dan rotator interval menebal, sehingga rotasi eksternal terbatas paling awal.',
  ],
  tabs: [['anatomi', 'Anatomi'], ['patologi', 'Patologi'], ['gerakan', 'Gerakan'], ['terapi', 'Terapi']],
};

export const CASE_OPTIONS = [
  ...Object.entries(HNP_REGIONS).flatMap(([rk, r]) => r.discs.map((d, i) => ({ value: `hnp:${rk}:${i}`, label: `${r.title} (${d.name})`, kind: 'hnp' }))),
  { value: 'shoulder:frozen', label: 'Frozen Shoulder', kind: 'shoulder' },
];
