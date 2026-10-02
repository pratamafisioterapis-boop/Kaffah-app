// Pembantu checklist Plan SOAP. Pilihan modalitas/manual therapy (tabel plan_options)
// dan exercise per diagnosa (diagnosis_exercise_plans, plan_exercises) diambil dari database.

export const PHASE_TITLES = ['Fase 1 - Awal', 'Fase 2 - Menengah', 'Fase 3 - Lanjut'];

// Pilihan yang harus selalu tersedia walau belum ada di database.
export const REQUIRED_MANUAL_OPTIONS = ['Dry needling'];

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

const withDose = (name, dose) => (dose?.trim() ? `${name} (${dose.trim()})` : name);

// Teks ringkasan Plan yang disimpan di kolom `plan` (tetap terbaca di riwayat SOAP).
// data.dose: { [nama modalitas/manual]: dosis }, data.exDose: { [id exercise]: dosis kustom }
export const buildPlanText = (data, phases, lib) => {
  const lines = [];
  if (data.epa?.length) lines.push(`Modalitas elektrofisis: ${data.epa.map((n) => withDose(n, data.dose?.[n])).join(', ')}`);
  if (data.manual?.length) lines.push(`Manual therapy: ${data.manual.map((n) => withDose(n, data.dose?.[n])).join(', ')}`);
  const doseOf = (id) => data.exDose?.[id]?.trim() || lib[id].d;
  const fmt = (id) => (doseOf(id) ? `${lib[id].n} (${doseOf(id)})` : lib[id].n);
  const inPhase = new Set(phases.flat());
  const exLines = phases
    .map((ids, i) => {
      const done = ids.filter((id) => data.exercises?.[id] && lib[id]);
      return done.length ? `${PHASE_TITLES[i]}: ${done.map(fmt).join('; ')}` : '';
    })
    .filter(Boolean);
  const extra = Object.keys(data.exercises || {}).filter((id) => data.exercises[id] && lib[id] && !inPhase.has(id));
  if (extra.length) exLines.push(`Tambahan: ${extra.map(fmt).join('; ')}`);
  if (exLines.length) lines.push('Exercise:', ...exLines);
  if (data.notes?.trim()) lines.push(`Catatan: ${data.notes.trim()}`);
  return lines.join('\n');
};
