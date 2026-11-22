import React, { forwardRef, useEffect, useState } from 'react';
import { stripSignatureBackground } from '@/lib/signatureImage';
import { C, DocHeader, DocSignature, InfoPanel, formatDate } from './KaffahDocParts';

const PROGRAM_TERAPI_LABELS = {
  tens: 'TENS',
  usd: 'USD (Ultrasound Diathermy)',
  infrared: 'Infrared',
  stretching_exercise: 'Stretching Exercise',
  strengthening_exercise: 'Strengthening Exercise',
  manual_therapy: 'Manual Therapy',
};

const ResumeMedisTemplateKaffah = forwardRef(({ data, clinic }, ref) => {
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

  const labelCell = { width: '150px', padding: '10px 16px 10px 0', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  const valueCell = { padding: '10px 0', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  const labelMain = { fontSize: '12px', fontWeight: 600, color: C.navy, letterSpacing: '0.02em' };
  const labelSub = { fontSize: '10.5px', color: C.muted, marginTop: '2px' };
  const bodyText = { fontSize: '12.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 };
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
        padding: '40px 52px 32px',
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

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '18px' }}>
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
                      minHeight: '30px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
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

      <div style={{ flex: 1, minHeight: '20px' }} />
      <DocSignature data={data} clinic={clinic} signatureUrl={signatureUrl} />
    </div>
  );
});

export default ResumeMedisTemplateKaffah;
