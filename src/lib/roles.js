// Role admin klinik hanya satu nama: 'admin'. Nilai lama 'clinic_admin'
// dipetakan ke 'admin' supaya data/sesi yang belum termigrasi tetap bekerja.
export const normalizeRole = (role) => (role === 'clinic_admin' ? 'admin' : role);
