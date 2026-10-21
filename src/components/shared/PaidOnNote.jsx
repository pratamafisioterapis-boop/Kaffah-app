import React from 'react';

// Catatan kecil bila uang masuk di tanggal berbeda dari tanggal terapi
// (revenue_date = tanggal pembayaran, recap_date = tanggal terapi).
const PaidOnNote = ({ recap, className = '' }) => {
  if (!recap?.revenue_date || !recap?.recap_date || recap.revenue_date === recap.recap_date) return null;
  const d = new Date(`${recap.revenue_date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <div className={`text-[11px] font-medium text-amber-600 ${className}`}>
      Dibayar {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
    </div>
  );
};

export default PaidOnNote;
