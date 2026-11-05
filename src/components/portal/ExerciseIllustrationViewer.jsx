import React, { useRef, useState } from 'react';

export default function ExerciseIllustrationViewer({ title, images }) {
  const [active, setActive] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [failedUrl, setFailedUrl] = useState(null);
  const touch = useRef(null);
  if (!images) return <p role="status">Memuat ilustrasi...</p>;
  if (!images.length) return <p role="status">Ilustrasi belum bisa dimuat. Ikuti instruksi di bawah.</p>;
  const index = Math.min(active, images.length - 1);
  const image = images[index];
  const move = (delta) => setActive(Math.max(0, Math.min(images.length - 1, index + delta)));
  return (
    <div aria-label={`Ilustrasi ${title}`}>
      <div style={{ position: 'relative', minHeight: 120, touchAction: 'pan-y' }}
        onTouchStart={(event) => { touch.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touch.current == null) return;
          const delta = event.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1);
          touch.current = null;
        }}>
        {loadedUrl !== image.url && failedUrl !== image.url && <p role="status">Memuat gambar...</p>}
        {failedUrl === image.url ? <p role="alert">Gambar belum bisa dimuat. Buka kembali halaman latihan untuk mencoba lagi.</p> :
          <img key={image.url} src={image.url} alt={`${title}, tahap ${image.step_number}`}
            decoding="async" style={{ display: 'block', width: '100%', maxHeight: '65vh', objectFit: 'contain' }}
            onLoad={() => setLoadedUrl(image.url)} onError={() => setFailedUrl(image.url)} />}
      </div>
      {images.length > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <button type="button" className="btn ghost" disabled={index === 0} onClick={() => move(-1)}>Sebelumnya</button>
        <span aria-live="polite">{index + 1} / {images.length}</span>
        <button type="button" className="btn ghost" disabled={index === images.length - 1} onClick={() => move(1)}>Berikutnya</button>
      </div>}
    </div>
  );
}
