/**
 * Algoritma rotasi jadwal terapis-pasien.
 *
 * Aturan:
 * 1. Pasien dibagi rata ke semua terapis aktif (misal 10 pasien / 2 terapis = 5-5).
 * 2. Pasien TIDAK BOLEH mendapat terapis yang sama dengan kunjungan sebelumnya
 *    (dicek dari riwayat kunjungan terakhir per pasien).
 * 3. Kalau syarat #2 benar-benar tidak mungkin dipenuhi (misal cuma ada 1 terapis
 *    aktif hari itu), sistem tetap membuat jadwal tapi menandai baris itu
 *    `constraint_violated: true` supaya kelihatan jujur ke admin.
 * 4. Setiap pasien diberi nomor slot: slot 1 = pasien pertama tiap terapis,
 *    slot 2 = pasien kedua tiap terapis, dst. Jadi 1 slot = beberapa pasien
 *    (satu per terapis) yang ditangani bersamaan.
 *
 * @param {Array<{id: string, name: string}>} patients - pasien yang datang hari ini
 * @param {Array<{id: string, name: string}>} therapists - terapis aktif hari ini
 * @param {Object<string, string>} lastVisitMap - patientId -> therapistId kunjungan terakhir (sebelum hari ini)
 * @returns {Array<{patient_id: string, therapist_id: string, slot_number: number, constraint_violated: boolean}>}
 */
export function generateSchedule({ patients, therapists, lastVisitMap = {} }) {
  if (!therapists || therapists.length === 0) {
    throw new Error('Minimal 1 terapis aktif diperlukan untuk membuat jadwal.');
  }
  if (!patients || patients.length === 0) {
    return [];
  }

  const n = patients.length;
  const t = therapists.length;
  const base = Math.floor(n / t);
  const remainder = n % t;

  // Kapasitas target per terapis (dibagi serata mungkin)
  const capacity = {};
  therapists.forEach((th, idx) => {
    capacity[th.id] = base + (idx < remainder ? 1 : 0);
  });

  const load = {};
  therapists.forEach((th) => {
    load[th.id] = 0;
  });

  // Proses pasien yang punya riwayat (harus dihindari terapis tertentu) lebih dulu,
  // supaya mereka kebagian slot di terapis yang valid sebelum kapasitas penuh.
  const withHistory = patients.filter((p) => lastVisitMap[p.id]);
  const withoutHistory = patients.filter((p) => !lastVisitMap[p.id]);

  const assignments = [];

  const assignOne = (patient, avoidTherapistId) => {
    // Kandidat ideal: bukan terapis yang harus dihindari, dan masih ada kapasitas
    let candidates = therapists.filter(
      (th) => th.id !== avoidTherapistId && load[th.id] < capacity[th.id]
    );
    let violated = false;

    if (candidates.length === 0) {
      // Kapasitas ideal penuh semua -> longgarkan kapasitas, tapi tetap hindari terapis lama
      candidates = therapists.filter((th) => th.id !== avoidTherapistId);
    }

    if (candidates.length === 0) {
      // Cuma ada 1 terapis total dan itu yang harus dihindari -> terpaksa dilanggar
      candidates = [...therapists];
      violated = true;
    }

    // Pilih kandidat dengan beban paling sedikit (biar tetap merata)
    candidates.sort((a, b) => load[a.id] - load[b.id]);
    const chosen = candidates[0];
    load[chosen.id] += 1;

    assignments.push({
      patient_id: patient.id,
      therapist_id: chosen.id,
      constraint_violated: violated,
    });
  };

  withHistory.forEach((p) => assignOne(p, lastVisitMap[p.id]));
  withoutHistory.forEach((p) => assignOne(p, null));

  // Beri nomor slot: dikelompokkan per terapis sesuai urutan penugasan
  const perTherapist = {};
  therapists.forEach((th) => {
    perTherapist[th.id] = [];
  });
  assignments.forEach((a) => perTherapist[a.therapist_id].push(a));

  Object.values(perTherapist).forEach((list) => {
    list.forEach((a, idx) => {
      a.slot_number = idx + 1;
    });
  });

  // Urutkan hasil akhir: berdasarkan slot lalu nama terapis, biar enak dibaca di tabel
  assignments.sort((a, b) => {
    if (a.slot_number !== b.slot_number) return a.slot_number - b.slot_number;
    return a.therapist_id.localeCompare(b.therapist_id);
  });

  return assignments;
}