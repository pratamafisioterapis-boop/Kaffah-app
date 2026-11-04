import React, { forwardRef } from 'react';

// Kwitansi desain "Minimal Bersih" (Kaffah). Sumber data sama dengan InvoiceTemplate:
// data.clinic, data.patients, data.tiered_line, data.payment_splits, data.admin_signer_*, dst.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "2026-11-03" atau timestamp -> "03 November 2026"
const fmtLongDate = (value) => {
  if (!value) return '-';
  const plain = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[3]} ${MONTHS[Number(plain[2]) - 1]} ${plain[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const PAYMENT_METHODS = [
  ['cash', 'Cash'],
  ['qris', 'QRIS'],
  ['debit', 'Debit card'],
  ['credit', 'Credit card'],
  ['insurance', 'Insurance'],
  ['transfer', 'Transfer'],
];

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

// Lebar kolom SESSION + RATE = satu garis sumbu: kotak "Treated by" dan blok total memakai
// lebar yang sama, jadi tepi kiri/kanannya sejajar dengan kolom tabel di atasnya.
const COL_SESSION = 150;
const COL_RATE = 120;
const AXIS_WIDTH = COL_SESSION + COL_RATE;

const sectionLabel = { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.12em', color: C.blue };
const th = { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.1em', color: C.muted, padding: '0 0 10px', borderBottom: `2px solid ${C.navy}` };

const InvoiceTemplateModern = forwardRef(({ data }, ref) => {
  const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

  const clinic = data?.clinic || {};
  const contacts = [clinic.email, clinic.phone].filter(Boolean).join('  ·  ');

  const patientName = data?.patients?.full_name || data?.patient_name || '-';
  const patientLine = [data?.patients?.medical_record_number, data?.patients?.address].filter(Boolean).join('  ·  ');
  const therapistName = data?.physiotherapists?.name || data?.therapist_name || data?.therapist?.name || '-';

  const receiptNo = data?.receipt_number || data?.receiptNumber || data?.invoice_number || data?.invoiceNumber || '-';
  const invoiceDate = data?.invoice_created_at || data?.recap_date;
  const showServiceDate = data?.invoice_created_at && data?.recap_date && fmtLongDate(data.invoice_created_at) !== fmtLongDate(data.recap_date);

  // Baris layanan: deskripsi bertingkat bila ada; selain itu kode lama berdasarkan jenis layanan.
  const legacyCode =
    data?.service_type === 'Musculoskeletal Treatment' ? 'A17' :
    data?.service_type === 'Cardiorespiratory Physiotherapy' ? 'B29' :
    data?.service_type === 'Sport Injury Treatment' ? 'C34' :
    data?.service_type === 'Neurological Rehabilitation' ? 'D08' :
    data?.service_type === 'Pre-Post Operative Rehabilitation' ? 'E52' : 'X00';
  const line = data?.tiered_line || {
    code: legacyCode,
    description: data?.service_type || '-',
    session: data?.package_type || data?.service_type || '-',
  };

  // Split payment (mis. QRIS + Cash): nominal per metode tampil di chip yang terpilih.
  const payment = (data?.payment_method || '').toLowerCase();
  const paymentSplits = Array.isArray(data?.payment_splits) ? data.payment_splits : [];
  const splitAmountByMethod = {};
  paymentSplits.forEach((s) => {
    const key = (s.payment_method || '').toLowerCase();
    if (key) splitAmountByMethod[key] = (splitAmountByMethod[key] || 0) + (Number(s.amount) || 0);
  });
  const isSelected = (key) => (paymentSplits.length > 0 ? key in splitAmountByMethod : payment === key);

  const discountText = data?.discount_value
    ? data?.discount_type === 'percentage'
      ? `${data.discount_value}%`
      : formatCurrency(data.discount_value)
    : '–';

  const cashierName = data?.admin_signer_name || clinic.invoice_admin_name || '';
  const cashierSignature = data?.admin_signer_signature_url || clinic.invoice_admin_signature_url || '';
  const showPatientSignature = clinic.invoice_show_patient_signature !== false;

  const signBlock = { width: '230px', textAlign: 'center', position: 'relative' };
  const signLabel = { fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.12em', color: C.muted };
  const signSpace = { height: '104px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
  const signLine = { height: '1px', background: C.text };
  const signName = { fontSize: '13px', fontWeight: 600, marginTop: '8px', minHeight: '16px' };

  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
        background: '#ffffff',
        color: C.text,
        fontFamily: "'Inter', Arial, sans-serif",
        padding: '56px 56px 36px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* KOP KLINIK */}
      <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
        <img src={clinic.logo_url || '/clinara-logo.png'} alt="logo" style={{ width: '128px', height: 'auto', display: 'block' }} />
        <div style={{ width: '1px', height: '84px', background: '#d5dde7' }} />
        <div>
          <div style={{ fontSize: '23px', fontWeight: 700, letterSpacing: '0.1em', color: C.navy, lineHeight: 1.2 }}>
            {(clinic.name || '').toUpperCase()}
          </div>
          {clinic.address && (
            <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: C.muted, marginTop: '10px', whiteSpace: 'nowrap' }}>{clinic.address}</div>
          )}
          {contacts && (
            <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: C.text, marginTop: '3px', whiteSpace: 'nowrap' }}>{contacts}</div>
          )}
        </div>
      </div>

      <div style={{ height: '1px', background: C.line, margin: '24px 0' }} />

      {/* JUDUL + NOMOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '0.14em', color: C.navy, lineHeight: 1 }}>RECEIPT</div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Kwitansi Pembayaran</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: 1.8 }}>
          <div><span style={{ color: C.muted }}>Receipt No.</span>{'  '}<span style={{ fontWeight: 600 }}>{receiptNo}</span></div>
          <div><span style={{ color: C.muted }}>Date</span>{'  '}<span style={{ fontWeight: 600 }}>{fmtLongDate(invoiceDate)}</span></div>
          {showServiceDate && (
            <div><span style={{ color: C.muted }}>Service date</span>{'  '}<span style={{ fontWeight: 600 }}>{fmtLongDate(data.recap_date)}</span></div>
          )}
        </div>
      </div>

      <div style={{ height: '1px', background: C.line, margin: '22px 0 28px' }} />

      {/* PASIEN + TERAPIS */}
      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <div style={sectionLabel}>BILLED TO</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>{patientName}</div>
          {patientLine && <div style={{ fontSize: '12.5px', lineHeight: 1.7, color: C.body, marginTop: '4px' }}>{patientLine}</div>}
        </div>
        <div style={{ width: `${AXIS_WIDTH}px`, flex: 'none' }}>
          <div style={sectionLabel}>TREATED BY</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>{therapistName}</div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.7, color: C.body, marginTop: '4px' }}>Physiotherapist</div>
        </div>
      </div>

      {/* TABEL LAYANAN */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '32px' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', width: '70px' }}>CODE</th>
            <th style={{ ...th, textAlign: 'left' }}>DESCRIPTION</th>
            <th style={{ ...th, textAlign: 'left', width: `${COL_SESSION}px` }}>SESSION</th>
            <th style={{ ...th, textAlign: 'right', width: `${COL_RATE}px` }}><span style={{ marginRight: '-0.1em' }}>RATE</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontSize: '13px', padding: '16px 0', borderBottom: `1px solid ${C.line}`, color: C.body }}>{line.code}</td>
            <td style={{ fontSize: '13.5px', fontWeight: 500, padding: '16px 0', borderBottom: `1px solid ${C.line}` }}>{line.description}</td>
            <td style={{ fontSize: '13px', padding: '16px 0', borderBottom: `1px solid ${C.line}`, color: C.body }}>{line.session}</td>
            <td style={{ fontSize: '13.5px', fontWeight: 500, padding: '16px 0', borderBottom: `1px solid ${C.line}`, textAlign: 'right' }}>
              {formatCurrency(data?.amount_original || data?.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* METODE BAYAR + TOTAL */}
      <div style={{ display: 'flex', gap: '40px', marginTop: '28px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={sectionLabel}>PAYMENT METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '12px' }}>
            {PAYMENT_METHODS.map(([key, label]) => {
              const on = isSelected(key);
              const amount = splitAmountByMethod[key];
              return (
                <div
                  key={key}
                  style={{
                    minHeight: '34px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    padding: '4px 6px',
                    border: `1px solid ${on ? C.navy : C.chipLine}`,
                    background: on ? C.navy : 'transparent',
                    borderRadius: '8px',
                    color: on ? '#ffffff' : C.muted,
                    fontWeight: on ? 700 : 400,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {on && (
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2.5 6.3 5 8.8 9.6 3.6" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {label}
                  </span>
                  {on && amount ? <span style={{ fontSize: '10.5px', fontWeight: 500, opacity: 0.9 }}>{formatCurrency(amount)}</span> : null}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: `${AXIS_WIDTH}px`, flex: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', color: C.body }}>
            <span>Subtotal</span><span>{formatCurrency(data?.amount_original || data?.amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', color: C.body }}>
            <span>Discount</span><span>{discountText}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', fontWeight: 700, color: C.navy, background: C.tint, borderRadius: '8px', padding: '14px 16px', margin: '8px -16px 0' }}>
            <span>Balance Paid</span><span>{formatCurrency(data?.amount)}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* TANDA TANGAN + STEMPEL */}
      <div style={{ display: 'flex', justifyContent: showPatientSignature ? 'space-between' : 'flex-start', padding: '0 8px' }}>
        <div style={signBlock}>
          {clinic.stamp_url && (
            <img
              src={clinic.stamp_url}
              alt="stamp"
             
              style={{ position: 'absolute', right: '-30px', top: '-10px', width: '100px', height: 'auto', opacity: 0.9 }}
            />
          )}
          <div style={signLabel}>CASHIER</div>
          <div style={signSpace}>
            {cashierSignature && <img src={cashierSignature} alt="signature" style={{ maxWidth: '215px', maxHeight: '100px', width: 'auto', height: 'auto' }} />}
          </div>
          <div style={signLine} />
          <div style={signName}>{cashierName || 'Cashier'}</div>
        </div>
        {showPatientSignature && (
          <div style={signBlock}>
            <div style={signLabel}>PATIENT</div>
            <div style={signSpace} />
            <div style={signLine} />
            <div style={signName}>{patientName}</div>
          </div>
        )}
      </div>

      {/* PENUTUP */}
      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: '36px', paddingTop: '14px', textAlign: 'center', lineHeight: 1.7 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: C.navy }}>Thank you for your trust in {clinic.name || 'us'}.</div>
        <div style={{ fontSize: '11.5px', color: C.muted }}>Wishing you a speedy recovery and continued good health.</div>
      </div>
    </div>
  );
});

InvoiceTemplateModern.displayName = 'InvoiceTemplateModern';

export default InvoiceTemplateModern;
