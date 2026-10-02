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

  const th = { border: '1px solid #000', padding: '4px 6px', fontWeight: 700, textAlign: 'center' };
  const tdBase = { padding: '4px 6px', borderLeft: '1px solid #000', borderRight: '1px solid #000', verticalAlign: 'top' };
  const right = { ...tdBase, textAlign: 'right' };
  const center = { ...tdBase, textAlign: 'center' };
  const sumLabel = { textAlign: 'right', fontWeight: 700, padding: '4px 6px' };
  const sumVal = { textAlign: 'right', padding: '4px 6px' };

  const infoRow = (label, value, labelW) => (
    <div style={{ display: 'flex', marginBottom: '5px' }}>
      <span style={{ width: labelW, fontWeight: 700 }}>{label}</span>
      <span style={{ width: '12px', fontWeight: 700 }}>:</span>
      <span>{value}</span>
    </div>
  );

  let rowNo = 0;
  return (
    <div
      ref={ref}
      style={{
        width: '210mm', height: '297mm', boxSizing: 'border-box', background: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#000',
        padding: '28px 40px', position: 'relative',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {clinic.logo_url
          ? <img src={clinic.logo_url} alt="logo" crossOrigin="anonymous" style={{ height: '56px', maxWidth: '240px', objectFit: 'contain' }} />
          : <p style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{(clinic.name || '').toUpperCase()}</p>}
        <p style={{ margin: '22px 0 0', fontSize: '10.5px' }}>{clinic.address || ''}</p>
        <p style={{ margin: '24px 0 22px', fontSize: '18px', fontWeight: 700 }}>KWITANSI</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '26px' }}>
        <div>
          {infoRow('Admission No / MR', mr, '112px')}
          {infoRow('Name', patientName, '112px')}
          {infoRow('Phone', phone, '112px')}
          {infoRow('Physiotherapist', therapist, '112px')}
        </div>
        <div style={{ marginRight: '40px' }}>
          {infoRow('Invoice No', invoiceNo, '100px')}
          {infoRow('Invoice Date', fmtDateTime(data?.created_at || data?.recap_date), '100px')}
          {infoRow('Registration Date', fmtDate(data?.recap_date), '100px')}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '28px' }}>No</th>
            <th style={th}>Name</th>
            <th style={{ ...th, width: '34px' }}>Qty</th>
            <th style={{ ...th, width: '52px' }}>UOM</th>
            <th style={{ ...th, width: '66px' }}>Amount</th>
            <th style={{ ...th, width: '66px' }}>Disc</th>
            <th style={{ ...th, width: '74px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <React.Fragment key={g.value}>
              <tr>
                <td style={tdBase}></td>
                <td style={{ ...tdBase, fontWeight: 700 }}>{g.label}</td>
                <td style={tdBase}></td><td style={tdBase}></td><td style={tdBase}></td><td style={tdBase}></td><td style={tdBase}></td>
              </tr>
              {g.rows.map((it, i) => {
                rowNo += 1;
                return (
                  <tr key={`${g.value}-${i}`}>
                    <td style={center}>{rowNo}</td>
                    <td style={tdBase}>{it.name}</td>
                    <td style={center}>{it.qty}</td>
                    <td style={tdBase}></td>
                    <td style={right}>{idr(it.price)}</td>
                    <td style={right}>{idr(it.discount)}</td>
                    <td style={right}>{idr(lineTotal(it))}</td>
                  </tr>
                );
              })}
              {gi < groups.length - 1 && (
                <tr><td style={{ ...tdBase, height: '18px' }} colSpan={7}></td></tr>
              )}
            </React.Fragment>
          ))}
          <tr>
            <td colSpan={4} style={{ ...sumLabel, borderTop: '1px solid #000' }}>Sub Total :</td>
            <td style={{ ...sumVal, borderTop: '1px solid #000' }}>{idr(subAmount)}</td>
            <td style={{ ...sumVal, borderTop: '1px solid #000' }}>{idr(subDisc)}</td>
            <td style={{ ...sumVal, borderTop: '1px solid #000' }}>{idr(total)}</td>
          </tr>
          <tr><td colSpan={4} style={sumLabel}>Charge Fee :</td><td style={sumVal}></td><td style={sumVal}></td><td style={sumVal}>0</td></tr>
          <tr><td colSpan={4} style={sumLabel}>Total :</td><td style={sumVal}></td><td style={sumVal}></td><td style={sumVal}>{idr(total)}</td></tr>
          <tr><td colSpan={4} style={sumLabel}>Payment :</td><td style={sumVal}></td><td style={sumVal}></td><td style={sumVal}>{idr(paid)}</td></tr>
        </tbody>
      </table>

      <p style={{ margin: '34px 0 22px' }}>
        <b>IN WORD PATIENT :</b> {terbilangRupiah(paid)}
      </p>

      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>PATIENT RECEIPT :</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '11px' }}>
        <thead>
          <tr>
            {['Type', 'Date', 'Payment Mode', 'Account No', 'Description', 'Cashier', 'Amount'].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {splits.map((p, i) => (
            <tr key={i}>
              <td style={{ ...tdBase, border: '1px solid #000' }}>Payment</td>
              <td style={{ ...tdBase, border: '1px solid #000' }}>{payDate}</td>
              <td style={{ ...tdBase, border: '1px solid #000', textTransform: 'uppercase' }}>{p.mode}</td>
              <td style={{ ...tdBase, border: '1px solid #000' }}>-</td>
              <td style={{ ...tdBase, border: '1px solid #000' }}>-</td>
              <td style={{ ...tdBase, border: '1px solid #000' }}>{cashier}</td>
              <td style={{ ...tdBase, border: '1px solid #000', textAlign: 'right' }}>{idr(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 6px 0', fontSize: '11px' }}>
        <b style={{ marginRight: '10px' }}>Total :</b><span style={{ width: '64px', textAlign: 'right' }}>{idr(paid)}</span>
      </div>

      <div style={{ marginTop: '36px', marginLeft: '62%', textAlign: 'center', width: '150px' }}>
        <p style={{ fontWeight: 700, margin: 0 }}>Cashier</p>
        <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {signatureUrl && <img src={signatureUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: '66px', maxWidth: '130px' }} />}
        </div>
        <p style={{ fontWeight: 700, margin: 0 }}>{cashier}</p>
      </div>

      <div style={{ position: 'absolute', left: '40px', right: '40px', bottom: '30px', borderTop: '1px solid #eee', paddingTop: '6px', fontSize: '9.5px' }}>
        <p style={{ margin: 0 }}>Invoice ini merupakan bukti pembayaran yang sah</p>
        <p style={{ margin: 0 }}>Printed on: {printedStr}{cashier ? ` by ${cashier}` : ''}</p>
      </div>
    </div>
  );
});

export default InvoiceTemplateKwitansi;
