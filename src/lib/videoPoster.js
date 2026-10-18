// Gambar sampul video latihan: satu bingkai (detik ke-0.5) disimpan sebagai JPG kecil di
// exercise-videos/posters/<kode>.jpg. Portal pasien menampilkan gambar ini, bukan memuat videonya,
// supaya daftar latihan langsung tampil. Edge Function portal-exercise-video memakai pola nama yang sama.
export const posterPath = (exerciseId) => `posters/${exerciseId}.jpg`;

const POSTER_WIDTH = 480;

// src: object URL berkas lokal atau tautan bertanda tangan (Supabase Storage mengizinkan CORS).
export const captureVideoFrame = (src, at = 0.5) =>
  new Promise((resolve, reject) => {
    const v = document.createElement('video');
    let done = false;
    const finish = (fn, val) => { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); v.load(); fn(val); };
    const timer = setTimeout(() => finish(reject, new Error('Waktu habis saat membaca video')), 30000);
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadedmetadata = () => { v.currentTime = Math.min(at, (v.duration || 1) / 2); };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, POSTER_WIDTH / (v.videoWidth || POSTER_WIDTH));
        const c = document.createElement('canvas');
        c.width = Math.round((v.videoWidth || POSTER_WIDTH) * scale);
        c.height = Math.round((v.videoHeight || POSTER_WIDTH * 0.75) * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? finish(resolve, b) : finish(reject, new Error('Gagal membuat gambar'))), 'image/jpeg', 0.8);
      } catch (e) {
        finish(reject, e);
      }
    };
    v.onerror = () => finish(reject, new Error('Video tidak bisa dibaca'));
    v.src = src;
  });
