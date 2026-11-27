// Kuesioner feedback Praxis. Default di bawah dipakai bila owner belum
// mengustomisasi (clinics.feedback_questionnaire kosong).
// Tipe: 'choice' (pilih satu) | 'text' (satu baris) | 'textarea' (teks panjang) |
// 'therapist' (pilih nama terapis aktif klinik; daftar diambil dari get_feedback_staff).
// Tepat satu pertanyaan 'choice' bertanda isRating=true; urutan opsinya
// (terbaik -> terburuk) dipetakan ke rating 5 -> 1.
export const SCALE_PUAS = ['Sangat Puas', 'Puas', 'Cukup Puas', 'Tidak Puas', 'Sangat Tidak Puas'];

export const DEFAULT_PRAXIS_QUESTIONS = [
  { id: 'reg', type: 'choice', required: true, label: 'Kemudahan proses Pendaftaran / Administrasi / Reservasi', options: SCALE_PUAS },
  { id: 'wait', type: 'choice', required: true, label: 'Waktu Anda menunggu hingga dilayani', options: ['< 10 Menit', '10 - 20 menit', '> 20 Menit'] },
  { id: 'info', type: 'choice', required: true, label: 'Petugas Pendaftaran memberikan informasi layanan dengan jelas', options: ['Ya', 'Tidak'] },
  { id: 'service', type: 'choice', required: true, label: 'Layanan yang dijalani di {clinic}', options: ['Layanan Dokter', 'Layanan Fisioterapi', 'Layanan Keperawatan'] },
  { id: 'listen', type: 'choice', required: true, label: 'Tenaga Medis Dokter / Fisioterapis / Keperawatan mendengarkan keluhan dengan baik', options: SCALE_PUAS },
  { id: 'care', type: 'choice', required: true, label: 'Pelayanan dan Tindakan oleh Tenaga Medis Dokter / Fisioterapis / Keperawatan', options: SCALE_PUAS },
  { id: 'clean', type: 'choice', required: true, label: 'Kebersihan dan Kenyamanan Ruang tunggu', options: SCALE_PUAS },
  { id: 'facility', type: 'choice', required: true, label: 'Fasilitas pendukung (toilet, AC, parkir)', options: SCALE_PUAS },
  { id: 'overall', type: 'choice', required: true, isRating: true, label: 'Kepuasan pelayanan di {clinic} secara menyeluruh', options: SCALE_PUAS },
  { id: 'return', type: 'choice', required: true, label: 'Saya bersedia kembali berobat ke klinik ini di masa depan', options: ['Ya', 'Tidak', 'Ragu-ragu'] },
  { id: 'staff', type: 'therapist', required: false, label: 'Nama petugas kami yang telah memberikan pelayanan terbaik (Dokter/Fisioterapis/Perawat/dan lainnya)' },
  { id: 'suggestion', type: 'textarea', required: false, label: 'Saran & Masukan sangat berharga untuk perbaikan pelayanan' },
];

// Kuesioner khusus kunjungan HOMECARE (terapi di rumah pasien): tanpa pendaftaran, ruang tunggu, dan fasilitas klinik.
export const DEFAULT_HOMECARE_QUESTIONS = [
  { id: 'book', type: 'choice', required: true, label: 'Kemudahan proses pemesanan / reservasi kunjungan homecare', options: SCALE_PUAS },
  { id: 'ontime', type: 'choice', required: true, label: 'Ketepatan waktu kedatangan terapis sesuai jadwal', options: ['Tepat waktu', 'Terlambat < 15 menit', 'Terlambat > 15 menit'] },
  { id: 'explain', type: 'choice', required: true, label: 'Terapis menjelaskan kondisi dan rencana terapi dengan jelas', options: ['Ya', 'Tidak'] },
  { id: 'listen', type: 'choice', required: true, label: 'Fisioterapis mendengarkan keluhan dengan baik', options: SCALE_PUAS },
  { id: 'care', type: 'choice', required: true, label: 'Pelayanan dan tindakan oleh fisioterapis', options: SCALE_PUAS },
  { id: 'attitude', type: 'choice', required: true, label: 'Sikap dan keramahan terapis selama di rumah Anda', options: SCALE_PUAS },
  { id: 'equipment', type: 'choice', required: true, label: 'Kelengkapan dan kebersihan peralatan yang dibawa terapis', options: SCALE_PUAS },
  { id: 'overall', type: 'choice', required: true, isRating: true, label: 'Kepuasan layanan {clinic} Homecare secara menyeluruh', options: SCALE_PUAS },
  { id: 'return', type: 'choice', required: true, label: 'Saya bersedia memakai layanan homecare ini lagi', options: ['Ya', 'Tidak', 'Ragu-ragu'] },
  { id: 'staff', type: 'therapist', required: false, label: 'Nama terapis yang memberikan pelayanan terbaik' },
  { id: 'suggestion', type: 'textarea', required: true, label: 'Saran & Masukan sangat berharga untuk perbaikan pelayanan' },
];

// Opsi ke-i dari n (0 = terbaik) -> rating 5..1.
export const ratingFromOption = (options, value) => {
  const idx = options.indexOf(value);
  if (idx < 0) return 3;
  if (options.length < 2) return 5;
  return Math.max(1, Math.min(5, Math.round(5 - (idx * 4) / (options.length - 1))));
};

// Validasi/normalisasi dari JSON tersimpan; null bila tidak valid.
export const normalizeQuestions = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = raw
    .filter((q) => q && typeof q.label === 'string' && q.label.trim())
    .map((q, i) => ({
      id: String(q.id || `q${i + 1}`),
      type: ['choice', 'text', 'textarea', 'therapist'].includes(q.type) ? q.type : 'text',
      required: !!q.required,
      isRating: !!q.isRating,
      label: q.label.trim(),
      options: Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [],
    }))
    .filter((q) => q.type !== 'choice' || q.options.length >= 2);
  return out.length ? out : null;
};
