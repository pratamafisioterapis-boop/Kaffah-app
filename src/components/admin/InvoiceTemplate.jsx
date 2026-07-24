import React, { forwardRef } from 'react';

const InvoiceTemplate = forwardRef(({ data }, ref) => {

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };
const therapistName = data?.therapist_name ?? '-';
  const payment = (data?.payment_method || '').toLowerCase();

const checked = (val) => payment === val ? '☑' : '☐';
  return (
    <div
      ref={ref}
      style={{
        width: '210mm',
        height: '297mm',
        display: 'flex',
        fontFamily: 'Inter, Arial',
        background: '#fff'
      }}
    >

      {/* SIDEBAR */}
      <div style={{
        width: '52mm',
        background: 'linear-gradient(180deg, #2f4f7f 0%, #7fa4c4 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '55px'
      }}>

        <div style={{
          background: '#fff',
          padding: '18px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          marginBottom: '30px'
        }}>
          <img src={data?.clinic?.logo_url || '/logo.png'} alt="logo" style={{ width: '85px' }} />
        </div>

        <div style={{ textAlign: 'center', color: '#fff', padding: '0 18px' }}>
          <p style={{
  fontWeight: '800',
  fontSize: '16px',
  letterSpacing: '1.5px',
  marginBottom: '18px',
  lineHeight: '1.4'
}}>
  {(data?.clinic?.name || '').toUpperCase()}
</p>

          <p style={{
  fontSize: '11px',
  lineHeight: '1.8',
  marginTop: '6px'
}}>
            {data?.clinic?.address || ''}
          </p>

          <div style={{
            width: '30px',
            height: '2px',
            background: 'rgba(255,255,255,0.5)',
            margin: '16px auto'
          }} />

          <p style={{ fontSize: '11px' }}>
            {data?.clinic?.email || ''}
          </p>
          <p style={{ fontSize: '11px' }}>
            {data?.clinic?.phone || ''}
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, padding: '55px 60px' }}>

        {/* HEADER */}
<div style={{ marginBottom: '20px' }}>
  <div style={infoRowLeft}>
    <span style={labelLeft}>DATE</span>
    <span style={colon}>:</span>
    <span style={value}>
  {data?.recap_date
    ? (() => {
        const d = new Date(data.recap_date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      })()
    : '-'}
</span>
  </div>

  <div style={infoRowLeft}>
    <span style={labelLeft}>RECEIPT NO.</span>
    <span style={colon}>:</span>
    <span style={value}>
  {data?.receipt_number 
    || data?.receiptNumber
    || data?.invoice_number
    || data?.invoiceNumber
    || '-'}
</span>
  </div>
</div>
<div style={{ marginTop: '70px' }}>
        {/* INFO */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '30px'
        }}>
          <div>
            <p style={sectionTitleUnderline}>Patient Information</p>
            <p style={text}>
  {data?.patients?.full_name || data?.patient_name || '-'}
</p>

<p style={text}>
  {data?.patients?.medical_record_number || '-'}
</p>

<p style={text}>
  {data?.patients?.address || '-'}
</p>

<p style={text}>
  {data?.patients?.phone || '-'}
</p>
          </div>

          <div>
            <p style={sectionTitleUnderline}>Physiotherapist Information</p>
            <p style={text}>
  {data?.physiotherapists?.name 
    || data?.therapist_name 
    || data?.therapist?.name 
    || '-'}
</p>
          </div>
        </div>

        {/* TABLE */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '10px'
        }}>
          <thead>
            <tr style={{
              background: '#4f7fb5',
              color: '#fff'
            }}>
              <th style={thCenter}>CODE</th>
              <th style={thCenter}>DESCRIPTION</th>
              <th style={thCenter}>SESSION</th>
              <th style={thCenter}>RATE</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={tdCenter}>
  {
    data?.service_type === 'Musculoskeletal Treatment' ? 'A17' :
    data?.service_type === 'Cardiorespiratory Physiotherapy' ? 'B29' :
    data?.service_type === 'Sport Injury Treatment' ? 'C34' :
    data?.service_type === 'Neurological Rehabilitation' ? 'D08' :
    data?.service_type === 'Pre-Post Operative Rehabilitation' ? 'E52' :
    'X00'
  }
</td>
              <td style={tdCenter}>{data?.service_type || '-'}</td>
              <td style={tdCenter}>
  {data?.package_type || data?.service_type || '-'}
</td>
              <td style={tdCenter}>{formatCurrency(data?.amount_original || data?.amount)}</td>
            </tr>

            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td style={empty}></td>
                <td style={empty}></td>
                <td style={empty}></td>
                <td style={empty}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL (FIXED GRID SYSTEM) */}
        <div style={{
  width: '300px',
  marginLeft: 'auto',
  marginRight: '10px',
  marginTop: '35px'
}}>

          <div style={totalGrid}>
            <span>Subtotal</span>
            <span>:</span>
            <span>{formatCurrency(data?.amount_original || data?.amount)}</span>

            <span>Discount</span>
            <span>:</span>
            <span style={{ textAlign: 'right' }}>
  {data?.discount_value
    ? data?.discount_type === 'percentage'
      ? `${data.discount_value}%`
      : formatCurrency(data.discount_value)
    : ''}
