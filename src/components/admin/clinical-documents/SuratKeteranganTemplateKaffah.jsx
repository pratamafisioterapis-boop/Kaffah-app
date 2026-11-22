import React, { forwardRef, useEffect, useState } from 'react';
import { stripSignatureBackground } from '@/lib/signatureImage';

import { C, DocHeader, DocSignature, InfoPanel, formatDate } from './KaffahDocParts';

const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

const SuratKeteranganTemplateKaffah = forwardRef(({ data, clinic }, ref) => {
  const age = data?.age ?? calcAge(data?.birth_date);

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

  const para = { fontSize: '13.5px', lineHeight: 1.9, margin: 0 };

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
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
        title="SURAT KETERANGAN"
        subtitle={['Keterangan Fisioterapi', data?.document_number].filter(Boolean).join(' · ')}
      />

      <p style={{ ...para, marginTop: '34px' }}>
        <strong>{clinic?.name || ''}</strong> menerangkan bahwa pasien berikut:
      </p>

      <InfoPanel
        columns={2}
        rows={[
          ['Nama', data?.patient_name || '-'],
          ['Usia', age != null ? `${age} Tahun` : '-'],
          ['Jenis Kelamin', data?.gender || '-'],
          ['Telepon', data?.phone || '-'],
          ['Alamat', data?.address || '-', 2],
          ['Diagnosa', data?.diagnosa || '-', 2],
        ]}
      />

      <p style={{ ...para, marginTop: '22px' }}>
        {data?.keterangan_tambahan
          ? data.keterangan_tambahan
          : `Pasien tersebut telah menjalani perawatan fisioterapi di ${clinic?.name || 'klinik kami'}.`}
      </p>
      <p style={{ ...para, marginTop: '14px' }}>
        Surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.
      </p>

      <div style={{ flex: 1, minHeight: '28px' }} />
      <DocSignature data={data} clinic={clinic} signatureUrl={signatureUrl} />
    </div>
  );
});

export default SuratKeteranganTemplateKaffah;
