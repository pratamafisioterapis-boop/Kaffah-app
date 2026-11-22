import React, { forwardRef, useEffect, useState } from 'react';
import { stripSignatureBackground } from '@/lib/signatureImage';
import { PRAXIS_CLINIC_ID } from '@/lib/clinicIds';
import ResumeMedisTemplatePraxis from './ResumeMedisTemplatePraxis';

const PROGRAM_TERAPI_LABELS = {
  tens: 'TENS',
  usd: 'USD (Ultrasound Diathermy)',
  infrared: 'Infrared',
  stretching_exercise: 'Stretching Exercise',
  strengthening_exercise: 'Strengthening Exercise',
  manual_therapy: 'Manual Therapy',
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const C = {
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
const DocHeader = ({ clinic, title, subtitle }) => (
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

const DocSignature = ({ data, clinic, signatureUrl }) => (
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

const InfoPanel = ({ rows, columns = 3 }) => (
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

const ResumeMedisTemplateDefault = forwardRef(({ data, clinic }, ref) => {
  const programTerapi = data?.program_terapi || [];
  const otherProgram = data?.program_terapi_lainnya;

  // Strip the signature scan's background to transparent and boost contrast,
  // same as the invoice template — otherwise it prints with a visible box
  // behind it and reads small/blurry against the page.
  const [signatureUrl, setSignatureUrl] = useState(null);
  useEffect(() => {
    const rawUrl = data?.therapist_signature_url;
    if (!rawUrl) {
      setSignatureUrl(null);
      return;
    }
    let cancelled = false;
    stripSignatureBackground(rawUrl).then((result) => {
      if (!cancelled) setSignatureUrl(result);
    });
    return () => { cancelled = true; };
  }, [data?.therapist_signature_url]);

  const labelCell = { width: '150px', padding: '13px 16px 13px 0', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  const valueCell = { padding: '13px 0', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  const labelMain = { fontSize: '12px', fontWeight: 600, color: C.navy, letterSpacing: '0.02em' };
  const labelSub = { fontSize: '10.5px', color: C.muted, marginTop: '2px' };
  const bodyText = { fontSize: '13px', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 };
  const th = { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.1em', color: C.muted, textAlign: 'left', padding: '0 0 9px', borderBottom: `2px solid ${C.navy}` };

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        // A hair under 297mm on purpose: at exactly 297mm this rounds up to
        // 1123px (vs. an A4 page's 1122.52px), and that sub-pixel overflow
        // alone is enough for Chromium to spill a native "Cetak" print onto
        // a near-blank second page even though the real content fits.
        minHeight: 'calc(297mm - 2px)',
        boxSizing: 'border-box',
        padding: '48px 52px 40px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', Arial, sans-serif",
        background: '#fff',
        color: C.text,
        position: 'relative',
      }}
    >
      <DocHeader
        clinic={clinic}
        title="RESUME MEDIS"
        subtitle={['Medical Resume', data?.document_number].filter(Boolean).join(' · ')}
      />

      <InfoPanel
        rows={[
          ['No. Rekam Medis', data?.medical_record_number || '-'],
          ['Nama Pasien', data?.patient_name || '-'],
          ['Tanggal Lahir', formatDate(data?.birth_date)],
          ['Jenis Kelamin', data?.gender || '-'],
          ['Fisioterapis', data?.therapist_name || '-'],
          ['Tanggal Resume', formatDate(data?.document_date)],
        ]}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '22px' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '150px' }}>PEMERIKSAAN</th>
            <th style={th}>CATATAN KLINIS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={labelCell}><div style={labelMain}>Anamnesa</div><div style={labelSub}>Keluhan pasien</div></td>
            <td style={valueCell}><p style={bodyText}>{data?.anamnesa || '-'}</p></td>
          </tr>
          <tr>
            <td style={labelCell}><div style={labelMain}>Pemeriksaan Fisik</div><div style={labelSub}>Temuan objektif</div></td>
            <td style={valueCell}><p style={bodyText}>{data?.pemeriksaan_fisik || '-'}</p></td>
          </tr>
          <tr>
            <td style={labelCell}><div style={labelMain}>Diagnosa</div><div style={labelSub}>Fisioterapi</div></td>
            <td style={valueCell}><p style={{ ...bodyText, fontWeight: 700, color: C.navy }}>{data?.diagnosa || '-'}</p></td>
          </tr>
          <tr>
            <td style={labelCell}><div style={labelMain}>Program Terapi</div><div style={labelSub}>Modalitas</div></td>
            <td style={valueCell}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {Object.entries(PROGRAM_TERAPI_LABELS).map(([key, label]) => {
                  const on = programTerapi.includes(key);
                  return (
                    <div key={key} style={{
                      minHeight: '34px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      fontSize: '12px', padding: '4px 8px', textAlign: 'center', borderRadius: '8px',
                      border: `1px solid ${on ? C.navy : C.chipLine}`,
                      background: on ? C.navy : 'transparent',
                      color: on ? '#ffffff' : C.muted,
                      fontWeight: on ? 700 : 400,
                    }}>
                      {on && (
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ flex: 'none' }}>
                          <path d="M2.5 6.3 5 8.8 9.6 3.6" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {label}
                    </div>
                  );
                })}
              </div>
              {otherProgram && (
                <p style={{ fontSize: '12.5px', margin: '10px 0 0' }}>
                  <span style={{ color: C.muted }}>Lainnya: </span>{otherProgram}
                </p>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ ...labelCell, background: C.tint, borderBottom: 'none', paddingLeft: '12px', borderRadius: '8px 0 0 8px' }}>
              <div style={labelMain}>Rekomendasi</div><div style={labelSub}>Tindak lanjut</div>
            </td>
            <td style={{ ...valueCell, background: C.tint, borderBottom: 'none', paddingRight: '12px', borderRadius: '0 8px 8px 0' }}>
              <p style={{ ...bodyText, fontWeight: 600 }}>{data?.rekomendasi || '-'}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ flex: 1, minHeight: '28px' }} />
      <DocSignature data={data} clinic={clinic} signatureUrl={signatureUrl} />
    </div>
  );
});

// Praxis memakai format resume medis tabel sendiri.
const ResumeMedisTemplate = forwardRef((props, ref) => (
  props.clinic?.id === PRAXIS_CLINIC_ID
    ? <ResumeMedisTemplatePraxis ref={ref} {...props} />
    : <ResumeMedisTemplateDefault ref={ref} {...props} />
));

export default ResumeMedisTemplate;
