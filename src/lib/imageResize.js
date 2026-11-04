// Kecilkan foto dari kamera/galeri ke JPEG maksimal `maxSize` px di sisi terpanjangnya,
// supaya unggahan ringan dan orientasi EXIF ikut dibenarkan oleh browser.
export const resizeImageToJpeg = async (file, maxSize = 1280, quality = 0.85) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Gagal memproses foto');
  return blob;
};
