// Jawaban untuk /assets/* yang filenya tidak ada (chunk berhash dari build lama,
// atau deploy yang belum selesai menyebar). vercel.json memberi semua /assets/*
// Cache-Control "immutable" satu tahun, termasuk jawaban 404; browser lalu
// mengingat "tidak ada" itu dan chunk tetap gagal dimuat walau filenya sudah ada.
// Rewrite di vercel.json hanya sampai ke sini bila file statisnya tidak ditemukan.
export default function handler(req, res) {
  res.statusCode = 404;
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}
