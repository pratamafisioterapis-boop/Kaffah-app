// Aturan password di sisi aplikasi (pengganti "leaked password protection"
// Supabase yang hanya tersedia di paket Pro). Dipakai di semua form yang
// MENETAPKAN password: daftar klinik, reset/ganti password, buat akun staf.
// Login tidak divalidasi di sini, supaya password lama tetap bisa masuk.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = `min. ${PASSWORD_MIN_LENGTH} karakter`;

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000',
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'qwerty123', 'qwertyuiop', 'qwerty12', 'abc12345', 'abcd1234', 'abcdefgh1', 'asdfghjkl',
  'iloveyou', 'iloveyou1', 'welcome1', 'welcome123', 'admin123', 'admin1234', 'administrator',
  'letmein1', 'monkey123', 'dragon123', 'sunshine1', 'football1', 'master123',
  'rahasia123', 'rahasia1', 'indonesia', 'indonesia1', 'indonesia123', 'bismillah', 'bismillah1',
  'sayangku1', 'sayang123', 'kaffah123', 'kaffah1234', 'kaffah2024', 'kaffah2025', 'kaffah2026',
  'clinara123', 'clinara1234', 'fisioterapi', 'fisioterapi1', 'fisio123', 'physio123',
  'klinik123', 'terapis123', 'owner123', 'owner1234', 'superadmin1', 'superadmin123',
]);

function isTooPredictable(password) {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(password)) return true;
  // Deretan berurutan seperti 12345678 / abcdefgh.
  const run = (codes) => codes.every((c, i) => i === 0 || c - codes[i - 1] === 1);
  const codes = [...lower].map((ch) => ch.charCodeAt(0));
  return run(codes) || run([...codes].reverse());
}

/** Pemeriksaan lokal (sinkron). Mengembalikan pesan error, atau null jika lolos. */
export function getPasswordError(password) {
  const pw = password || '';
  if (pw.length < PASSWORD_MIN_LENGTH) return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (isTooPredictable(pw)) return 'Password terlalu mudah ditebak. Gunakan kombinasi yang lebih unik.';
  return null;
}

/** Validasi password (hanya aturan lokal, tanpa cek kebocoran). Mengembalikan pesan error atau null. */
export async function validatePassword(password) {
  return getPasswordError(password);
}
