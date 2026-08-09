import React from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Bungkus konsisten untuk tiap slide: judul besar + periode di kanan atas,
// lalu area konten yang mengisi sisa tinggi layar.
const SlideShell = ({ eyebrow, title, dateRange, children }) => {
  const periodLabel = dateRange?.startDate && dateRange?.endDate
    ? `${format(new Date(`${dateRange.startDate}T00:00:00`), 'dd MMM yyyy', { locale: idLocale })} – ${format(new Date(`${dateRange.endDate}T00:00:00`), 'dd MMM yyyy', { locale: idLocale })}`
    : '';

  return (
    <div className="h-full w-full flex flex-col p-6 md:p-10 lg:p-14">
      <div className="flex items-start justify-between gap-4 mb-6 md:mb-10">
        <div>
          <p className="text-amber-300/80 text-xs md:text-sm font-bold uppercase tracking-widest mb-1">{eyebrow}</p>
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">{title}</h2>
        </div>
        {periodLabel && (
          <div className="shrink-0 bg-white/10 border border-white/10 rounded-xl px-3 py-2 md:px-4 md:py-2.5 text-right">
            <p className="text-[10px] md:text-xs text-amber-300/80 font-bold uppercase tracking-wider">Periode</p>
            <p className="text-xs md:text-sm text-white font-semibold">{periodLabel}</p>
          </div>
        )}
      </div>
      {/* overflow-y-auto = jaring pengaman: kalau konten slide lebih tinggi dari
          layar (banyak stat tile di layar sempit/landscape), tetap bisa
          di-scroll di dalam slide alih-alih terpotong tanpa cara melihat sisanya. */}
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
};

export default SlideShell;
