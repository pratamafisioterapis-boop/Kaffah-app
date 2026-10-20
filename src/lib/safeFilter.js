// Proteksi injection untuk filter PostgREST (`.or()` / `.ilike()` dengan string
// template) dan untuk HTML yang ditulis lewat document.write.
//
// Supabase `.or('a.ilike.%x%,b.eq.y')` mem-parse string mentah: koma, kurung,
// dan kutip dari input user bisa menambah/mengubah kondisi filter (mis. membuat
// filter menjadi `...,id.not.is.null` dan membocorkan baris lain). Selalu
// lewatkan input user lewat sanitizeSearchTerm() sebelum diselipkan ke string.

/** Buang karakter yang punya arti khusus di sintaks filter PostgREST / LIKE. */
export function sanitizeSearchTerm(value, maxLength = 100) {
  return String(value ?? '')
    .replace(/[,()"'\\%*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Hanya izinkan UUID / angka untuk nilai yang diselipkan ke filter `.eq.` / `.in.`. */
export function sanitizeIdList(ids) {
  return (ids || [])
    .map((v) => String(v))
    .filter((v) => /^[0-9a-zA-Z_-]{1,64}$/.test(v));
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape teks agar aman disisipkan ke HTML mentah (anti-XSS). */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
