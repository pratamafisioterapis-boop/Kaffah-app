import React from 'react';
import { cn } from '@/lib/utils';

// Kartu KPI besar untuk slide presentasi — didesain untuk dibaca dari jarak
// jauh (proyektor/layar besar), jadi tipografi jauh lebih besar dari widget
// dashboard biasa.
const StatTile = ({ icon: Icon, label, value, sublabel, accent = 'amber', className }) => {
  const accentClasses = {
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    sky: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
    rose: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
    violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
  };

  return (
    <div className={cn('rounded-2xl border bg-white/5 backdrop-blur-sm p-4 md:p-5 flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center border', accentClasses[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <p className="text-slate-300 text-xs md:text-sm font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl md:text-4xl font-black text-white leading-none">{value}</p>
      {sublabel && <p className="text-slate-400 text-xs md:text-sm">{sublabel}</p>}
    </div>
  );
};

export default StatTile;
