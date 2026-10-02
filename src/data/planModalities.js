// Pilihan checklist Plan SOAP untuk modalitas elektrofisis dan manual therapy.
// (Exercise per diagnosa ada di planExercises.js.)

export const EPA_OPTIONS = [
  'Hot pack',
  'Cold pack / cryotherapy',
  'Infrared (IR)',
  'TENS',
  'Ultrasound (US)',
  'Interferential current (IFC)',
  'Shortwave diathermy (SWD)',
  'Microwave diathermy (MWD)',
  'Low level laser (LLLT)',
  'Shockwave (ESWT)',
  'Electrical stimulation otot (NMES)',
  'Functional electrical stimulation (FES)',
  'Traksi mekanik',
  'Paraffin bath',
  'Magnetic therapy',
];

export const MANUAL_OPTIONS = [
  'Soft tissue mobilization / massage',
  'Myofascial release',
  'Trigger point release',
  'Muscle energy technique (MET)',
  'Joint mobilization (Maitland)',
  'Mulligan (MWM / SNAGs)',
  'Traksi manual',
  'Neural mobilization',
  'Stretching pasif / PNF',
  'Kinesio taping',
  'IASTM',
  'Manipulasi (HVLA)',
  'Drainase limfatik manual',
  'Postural drainage, perkusi & vibrasi',
];

export const PHASE_TITLES = ['Fase 1 - Awal', 'Fase 2 - Menengah', 'Fase 3 - Lanjut'];

// Gabungkan latihan beberapa diagnosa per fase (tanpa duplikat, urutan terjaga).
export const mergePlanPhases = (diagnosisLabels, byDiagnosis) => {
  const phases = [[], [], []];
  const cautions = [];
  const unknown = [];
  diagnosisLabels.forEach((label) => {
    const entry = byDiagnosis[String(label).trim().toLowerCase()];
    if (!entry) { unknown.push(label); return; }
    entry.f.forEach((ids, i) => ids.forEach((id) => { if (!phases[i].includes(id)) phases[i].push(id); }));
    if (entry.c && !cautions.some((c) => c.text === entry.c)) cautions.push({ label, text: entry.c });
  });
  return { phases, cautions, unknown };
};

// Teks ringkasan Plan yang disimpan di kolom `plan` (tetap terbaca di riwayat SOAP).
export const buildPlanText = (data, phases, lib) => {
  const lines = [];
  if (data.epa?.length) lines.push(`Modalitas elektrofisis: ${data.epa.join(', ')}`);
  if (data.manual?.length) lines.push(`Manual therapy: ${data.manual.join(', ')}`);
  const exLines = phases
    .map((ids, i) => {
      const done = ids.filter((id) => data.exercises?.[id] && lib[id]);
      return done.length ? `${PHASE_TITLES[i]}: ${done.map((id) => `${lib[id].n} (${lib[id].d})`).join('; ')}` : '';
    })
    .filter(Boolean);
  if (exLines.length) lines.push('Exercise:', ...exLines);
  if (data.notes?.trim()) lines.push(`Catatan: ${data.notes.trim()}`);
  return lines.join('\n');
};
