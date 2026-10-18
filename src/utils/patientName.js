import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

// Huruf pertama tiap kata nama jadi kapital ("budi santoso" -> "Budi Santoso").
// Gelar dibiarkan apa adanya: bagian setelah koma ("Adi, S.Fis") dan kata
// bertitik ("dr.", "H.", "S.Kep") tidak diubah. Huruf selain huruf pertama
// tidak disentuh, jadi "McDonald" / "SKM" tetap utuh.
export const capitalizeNameWords = (name) => {
  if (typeof name !== 'string' || !name) return name;
  const [main, ...rest] = name.split(',');
  const fixed = main
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok.trim() || tok.includes('.')) return tok;
      return tok.replace(/(^|[-'’])(\p{Ll})/gu, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join('');
  return [fixed, ...rest].join(',');
};

// Aturan ini hanya berlaku untuk klinik Kaffah Physiotherapy.
export const formatPatientNameForClinic = (name, clinicId) =>
  clinicId === KAFFAH_CLINIC_ID ? capitalizeNameWords(name) : name;
