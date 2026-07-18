import React, { forwardRef } from 'react';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

const SuratKeteranganTemplate = forwardRef(({ data, clinic }, ref) => {
  const age = data?.age ?? calcAge(data?.birth_date);

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
        padding: '40px 50px',
      }}
    >
      {/* LETTERHEAD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', paddingBottom: '16px', borderBottom: '3px solid #0f172a', textAlign: 'center' }}>
        {clinic?.logo_url && <img src={clinic.logo_url} alt="logo" style={{ width: '100px', height: '100px', objectFit: 'contain', flexShrink: 0 }} />}
        <div>
          <p style={{ fontWeight: 800, fontSize: '17px', margin: 0, letterSpacing: '0.4px' }}>
            {(clinic?.name || 'Kaffah Physiotherapy').toUpperCase()}
          </p>
          <p style={{ fontSize: '11px', color: '#475569', margin: '3px 0 0', lineHeight: 1.5 }}>
            {clinic?.address || '-'}
          </p>
          <p style={{ fontSize: '11px', color: '#475569', margin: '2px 0 0' }}>
            {[clinic?.phone, clinic?.email].filter(Boolean).join('  •  ')}
          </p>
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: 'center', marginTop: '32px' }}>
        <p style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '0.8px', margin: 0, textDecoration: 'underline', textUnderlineOffset: '5px' }}>
          SURAT KETERANGAN FISIOTERAPI
        </p>
        <p style={{ fontSize: '12px', color: '#475569', margin: '6px 0 0' }}>
          No. {data?.document_number || '-'}
        </p>
      </div>

      {/* BODY */}
      <div style={{ marginTop: '32px', fontSize: '13px', lineHeight: 1.9 }}>
        <p style={{ margin: 0 }}>
          Yang bertanda tangan di bawah ini, fisioterapis di <strong>{clinic?.name || 'Kaffah Physiotherapy'}</strong>, dengan ini menerangkan bahwa:
        </p>

        <div style={{ margin: '18px 0', paddingLeft: '24px' }}>
          {[
            ['Nama', data?.patient_name || '-'],
            ['Usia', age != null ? `${age} Tahun` : '-'],
            ['Jenis Kelamin', data?.gender || '-'],
            ['Alamat', data?.address || '-'],
            ['Telepon', data?.phone || '-'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ width: '150px' }}>{label}</span>
              <span style={{ width: '16px' }}>:</span>
              <span style={{ fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '10px' }}>
            <span style={{ width: '150px' }}>Diagnosa</span>
            <span style={{ width: '16px' }}>:</span>
            <span style={{ fontWeight: 700 }}>{data?.diagnosa || '-'}</span>
          </div>
        </div>

        <p style={{ margin: 0 }}>
          {data?.keterangan_tambahan
            ? data.keterangan_tambahan
            : 'benar merupakan pasien yang telah menjalani perawatan fisioterapi di klinik kami.'}
        </p>

        <p style={{ marginTop: '18px' }}>
          Demikian surat keterangan fisioterapi ini diberikan untuk digunakan sebagaimana mestinya.
        </p>
      </div>

      {/* SIGNATURE */}
      <div style={{ marginTop: '56px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', width: '250px' }}>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {(data?.tempat || 'Balikpapan')}, {formatDate(data?.document_date)}
          </p>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Fisioterapis,</p>
          <div style={{ position: 'relative', height: '65px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {data?.therapist_signature_url && (
              <img src={data.therapist_signature_url} style={{ maxHeight: '60px', maxWidth: '130px' }} />
            )}
            {clinic?.stamp_url && (
              <img
                src={clinic.stamp_url}
                style={{ position: 'absolute', right: '100%', bottom: 0, marginRight: '8px', maxHeight: '60px', maxWidth: '60px', objectFit: 'contain' }}
              />
            )}
          </div>
          <div style={{ borderTop: '1px solid #0f172a', width: '190px', margin: '4px auto 0' }} />
          <p style={{ fontSize: '13px', fontWeight: 700, margin: '6px 0 0' }}>{data?.therapist_name || '-'}</p>
          {data?.therapist_license && (
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>{data.therapist_license}</p>
          )}
        </div>
      </div>
    </div>
  );
});

export default SuratKeteranganTemplate;
