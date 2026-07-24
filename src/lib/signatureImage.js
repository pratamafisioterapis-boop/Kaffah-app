// Signature scans uploaded by therapists often come as a photo/screenshot with
// a faint off-white/gray background and low-contrast ink, which shows up as a
// visible box behind the signature on invoices and reads as "blurry". This
// strips the background to transparent and boosts ink contrast client-side,
// working directly on pixel data so the result is a real image (not a CSS
// effect) — it renders identically in the on-screen preview and in the
// html2canvas-rasterized PDF/print output.
const CONTRAST = 1.9;
const BG_LUMINANCE_THRESHOLD = 225; // at/above this → treated as background, fully transparent
const FG_LUMINANCE_THRESHOLD = 140; // at/below this → treated as ink, fully opaque

function enhanceChannel(value) {
  return Math.min(255, Math.max(0, (value - 128) * CONTRAST + 128));
}

export function stripSignatureBackground(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(url);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;

        for (let i = 0; i < px.length; i += 4) {
          const r = enhanceChannel(px[i]);
          const g = enhanceChannel(px[i + 1]);
          const b = enhanceChannel(px[i + 2]);
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

          let alpha;
          if (luminance >= BG_LUMINANCE_THRESHOLD) {
            alpha = 0;
          } else if (luminance <= FG_LUMINANCE_THRESHOLD) {
            alpha = 255;
          } else {
            alpha = Math.round(
              255 * (BG_LUMINANCE_THRESHOLD - luminance) / (BG_LUMINANCE_THRESHOLD - FG_LUMINANCE_THRESHOLD)
            );
          }

          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = alpha;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('stripSignatureBackground failed, using original image:', err);
        resolve(url);
      }
    };

    img.onerror = () => resolve(url);
    img.src = url;
  });
}
