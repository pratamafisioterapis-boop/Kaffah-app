import React, { forwardRef, useEffect, useState } from 'react';
import { stripSignatureBackground } from '@/lib/signatureImage';

const PROGRAM_TERAPI_LABELS = {
  tens: 'TENS',
  usd: 'US',
  infrared: 'Infrared',
  stretching_exercise: 'Stretching Exercise',
  strengthening_exercise: 'Strengthening Exercise',
  manual_therapy: 'Manual Therapy',
};

const pad = (n) => String(n).padStart(2, '0');
const parseDate = (v) => {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = parseDate(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '-';
};
const fmtAge = (birth, ref) => {
  const b = parseDate(birth);
  const r = parseDate(ref) || new Date();
  if (!b) return '-';
  let y = r.getFullYear() - b.getFullYear();
  let m = r.getMonth() - b.getMonth();
  let d = r.getDate() - b.getDate();
  if (d < 0) { m -= 1; d += new Date(r.getFullYear(), r.getMonth(), 0).getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  return `${y}Y ${m}M ${d}D`;
};

const BORDER = '1px solid #000';
const cell = { border: BORDER, padding: '8px 10px', verticalAlign: 'top', fontSize: '11.5px', lineHeight: 1.6 };

const ResumeMedisTemplatePraxis = forwardRef(({ data, clinic }, ref) => {
  const programs = (data?.program_terapi || []).map((k) => PROGRAM_TERAPI_LABELS[k]).filter(Boolean);
  if (data?.program_terapi_lainnya) programs.push(data.program_terapi_lainnya);

  const [signatureUrl, setSignatureUrl] = useState(null);
  useEffect(() => {
    const raw = data?.therapist_signature_url;
    if (!raw) { setSignatureUrl(null); return undefined; }
    let cancelled = false;
    stripSignatureBackground(raw).then((r) => { if (!cancelled) setSignatureUrl(r); });
    return () => { cancelled = true; };
  }, [data?.therapist_signature_url]);

  const info = [
    ['MR', data?.medical_record_number || '-'],
    ['Name', data?.patient_name || '-'],
    ['Date of birth | Age', `${fmtDate(data?.birth_date)} | ${fmtAge(data?.birth_date, data?.document_date)}`],
    ['Gender', data?.gender || '-'],
    ['Physiotherapist', data?.therapist_name || '-'],
    ['No Admission', data?.admission_number || '-'],
    ['Date', fmtDate(data?.document_date)],
  ];

  // Skala nyeri & TTV hanya tampil bila datanya terisi.
  const dash = (v, unit = '') => (v === undefined || v === null || v === '' ? '-' : `${v}${unit}`);
  const hasVitals = ['pain_activity', 'pain_rest', 'blood_pressure', 'pulse', 'respiration', 'spo2', 'temperature', 'weight', 'height']
    .some((k) => data?.[k] !== undefined && data?.[k] !== null && data?.[k] !== '');

  const tindakan = [
    programs.length ? `Modalitas : ${programs.join(', ')}` : null,
    data?.tindakan ? `\n${data.tindakan}` : null,
    data?.rekomendasi ? `Rekomendasi : ${data.rekomendasi}` : null,
  ].filter(Boolean).join('\n');

  const clinicName = clinic?.name || 'Praxis Physiotherapy';

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        // Sedikit di bawah 297mm supaya cetak tidak melompat ke halaman kosong.
        minHeight: 'calc(297mm - 2px)',
        boxSizing: 'border-box',
        padding: '14mm 12mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        background: '#fff',
        color: '#000',
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ width: '45%' }}>
          {clinic?.logo_url
            ? <img src={clinic.logo_url} alt="logo" crossOrigin="anonymous" style={{ display: 'block', height: '64px', width: 'auto', maxWidth: '240px', objectFit: 'contain' }} loading="lazy" decoding="async" />
            : <p style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{clinicName.toUpperCase()}</p>}
          <p style={{ margin: '14px 0 0', fontSize: '11px', lineHeight: 1.6 }}>{clinic?.address || ''}</p>
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: '11.5px' }}>
          <tbody>
            {info.map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '2px 0', width: '120px', verticalAlign: 'top' }}>{label}</td>
                <td style={{ padding: '2px 0', verticalAlign: 'top' }}>: {value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '24px 0 10px' }}>Resume Medis</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...cell, width: '24%', textAlign: 'center', fontWeight: 700 }}>Keterangan</th>
            <th style={{ ...cell, textAlign: 'center', fontWeight: 700 }} colSpan={2}>Deskripsi</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cell, fontWeight: 700, verticalAlign: 'middle' }}>Anamnesa</td>
            <td style={{ ...cell, whiteSpace: 'pre-wrap' }} colSpan={2}>{data?.anamnesa || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 700, verticalAlign: 'middle' }}>Pemeriksaan Fisik</td>
            <td style={{ ...cell, whiteSpace: 'pre-wrap' }} colSpan={hasVitals ? 1 : 2}>{data?.pemeriksaan_fisik || '-'}</td>
            {hasVitals && (
              <td style={{ ...cell, width: '32%' }}>
                <div style={{ fontWeight: 700 }}>Skala Nyeri</div>
                <div>Skor Nyeri Saat Aktivitas : {dash(data?.pain_activity)}</div>
                <div>Skor Nyeri Saat Istirahat : {dash(data?.pain_rest)}</div>
                <div style={{ fontWeight: 700, marginTop: '12px' }}>TTV (Tanda-tanda Vital)</div>
                <div>Tekanan darah : {dash(data?.blood_pressure, ' mmHg')}</div>
                <div>Nadi : {dash(data?.pulse, ' x/mnt')}</div>
                <div>Pernapasan : {dash(data?.respiration, ' x/mnt')}</div>
                <div>SpO2 : {dash(data?.spo2, '%')}</div>
                <div>Suhu : {dash(data?.temperature, '°C')}</div>
                <div>Berat Badan : {dash(data?.weight, ' Kg')}</div>
                <div>Tinggi Badan : {dash(data?.height, ' cm')}</div>
              </td>
            )}
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 700, verticalAlign: 'middle' }}>Diagnosa</td>
            <td style={{ ...cell, whiteSpace: 'pre-wrap' }} colSpan={2}>{data?.diagnosa || '-'}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 700, verticalAlign: 'middle' }}>Tindakan</td>
            <td style={{ ...cell, whiteSpace: 'pre-wrap' }} colSpan={2}>{tindakan || '-'}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: '11.5px', lineHeight: 1.6, margin: '18px 0 0' }}>
        Dengan ini saya selaku pasien / tertanggung, mengizinkan {clinicName} untuk memberikan keterangan lengkap mengenai keadaan penyakit / data medis kepada pihak ketiga yang ditunjuk secara sah.
      </p>

      {/* TANDA TANGAN */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '28px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {[
          { name: data?.therapist_name || '-', role: 'Physiotherapist', sig: signatureUrl },
          { name: data?.patient_name || '-', role: 'Pasien', sig: null },
        ].map((p) => (
          <div key={p.role} style={{ textAlign: 'center', fontSize: '11.5px', minWidth: '200px' }}>
            <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {p.sig && <img src={p.sig} alt="" style={{ maxHeight: '65px', maxWidth: '160px' }} loading="lazy" decoding="async" />}
            </div>
            <div>( <span style={{ textDecoration: 'underline' }}>{p.name}</span> )</div>
            <div>{p.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ResumeMedisTemplatePraxis;
