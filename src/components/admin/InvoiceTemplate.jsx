import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { MapPin, Phone } from 'lucide-react';

const InvoiceTemplate = forwardRef(({ data, logoUrl, invoiceTitle, invoiceSubtitle }, ref) => {
  // Formatting helpers
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const today = new Date();
  const invoiceDate = data.recap_date ? new Date(data.recap_date) : today;
  // Fallback for ID and RM Number if missing
  const idStr = data.id ? data.id.substring(0, 4).toUpperCase() : '0000';
  const rmStr = data.rm_number ? data.rm_number.replace('RM', '') : '000';
  const invoiceNumber = `INV/${format(invoiceDate, 'yyyyMMdd')}/${rmStr}/${idStr}`;
  
  // Calculate discount and total
  const amount = Number(data.amount) || 0;
  let discountAmount = 0;
  
  if (data.discount_value > 0) {
      if (data.discount_type === 'percentage') {
          discountAmount = (amount * Number(data.discount_value)) / 100;
      } else {
          discountAmount = Number(data.discount_value);
      }
  }
  
  const finalTotal = Math.max(0, amount - discountAmount);

  const renderDiagnosis = (diagnosis) => {
      if (Array.isArray(diagnosis)) {
          return diagnosis.map(d => typeof d === 'string' ? d : JSON.stringify(d)).join(', ');
      }
      if (typeof diagnosis === 'object' && diagnosis !== null) {
          return JSON.stringify(diagnosis);
      }
      return diagnosis || '-';
  };

  return (
    <div 
      ref={ref} 
      className="bg-white text-slate-900" 
      id="invoice-template"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm 20mm', // Standard print margins inside the A4 container
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        position: 'relative',
        fontSize: '12px', // Explicit base font size
        lineHeight: '1.5',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e293b', paddingBottom: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Logo / Brand Identity */}
          {logoUrl ? (
             <img 
               src={logoUrl} 
               alt="Clinic Logo" 
               style={{ maxWidth: '150px', height: 'auto', objectFit: 'contain', display: 'block', marginBottom: '4px' }}
               crossOrigin="anonymous" 
             />
          ) : null}
          
          {(!logoUrl) && (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ height: '54px', width: '54px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', borderRadius: '4px' }}>
                  KC
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', margin: 0, lineHeight: '1.2' }}>
                  {invoiceSubtitle || 'Kaffah Physiotherapy'}
                </h1>
            </div>
          )}

           {/* If logo exists, show subtitle below it as clinic name if needed, or rely on logo text */}
           {logoUrl && (
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e3a8a', margin: 0, lineHeight: '1.2' }}>
                  {invoiceSubtitle || 'Kaffah Physiotherapy'}
              </h1>
           )}
          
          {/* Address Details - Always Visible below branding */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#475569' }}>
              <MapPin style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ maxWidth: '250px', display: 'block' }}>Jl.Telindung, Perumnas Blok 1 RT.07 NO.71 Batu Ampar, Balikpapan Utara</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
              <Phone style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              <span>0852-4596-5745</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, lineHeight: '1' }}>
            {invoiceTitle || 'Invoice'}
          </h2>
          <p style={{ fontFamily: 'monospace', color: '#475569', marginTop: '8px', fontWeight: '500', fontSize: '14px' }}>{invoiceNumber}</p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {format(invoiceDate, 'dd MMMM yyyy', { locale: idLocale })}
          </p>
        </div>
      </div>

      {/* Info Grid - Using Flexbox for layout consistency */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', marginBottom: '32px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Ditagihkan Kepada</h3>
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{data.patient_name}</p>
          <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>RM: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{data.rm_number}</span></p>
          {data.patient_phone && <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0 0 0' }}>{data.patient_phone}</p>}
          {data.patient_address && <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0 0 0', maxWidth: '300px' }}>{data.patient_address}</p>}
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <h3 style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Detail Layanan</h3>
          <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a', margin: 0 }}>Terapis: {data.therapist_name || '-'}</p>
          <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
            Metode Pembayaran: <span style={{ textTransform: 'capitalize' }}>{data.payment_method || 'Tunai'}</span>
          </p>
        </div>
      </div>

      {/* Table - Explicit styling */}
      <div style={{ marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '50px' }}>No</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deskripsi Layanan</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>Kode</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px' }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '16px', fontSize: '13px', color: '#64748b', verticalAlign: 'top' }}>1</td>
              <td style={{ padding: '16px', verticalAlign: 'top' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', margin: 0 }}>{data.service_type || 'Layanan Fisioterapi'}</p>
                {data.diagnosis && (
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Diagnosa: {renderDiagnosis(data.diagnosis)}
                  </p>
                )}
                {data.package_type && (
                  <p style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px', fontWeight: '500' }}>
                    Paket: {data.package_type}
                  </p>
                )}
              </td>
              <td style={{ padding: '16px', fontSize: '13px', color: '#64748b', fontFamily: 'monospace', verticalAlign: 'top' }}>SRV-001</td>
              <td style={{ padding: '16px', textAlign: 'right', fontSize: '13px', fontWeight: '500', color: '#0f172a', verticalAlign: 'top' }}>
                {formatCurrency(amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals - Fixed width container on right */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '48px' }}>
        <div style={{ width: '250px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(amount)}</span>
          </div>
          
          {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ea580c', marginBottom: '8px' }}>
                <span>Diskon {data.discount_type === 'percentage' ? `(${data.discount_value}%)` : ''}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#0f172a', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
            <span>Total</span>
            <span style={{ color: '#1d4ed8' }}>{formatCurrency(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signatures - Fixed positioning at bottom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '48px' }}>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '64px' }}>Penerima / Pasien</p>
          <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{data.patient_name}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '64px' }}>Hormat Kami,</p>
          <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>Admin Keuangan</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '48px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
        <p style={{ margin: 0 }}>Terima kasih atas kepercayaan Anda kepada Kaffah Care.</p>
        <p style={{ margin: '4px 0 0 0' }}>Invoice ini sah dan diproses oleh komputer.</p>
      </div>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;