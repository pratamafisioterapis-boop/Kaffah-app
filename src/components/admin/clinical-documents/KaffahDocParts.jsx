// Bagian bersama dokumen klinis khusus Kaffah (gaya "Tabel Klinis", senada dengan kwitansi).
import React from 'react';

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
export const DocHeader = ({ clinic, title, subtitle }) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img src={clinic?.logo_url || '/clinara-logo.png'} alt="logo" style={{ width: '64px', height: 'auto', objectFit: 'contain', display: 'block' }} loading="lazy" decoding="async" />
        <div>
          <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '0.1em', color: C.navy }}>
            {(clinic?.name || '').toUpperCase()}
          </div>
          <div style={{ fontSize: '11.5px', lineHeight: 1.55, color: C.muted, marginTop: '5px' }}>
            {clinic?.address || ''}
            {(clinic?.phone || clinic?.email) && <><br />{[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}</>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.14em', color: C.navy, lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '5px' }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ height: '2px', background: C.navy, marginTop: '20px' }} />
  </>
);

export const DocSignature = ({ data, clinic, signatureUrl }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <div style={{ width: '230px', textAlign: 'center', position: 'relative' }}>
      <div style={{ fontSize: '12.5px', marginBottom: '6px' }}>
        {(data?.tempat || 'Balikpapan')}, {formatDate(data?.document_date)}
      </div>
      <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.12em', color: C.muted }}>FISIOTERAPIS</div>
      <div style={{ position: 'relative', height: '86px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {signatureUrl && (
          <img src={signatureUrl} alt="signature" style={{ maxHeight: '80px', maxWidth: '170px' }} loading="lazy" decoding="async" />
        )}
        {clinic?.stamp_url && (
          <img
            src={clinic.stamp_url}
            alt="stamp"
            style={{ position: 'absolute', right: '-26px', bottom: 0, maxHeight: '85px', maxWidth: '85px', objectFit: 'contain', opacity: 0.9 }} loading="lazy" decoding="async" />
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
    background: C.tint, borderRadius: '8px', padding: '16px 20px', marginTop: '20px',
    display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '14px 20px',
  }}>
    {rows.map(([label, value, span]) => (
      <div key={label} style={span ? { gridColumn: `span ${span}` } : undefined}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '3px' }}>{value}</div>
      </div>
    ))}
  </div>
);

