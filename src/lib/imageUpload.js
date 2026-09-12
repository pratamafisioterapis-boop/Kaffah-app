// Downscales oversized photo uploads (phone cameras routinely produce 3000-4000px
// images) before they hit Supabase Storage. Serving a huge source image into a
// small circular avatar forces browsers into an extreme downscale ratio, which on
// several engines (notably iOS Safari) renders visibly blurry. Capping the source
// resolution keeps every avatar/photo crisp regardless of where it's displayed.
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.92;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
  img.src = url;
});

export const prepareImageForUpload = async (file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) => {
  if (!file || !file.type?.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  try {
    const img = await loadImage(file);
    const { naturalWidth: width, naturalHeight: height } = img;

    if (!width || !height || Math.max(width, height) <= maxDimension) {
      return file;
    }

    const scale = maxDimension / Math.max(width, height);
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
    if (!blob) return file;

    const ext = outputType === 'image/png' ? 'png' : 'jpg';
    const baseName = file.name?.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.${ext}`, { type: outputType });
  } catch {
    // Decode/canvas failure (corrupt file, unsupported format, tainted canvas): fall
    // back to the original file so the upload still succeeds.
    return file;
  }
};
