import React, { forwardRef } from 'react';
import { terbilangRupiah } from '@/lib/terbilang';

export const KWITANSI_CATEGORIES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'drug', label: 'Drug' },
  { value: 'administration', label: 'Administration' },
];

const num = (v) => Number(v) || 0;
const idr = (v) => Math.round(num(v)).toLocaleString('id-ID');
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '-' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
};
const fmtDateTime = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '-' : `${fmtDate(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Item invoice: simpan di recap.invoice_items; jika kosong, buat satu baris
// Procedure dari layanan pada recap (harga asli & diskon dari recap).
export const getKwitansiItems = (data) => {
  if (Array.isArray(data?.invoice_items) && data.invoice_items.length > 0) {
    return data.invoice_items.map((it) => ({
      category: it.category || 'procedure',
      name: it.name || '-',
      qty: num(it.qty) || 1,
      price: num(it.price),
      discount: num(it.discount),
    }));
  }
  const original = num(data?.amount_original ?? data?.amount);
  const paid = num(data?.amount);
  return [{
    category: 'procedure',
    name: data?.package_type || data?.service_type || 'Physiotherapy Session',
    qty: 1,
    price: original,
    discount: Math.max(0, original - paid),
  }];
};

const InvoiceTemplateKwitansi = forwardRef(({ data }, ref) => {
  const clinic = data?.clinic || {};
  const items = getKwitansiItems(data);
  const lineTotal = (it) => it.qty * it.price - it.discount;
  const subAmount = items.reduce((s, it) => s + it.qty * it.price, 0);
  const subDisc = items.reduce((s, it) => s + it.discount, 0);
  const total = subAmount - subDisc;

  const groups = KWITANSI_CATEGORIES
    .map((c) => ({ ...c, rows: items.filter((it) => it.category === c.value) }))
    .filter((g) => g.rows.length > 0);

  const patientName = data?.patients?.full_name || data?.patient?.full_name || data?.patient_name || data?.guest_name || '-';
  const mr = data?.patients?.medical_record_number || data?.patient?.medical_record_number || '-';
  const admission = data?.admission_number ? `${data.admission_number} / ${mr}` : mr;
  const phone = data?.patients?.phone || data?.patient?.phone || data?.guest_phone || '-';
  const therapist = data?.therapist?.name || data?.therapist_name || '-';
  const invoiceNo = data?.receipt_number || data?.invoice_number || '-';
  const cashier = data?.admin_signer_name || clinic.invoice_admin_name || '';
  const signatureUrl = data?.admin_signer_signature_url || clinic.invoice_admin_signature_url || '';
  const printed = new Date();
  const printedStr = `${pad(printed.getDate())}-${MONTHS[printed.getMonth()]}-${printed.getFullYear()}`;

  const splits = Array.isArray(data?.payment_splits) && data.payment_splits.length > 0
    ? data.payment_splits.map((s) => ({ mode: s.payment_method, amount: num(s.amount) }))
    : [{ mode: data?.payment_method || '-', amount: total }];
  const paid = splits.reduce((s, p) => s + p.amount, 0);
  const payDate = fmtDate(data?.recap_date);

  const INK = '#0f172a';
  const MUTED = '#64748b';
  const LINE = '#e2e8f0';
  const ACCENT = '#0f3d3e';

  const th = {
    padding: '9px 8px', fontWeight: 600, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: MUTED, borderBottom: `1px solid ${INK}`, textAlign: 'left',
  };
  const td = { padding: '8px 8px', borderBottom: `1px solid ${LINE}`, verticalAlign: 'top' };
  const tdR = { ...td, textAlign: 'right' };
  const tdC = { ...td, textAlign: 'center' };
  const sumLabel = { textAlign: 'right', color: MUTED, padding: '5px 8px', fontSize: '10.5px' };
  const sumVal = { textAlign: 'right', padding: '5px 8px' };

  const infoRow = (label, value, labelW) => (
    <div style={{ display: 'flex', marginBottom: '7px', lineHeight: 1.4 }}>
      <span style={{ width: labelW, color: MUTED, flexShrink: 0 }}>{label}</span>
      <span style={{ width: '12px', color: MUTED, flexShrink: 0 }}>:</span>
      <span style={{ fontWeight: 600, color: INK }}>{value}</span>
    </div>
  );

  let rowNo = 0;
  return (
    <div
      ref={ref}
      style={{
        width: '210mm', height: '297mm', boxSizing: 'border-box', background: '#fff',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '11px', color: INK,
        padding: '0 44px', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ height: '6px', background: ACCENT, margin: '0 -44px' }} />

      <div style={{ textAlign: 'center', paddingTop: '30px' }}>
        {clinic.logo_url
          ? <img src={clinic.logo_url} alt="logo" crossOrigin="anonymous" style={{ height: '56px', maxWidth: '240px', objectFit: 'contain' }} />
          : <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '0.04em' }}>{(clinic.name || '').toUpperCase()}</p>}
        <p style={{ margin: '14px auto 0', fontSize: '9.5px', color: MUTED, maxWidth: '440px', lineHeight: 1.5 }}>{clinic.address || ''}</p>
        <div style={{ width: '32px', height: '2px', background: ACCENT, margin: '22px auto 14px' }} />
        <p style={{ margin: '0 0 28px', fontSize: '17px', fontWeight: 600, letterSpacing: '0.32em', paddingLeft: '0.32em' }}>KWITANSI</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '26px', padding: '16px 18px', background: '#f8fafc', borderRadius: '6px' }}>
        <div>
          {infoRow('Admission No / MR', admission, '112px')}
          {infoRow('Name', patientName, '112px')}
          {infoRow('Phone', phone, '112px')}
          {infoRow('Physiotherapist', therapist, '112px')}
        </div>
        <div>
          {infoRow('Invoice No', invoiceNo, '100px')}
          {infoRow('Invoice Date', fmtDateTime(data?.created_at || data?.recap_date), '100px')}
          {infoRow('Registration Date', fmtDate(data?.recap_date), '100px')}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '28px', textAlign: 'center' }}>No</th>
            <th style={th}>Name</th>
            <th style={{ ...th, width: '34px', textAlign: 'center' }}>Qty</th>
            <th style={{ ...th, width: '52px', textAlign: 'center' }}>UOM</th>
            <th style={{ ...th, width: '66px', textAlign: 'right' }}>Amount</th>
            <th style={{ ...th, width: '66px', textAlign: 'right' }}>Disc</th>
            <th style={{ ...th, width: '74px', textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.value}>
              <tr>
                <td style={{ ...td, borderBottom: 'none', paddingBottom: '2px' }}></td>
                <td colSpan={6} style={{ ...td, borderBottom: 'none', paddingBottom: '2px', fontWeight: 700, fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT }}>{g.label}</td>
              </tr>
              {g.rows.map((it, i) => {
                rowNo += 1;
                return (
                  <tr key={`${g.value}-${i}`}>
                    <td style={{ ...tdC, color: MUTED }}>{rowNo}</td>
                    <td style={td}>{it.name}</td>
                    <td style={tdC}>{it.qty}</td>
                    <td style={td}></td>
                    <td style={tdR}>{idr(it.price)}</td>
                    <td style={tdR}>{idr(it.discount)}</td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{idr(lineTotal(it))}</td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          <tr>
            <td colSpan={4} style={{ ...sumLabel, paddingTop: '12px' }}>Sub Total :</td>
            <td style={{ ...sumVal, paddingTop: '12px' }}>{idr(subAmount)}</td>
            <td style={{ ...sumVal, paddingTop: '12px' }}>{idr(subDisc)}</td>
            <td style={{ ...sumVal, paddingTop: '12px' }}>{idr(total)}</td>
          </tr>
          <tr><td colSpan={4} style={sumLabel}>Charge Fee :</td><td style={sumVal}></td><td style={sumVal}></td><td style={sumVal}>0</td></tr>
          <tr><td colSpan={4} style={sumLabel}>Total :</td><td style={sumVal}></td><td style={sumVal}></td><td style={sumVal}>{idr(total)}</td></tr>
          <tr>
            <td colSpan={4} style={{ ...sumLabel, color: INK, fontWeight: 700, borderTop: `1px solid ${INK}`, padding: '9px 8px' }}>Payment :</td>
            <td style={{ ...sumVal, borderTop: `1px solid ${INK}` }}></td>
            <td style={{ ...sumVal, borderTop: `1px solid ${INK}` }}></td>
            <td style={{ ...sumVal, borderTop: `1px solid ${INK}`, fontWeight: 700, fontSize: '12.5px', color: ACCENT, padding: '9px 8px' }}>{idr(paid)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ margin: '24px 0 30px', padding: '10px 14px', borderLeft: `3px solid ${ACCENT}`, background: '#f8fafc' }}>
        <span style={{ fontWeight: 700, fontSize: '9px', letterSpacing: '0.08em', color: MUTED }}>IN WORD PATIENT :</span>{' '}
        <span style={{ fontStyle: 'italic', fontWeight: 600 }}>{terbilangRupiah(paid)}</span>
      </p>

      <p style={{ fontWeight: 700, fontSize: '9px', letterSpacing: '0.08em', color: MUTED, margin: '0 0 6px' }}>PATIENT RECEIPT :</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            {['Type', 'Date', 'Payment Mode', 'Account No', 'Description', 'Cashier', 'Amount'].map((h) => (
              <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {splits.map((p, i) => (
            <tr key={i}>
              <td style={td}>Payment</td>
              <td style={td}>{payDate}</td>
              <td style={{ ...td, textTransform: 'uppercase' }}>{p.mode}</td>
              <td style={td}>-</td>
              <td style={td}>-</td>
              <td style={td}>{cashier}</td>
              <td style={tdR}>{idr(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0', fontSize: '11px' }}>
        <b style={{ marginRight: '10px' }}>Total :</b><b style={{ width: '64px', textAlign: 'right' }}>{idr(paid)}</b>
      </div>

      <div style={{ marginTop: '34px', marginLeft: 'auto', textAlign: 'center', width: '170px' }}>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>Cashier</p>
        <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {signatureUrl && <img src={signatureUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: '66px', maxWidth: '130px' }} />}
        </div>
        <p style={{ fontWeight: 700, margin: 0, paddingTop: '6px', borderTop: `1px solid ${INK}` }}>{cashier}</p>
      </div>

      <div style={{ position: 'absolute', left: '44px', right: '44px', bottom: '30px', borderTop: `1px solid ${LINE}`, paddingTop: '8px', fontSize: '9px', color: MUTED }}>
        <p style={{ margin: 0 }}>Invoice ini merupakan bukti pembayaran yang sah</p>
        <p style={{ margin: 0 }}>Printed on: {printedStr}{cashier ? ` by ${cashier}` : ''}</p>
      </div>
    </div>
  );
});

export default InvoiceTemplateKwitansi;
