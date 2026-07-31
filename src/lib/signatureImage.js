// Signature scans uploaded by therapists often come as a photo/screenshot with
// a faint off-white/gray background and low-contrast ink, which shows up as a
// visible box behind the signature on invoices and reads as "blurry". This
// strips the background to transparent and boosts ink contrast client-side,
// working directly on pixel data so the result is a real image (not a CSS
// effect) — it renders identically in the on-screen preview and in the
// html2canvas-rasterized PDF/print output.
//
// Background color varies per upload (white paper, gray photo, even a dark
// backdrop), so instead of assuming "light background, dark ink" we sample
// the image's own corners to find the actual background luminance and treat
// ink as whatever stands out from it, in either direction.
const CONTRAST = 1.9;
const NEAR_DIFF = 30; // luminance distance from background at/below which a pixel is background → transparent
const FAR_DIFF = 115; // luminance distance from background at/above which a pixel is ink → opaque
const CORNER_SAMPLE_SIZE = 8; // px block sampled from each corner to estimate background luminance
const TRANSPARENT_ALPHA_THRESHOLD = 10; // original alpha below this is treated as already-transparent

function enhanceChannel(value) {
  return Math.min(255, Math.max(0, (value - 128) * CONTRAST + 128));
}

function enhancedLuminanceAt(px, i) {
  const r = enhanceChannel(px[i]);
  const g = enhanceChannel(px[i + 1]);
  const b = enhanceChannel(px[i + 2]);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sampleBackgroundLuminance(px, width, height) {
  const corners = [
    [0, 0],
    [width - CORNER_SAMPLE_SIZE, 0],
    [0, height - CORNER_SAMPLE_SIZE],
    [width - CORNER_SAMPLE_SIZE, height - CORNER_SAMPLE_SIZE],
  ];

  let total = 0;
  let count = 0;
  for (const [startX, startY] of corners) {
    const x0 = Math.max(0, startX);
    const y0 = Math.max(0, startY);
    for (let y = y0; y < Math.min(height, y0 + CORNER_SAMPLE_SIZE); y++) {
      for (let x = x0; x < Math.min(width, x0 + CORNER_SAMPLE_SIZE); x++) {
        const i = (y * width + x) * 4;
        if (px[i + 3] < TRANSPARENT_ALPHA_THRESHOLD) continue; // already transparent, not real background
        total += enhancedLuminanceAt(px, i);
        count++;
      }
    }
  }

  return count ? total / count : 255;
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
        const bgLuminance = sampleBackgroundLuminance(px, canvas.width, canvas.height);

        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < TRANSPARENT_ALPHA_THRESHOLD) {
            // Preserve pixels that were already transparent in the source image.
            px[i + 3] = 0;
            continue;
          }

          const r = enhanceChannel(px[i]);
          const g = enhanceChannel(px[i + 1]);
          const b = enhanceChannel(px[i + 2]);
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          const diff = Math.abs(luminance - bgLuminance);

          let alpha;
          if (diff <= NEAR_DIFF) {
            alpha = 0;
          } else if (diff >= FAR_DIFF) {
            alpha = 255;
          } else {
            alpha = Math.round(255 * (diff - NEAR_DIFF) / (FAR_DIFF - NEAR_DIFF));
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
