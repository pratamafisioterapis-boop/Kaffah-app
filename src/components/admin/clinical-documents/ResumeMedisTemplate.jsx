import React, { forwardRef } from 'react';

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

const ResumeMedisTemplate = forwardRef(({ data, clinic }, ref) => {
  const programTerapi = data?.program_terapi || [];
  const otherProgram = data?.program_terapi_lainnya;

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
        fontFamily: 'Inter, Arial, sans-serif',
        background: '#fff',
        color: '#0f172a',
        position: 'relative',
      }}
    >
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(120deg, #0f172a 0%, #312e81 100%)',
        padding: '28px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {clinic?.logo_url && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '8px', display: 'flex' }}>
              <img src={clinic.logo_url} alt="logo" style={{ width: '46px', height: '46px', objectFit: 'contain' }} />
            </div>
          )}
          <div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px', margin: 0 }}>
              {(clinic?.name || '').toUpperCase()}
            </p>
            <p style={{ color: '#c7d2fe', fontSize: '10.5px', margin: '4px 0 0', lineHeight: 1.5, maxWidth: '320px' }}>
              {clinic?.address || '-'}
            </p>
            <p style={{ color: '#c7d2fe', fontSize: '10.5px', margin: '2px 0 0' }}>
              {[clinic?.phone, clinic?.email].filter(Boolean).join('  •  ')}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#818cf8', fontWeight: 700, fontSize: '11px', letterSpacing: '2px', margin: 0 }}>DOKUMEN MEDIS</p>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: '22px', margin: '2px 0 0' }}>RESUME MEDIS</p>
        </div>
      </div>

      <div style={{ padding: '32px 40px' }}>
        {/* PATIENT INFO */}
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: '32px',
          rowGap: '10px',
          background: '#f8fafc',
        }}>
          {[
            ['No. Rekam Medis', data?.medical_record_number || '-'],
            ['Nama Pasien', data?.patient_name || '-'],
            ['Tanggal Lahir', formatDate(data?.birth_date)],
            ['Jenis Kelamin', data?.gender || '-'],
            ['Fisioterapis', data?.therapist_name || '-'],
            ['Tanggal Resume', formatDate(data?.document_date)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', fontSize: '12px' }}>
              <span style={{ width: '130px', color: '#64748b', fontWeight: 600 }}>{label}</span>
              <span style={{ marginRight: '8px', color: '#64748b' }}>:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* CLINICAL SECTIONS */}
        {[
          { key: 'anamnesa', label: 'Anamnesa', color: '#6366f1' },
          { key: 'pemeriksaan_fisik', label: 'Pemeriksaan Fisik', color: '#0ea5e9' },
          { key: 'diagnosa', label: 'Diagnosa', color: '#f59e0b' },
        ].map((section) => (
          <div key={section.key} style={{ marginTop: '18px' }}>
            <div style={{
              borderLeft: `4px solid ${section.color}`,
              padding: '12px 18px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderLeftWidth: '4px',
              borderLeftColor: section.color,
              borderRadius: '10px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', color: section.color, margin: '0 0 6px', textTransform: 'uppercase' }}>
                {section.label}
              </p>
              <p style={{ fontSize: '12.5px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {data?.[section.key] || '-'}
              </p>
            </div>
          </div>
        ))}

        {/* PROGRAM TERAPI */}
        <div style={{ marginTop: '18px' }}>
          <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', color: '#334155', margin: '0 0 10px', textTransform: 'uppercase' }}>
            Program Terapi
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '16px', rowGap: '8px' }}>
            {Object.entries(PROGRAM_TERAPI_LABELS).map(([key, label]) => {
              const checked = programTerapi.includes(key);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '4px',
                    border: `1.5px solid ${checked ? '#4f46e5' : '#cbd5e1'}`,
                    background: checked ? '#4f46e5' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '10px', fontWeight: 900, flexShrink: 0,
                  }}>
                    {checked ? '✓' : ''}
                  </span>
                  <span style={{ color: checked ? '#0f172a' : '#94a3b8', fontWeight: checked ? 600 : 400 }}>{label}</span>
                </div>
              );
            })}
          </div>
          {otherProgram && (
            <p style={{ fontSize: '12px', marginTop: '10px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Lainnya: </span>{otherProgram}
            </p>
          )}
        </div>

        {/* REKOMENDASI */}
        <div style={{ marginTop: '18px' }}>
          <div style={{
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: '10px',
            padding: '12px 18px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', color: '#4338ca', margin: '0 0 4px', textTransform: 'uppercase' }}>
              Rekomendasi Fisioterapi
            </p>
            <p style={{ fontSize: '12.5px', margin: 0, fontWeight: 600 }}>{data?.rekomendasi || '-'}</p>
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', width: '240px' }}>
            <p style={{ fontSize: '12px', margin: 0 }}>
              {(data?.tempat || 'Balikpapan')}, {formatDate(data?.document_date)}
            </p>
            <p style={{ fontSize: '12px', margin: '4px 0 0' }}>Fisioterapis,</p>
            <div style={{ position: 'relative', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {data?.therapist_signature_url && (
                <img src={data.therapist_signature_url} style={{ maxHeight: '55px', maxWidth: '120px' }} />
              )}
              {clinic?.stamp_url && (
                <img
                  src={clinic.stamp_url}
                  style={{ position: 'absolute', left: 0, bottom: 0, maxHeight: '55px', maxWidth: '55px', objectFit: 'contain' }}
                />
              )}
            </div>
            <div style={{ borderTop: '1px solid #0f172a', width: '180px', margin: '4px auto 0' }} />
            <p style={{ fontSize: '12.5px', fontWeight: 700, margin: '6px 0 0' }}>{data?.therapist_name || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ResumeMedisTemplate;
