/**
 * Algoritma rotasi jadwal terapis-pasien — versi Sesi (Slot Global).
 *
 * Aturan yang diterapkan:
 * 1. Pasien diproses per Sesi (Slot Global) sesuai sesi yang sudah dipilih admin
 *    di halaman Jadwal Harian. Pasien tanpa sesi diproses dalam grup "Belum Ditentukan Slot".
 * 2. Terapis hanya bisa menangani pasien di sesi yang jam mulainya masuk dalam jam kerja
 *    terapis tsb (Setup > Slot Aktif Terapis). Kalau terapis belum punya data jam kerja
 *    sama sekali, dianggap tersedia sepanjang hari (supaya tidak macet total).
 * 3. Terapis yang sedang cuti/ijin di tanggal itu (Setup > Cuti/Ijin) dikeluarkan total
 *    dari perhitungan hari itu.
 * 4. 1 terapis cuma bisa pegang 1 pasien per Sesi (tidak dobel dalam sesi yang sama).
 * 5. Pasien tidak boleh dapat terapis yang sama dengan kunjungan terakhir sebelumnya
 *    (dicek dari riwayat, termasuk riwayat awal yang diinput manual).
 * 6. Beban harian terapis berbanding terbalik dengan lama bergabung: semakin lama bergabung,
 *    semakin sedikit beban yang diberikan. Dihitung dari selisih hari sejak tanggal_bergabung.
 * 7. Kalau di satu sesi benar-benar tidak ada terapis tersisa untuk seorang pasien,
 *    pasien itu masuk daftar `unassigned` (tidak dipaksakan) supaya admin tahu dan
 *    bisa pindahkan pasien itu ke sesi lain secara manual.
 */

const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const isWithinWorkingHours = (ranges, slotMinutes) => {
  if (!ranges || ranges.length === 0) return true; // belum ada data jam kerja -> anggap tersedia
  if (slotMinutes == null) return true; // pasien tanpa sesi -> tidak dibatasi jam
  return ranges.some((r) => {
    const start = timeToMinutes(r.start_time);
    const end = timeToMinutes(r.end_time);
    if (start == null || end == null) return true;
    return slotMinutes >= start && slotMinutes < end;
  });
};

/**
 * @param {Array<{id: string, name: string}>} patients
 * @param {Array<{id: string, name: string, tanggal_bergabung?: string}>} therapists
 * @param {Object<string, string>} lastVisitMap - patientId -> therapistId kunjungan terakhir
 * @param {Object<string, string>} patientSlotMap - patientId -> globalSlotId (Sesi) atau null
 * @param {Array<{id: string, start_time: string, label: string}>} globalSlots - daftar Sesi hari itu
 * @param {Object<string, Array<{start_time: string, end_time: string}>>} therapistWorkingHours
 * @param {Set<string>} leaveTherapistIds - id terapis yang cuti/ijin hari itu
 * @returns {{ assignments: Array, unassigned: Array }}
 */
export function generateSchedule({
  patients,
  therapists,
  lastVisitMap = {},
  patientSlotMap = {},
  globalSlots = [],
  therapistWorkingHours = {},
  leaveTherapistIds = new Set(),
}) {
  if (!therapists || therapists.length === 0) {
    throw new Error('Minimal 1 terapis aktif diperlukan untuk membuat jadwal.');
  }
  if (!patients || patients.length === 0) {
    return { assignments: [], unassigned: [] };
  }

  const activeTherapists = therapists.filter((th) => !leaveTherapistIds.has(th.id));
  if (activeTherapists.length === 0) {
    throw new Error('Semua terapis sedang cuti/ijin pada tanggal ini.');
  }

  const slotInfoMap = {};
  globalSlots.forEach((s) => { slotInfoMap[s.id] = s; });

  const groups = {};
  patients.forEach((p) => {
    const slotId = patientSlotMap[p.id] || 'none';
    if (!groups[slotId]) groups[slotId] = [];
    groups[slotId].push(p);
  });

  const orderedSlotIds = Object.keys(groups).sort((a, b) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    const sa = timeToMinutes(slotInfoMap[a]?.start_time) ?? 0;
    const sb = timeToMinutes(slotInfoMap[b]?.start_time) ?? 0;
    return sa - sb;
  });

  const dailyLoad = {};
  activeTherapists.forEach((th) => { dailyLoad[th.id] = 0; });

  const assignments = [];
  const unassigned = [];

  orderedSlotIds.forEach((slotId, slotIdx) => {
    const slotMinutes = slotId === 'none' ? null : timeToMinutes(slotInfoMap[slotId]?.start_time);
    const groupPatients = groups[slotId];

    let eligible = activeTherapists.filter((th) =>
      isWithinWorkingHours(therapistWorkingHours[th.id], slotMinutes)
    );
    if (eligible.length === 0) {
      eligible = [...activeTherapists];
    }

    const usedInThisSlot = new Set();

    const withHistory = groupPatients.filter((p) => lastVisitMap[p.id]);
    const withoutHistory = groupPatients.filter((p) => !lastVisitMap[p.id]);
    const orderedPatients = [...withHistory, ...withoutHistory];

    orderedPatients.forEach((patient) => {
      const avoidId = lastVisitMap[patient.id];

      let candidates = eligible.filter(
        (th) => !usedInThisSlot.has(th.id) && th.id !== avoidId
      );
      let violated = false;

      if (candidates.length === 0) {
        candidates = eligible.filter((th) => !usedInThisSlot.has(th.id));
        if (candidates.length === 0) {
          unassigned.push({ patient_id: patient.id, reason: 'Sesi penuh, tidak ada terapis tersisa' });
          return;
        }
        violated = true;
      }

      // Prioritaskan beban harian paling sedikit.
      // Terapis yang lebih lama bergabung (tanggal_bergabung lebih awal) mendapat
      // bobot beban tambahan sehingga lebih jarang dipilih saat beban setara.
      const today = Date.now();
      const seniorityBias = (th) => {
        if (!th.tanggal_bergabung) return 0;
        const joinMs = new Date(th.tanggal_bergabung).getTime();
        if (isNaN(joinMs)) return 0;
        const daysJoined = (today - joinMs) / (1000 * 60 * 60 * 24);
        // Setiap 365 hari bergabung menambah bias 0.5 (maks 2.0)
        return Math.min(2.0, (daysJoined / 365) * 0.5);
      };
      candidates.sort((a, b) => {
        const loadA = dailyLoad[a.id] + seniorityBias(a);
        const loadB = dailyLoad[b.id] + seniorityBias(b);
        return loadA - loadB;
      });

      const chosen = candidates[0];
      usedInThisSlot.add(chosen.id);
      dailyLoad[chosen.id] += 1;

      assignments.push({
        patient_id: patient.id,
        therapist_id: chosen.id,
        slot_number: slotIdx + 1,
        constraint_violated: violated,
      });
    });
  });

  return { assignments, unassigned };
}