</span>
          </div>

          <div style={balanceGrid}>
            <span>Balance Paid</span>
            <span>:</span>
            <span>{formatCurrency(data?.amount)}</span>
          </div>

        </div>

        {/* PAYMENT */}
        <div style={{ marginTop: '80px' }}>
          <p style={sectionTitle}>Payment Method</p>
         

<p style={text}>{checked('cash')} Cash</p>
<p style={text}>{checked('qris')} Qris</p>
<p style={text}>{checked('debit')} Debit card</p>
<p style={text}>{checked('credit')} Credit card</p>
<p style={text}>{checked('insurance')} Insurance</p>
<p style={text}>{checked('transfer')} Transfer</p>
        </div>
        
        {/* SIGNATURE */}
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '50px'
}}>
  
  <div style={{ 
    textAlign: 'center',
    width: '33%',
    height: '160px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  }}>
    <p>Physiotherapist</p>
  {/* SIGNATURE CONTAINER */}
  <div style={{
    height: '70px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center'
  }}>
    {data?.therapist?.signature_url && (
      <img 
        src={data.therapist.signature_url} 
        style={{ width: '70px' }}
      />
    )}
  </div>

  {/* GARIS (ANCHOR UTAMA) */}
  <div style={{
    width: '160px',
    height: '1px',
    background: '#000',
    margin: '0 auto'
  }} />

  {/* STAMP CONTAINER */}
  <div style={{
    height: '70px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center'
  }}>
    {data?.therapist?.stamp_url ? (
  <img
    src={data.therapist.stamp_url}
    style={{ width: '120px', marginTop: '5px' }}
  />
) : data?.therapist?.license_number ? (
  // Belum ada gambar stempel yang diunggah — tampilkan nama + No. STR/SIP
  // sebagai teks bergaya stempel supaya kwitansi tetap terlihat resmi.
  <div style={{ textAlign: 'center', marginTop: '6px' }}>
    <p style={{
      fontSize: '13px',
      fontWeight: '700',
      color: '#1e3a5f',
      textDecoration: 'underline',
      margin: 0,
    }}>
      {data?.therapist?.name || data?.therapist_name || '-'}
    </p>
    <p style={{
      fontSize: '10px',
      fontWeight: '600',
      color: '#1e3a5f',
      margin: '2px 0 0',
    }}>
      SIPF:{data.therapist.license_number}
    </p>
  </div>
) : (
  <p style={{
    fontSize: '12px',
    fontWeight: '600',
    marginTop: '10px'
  }}>
    {data?.therapist?.name || data?.therapist_name || '-'}
  </p>
)}
  </div>
</div>
{/* LOGO TENGAH */}
<div style={{
  width: '160px',
  height: '140px', // 🔥 tinggi total biar sejajar kiri-kanan
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <img 
    src={data?.clinic?.logo_url || "https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/assets-invoice/logo/logo.png"}
    style={{ 
      width: '110px',
      opacity: 0.25
    }}
  />
</div>
  <div style={{ 
    textAlign: 'center',
    width: '33%',
    height: '160px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  }}>
    <p>Patient</p>

  {/* EMPTY CONTAINER (SAMAKAN DENGAN SIGNATURE) */}
 <div style={{
  height: '120px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between'
}}>
</div>
  {/* GARIS (HARUS IDENTIK) */}
  <div style={{
    width: '160px',
    height: '1px',
    background: '#000',
    margin: '0 auto'
  }} />

  {/* NAMA */}
  <p style={{ 
    fontSize: '12px', 
    fontWeight: '600',
    marginTop: '6px',
    marginBottom: '40px'
  }}>
    {data?.patients?.full_name || data?.patient_name || '-'}
  </p>
</div>

</div>
</div>
      </div>
    </div>
    
  );
});

/* ===== STYLE ===== */

const thCenter = {
  padding: '10px',
  fontSize: '12px',
  textAlign: 'center'
};

const tdCenter = {
  padding: '10px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '12px',
  textAlign: 'center'
};

const empty = {
  borderBottom: '1px solid #f1f5f9',
  height: '20px'
};

const infoRow = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  fontSize: '12px',
  paddingRight: '10px'
};
const infoRowLeft = {
  display: 'flex',
  gap: '6px',
  fontSize: '12px',
  marginBottom: '4px'
};
const labelLeft = {
  width: '95px',
  textAlign: 'left',
  color: '#6b7280'
};
const label = {
  width: '140px',
  textAlign: 'right',
  color: '#6b7280'
};
const colon = {
  width: '10px',
  textAlign: 'center'
};
const value = {
  minWidth: '120px',
  textAlign: 'left',
  fontWeight: '600'
};

/* GRID TOTAL */
const totalGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 70px auto',
  rowGap: '6px',
  fontSize: '13px'
};

const balanceGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 70px auto',
  marginTop: '10px',
  paddingTop: '8px',
  borderTop: '1px solid #d1d5db',
  fontWeight: '600',
  fontSize: '14px'
};

const sectionTitle = {
  fontWeight: '600',
  marginBottom: '6px'
};
const sectionTitleUnderline = {
  fontWeight: '600',
  marginBottom: '10px',
 borderBottom: '2px solid #64748b',
  display: 'inline-block',
  paddingBottom: '4px'
};
const text = {
  fontSize: '12px',
  margin: '1px 0'
};

export default InvoiceTemplate;