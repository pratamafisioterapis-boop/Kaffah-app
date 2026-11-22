// Bagian bersama dokumen klinis khusus Kaffah (gaya "Tabel Klinis", senada dengan kwitansi).
import React, { useEffect, useState } from 'react';

export const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const C = {
  navy: '#1f3a5f',
  blue: '#2f6fb0',
  text: '#1c2733',
  muted: '#5b6b7c',
  body: '#46576a',
  line: '#e3e8ee',
  chipLine: '#cfd8e3',
  tint: '#eef4fa',
};

// Kop dan blok tanda tangan dipakai bersama Resume Medis dan Surat Keterangan
// (gaya "Tabel Klinis", senada dengan kwitansi).
// Logo klinik sering punya ruang putih di sekelilingnya sehingga tampak menjorok dari
// margin kiri. Potong bagian putihnya lewat canvas; bila gagal (mis. CORS), pakai gambar asli.
const trimWhitespace = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, w, h).data;
      let minX = w; let minY = h; let maxX = -1; let maxY = -1;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          const solid = px[i + 3] > 20 && (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235);
          if (solid) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) { resolve(url); return; }
      const out = document.createElement('canvas');
      out.width = maxX - minX + 1;
      out.height = maxY - minY + 1;
      out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      resolve(out.toDataURL('image/png'));
    } catch (e) {
      resolve(url);
    }
  };
  img.onerror = () => resolve(url);
  img.src = url;
});

const useTrimmedLogo = (url) => {
  const [src, setSrc] = useState(url);
  useEffect(() => {
    let cancelled = false;
    setSrc(url);
    if (url) trimWhitespace(url).then((result) => { if (!cancelled) setSrc(result); });
    return () => { cancelled = true; };
  }, [url]);
  return src;
};

export const DocHeader = ({ clinic, title, subtitle }) => {
  const logoSrc = useTrimmedLogo(clinic?.logo_url || '/clinara-logo.png');
  return (
  <>
    {/* Judul dan nama klinik sama-sama dimulai dari atas dengan tinggi baris yang sama, jadi sejajar. */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', minWidth: 0 }}>
        <img src={logoSrc} alt="logo" style={{ width: '78px', height: 'auto', maxHeight: '70px', objectFit: 'contain', display: 'block', flex: 'none' }} loading="lazy" decoding="async" />
        <div>
          <div style={{ fontSize: '17px', lineHeight: '24px', fontWeight: 700, letterSpacing: '0.1em', color: C.navy }}>
            {(clinic?.name || '').toUpperCase()}
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.55, color: C.muted, marginTop: '2px' }}>
            {clinic?.address || ''}
            {(clinic?.phone || clinic?.email) && <><br />{[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}</>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '0.12em', color: C.navy, lineHeight: '24px', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '5px' }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ height: '2px', background: C.navy, marginTop: '20px' }} />
  </>
  );
};

export const DocSignature = ({ data, clinic, signatureUrl }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <div style={{ width: '230px', textAlign: 'center', position: 'relative' }}>
      <div style={{ fontSize: '12.5px', marginBottom: '6px' }}>
        {(data?.tempat || 'Balikpapan')}, {formatDate(data?.document_date)}
      </div>
      <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.12em', color: C.muted }}>FISIOTERAPIS</div>
      <div style={{ position: 'relative', height: '78px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {signatureUrl && (
          <img src={signatureUrl} alt="signature" style={{ maxHeight: '80px', maxWidth: '170px' }} loading="lazy" decoding="async" />
        )}
        {clinic?.stamp_url && (
          <img
            src={clinic.stamp_url}
            alt="stamp"
            style={{ position: 'absolute', right: '-8px', bottom: 0, maxHeight: '72px', maxWidth: '72px', objectFit: 'contain', opacity: 0.9 }} loading="lazy" decoding="async" />
        )}
      </div>
      <div style={{ height: '1px', background: C.text }} />
      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>{data?.therapist_name || '-'}</div>
      {data?.therapist_license && (
        <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>SIPF: {data.therapist_license}</div>
      )}
    </div>
  </div>
);

export const InfoPanel = ({ rows, columns = 3 }) => (
  <div style={{
    background: C.tint, borderRadius: '8px', padding: '14px 20px', marginTop: '16px',
    display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '12px 20px',
  }}>
    {rows.map(([label, value, span]) => (
      <div key={label} style={span ? { gridColumn: `span ${span}` } : undefined}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '3px' }}>{value}</div>
      </div>
    ))}
  </div>
);

