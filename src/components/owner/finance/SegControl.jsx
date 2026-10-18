import React from 'react';
import { cn } from '@/lib/utils';

// Kontrol segmen (tab kecil). items: [{ value, label, icon }]. Bisa di-scroll di layar sempit.
const SegControl = ({ items, value, onChange, className }) => (
  <div role="group" className={cn('flex gap-0.5 p-[3px] rounded-xl bg-slate-100 overflow-x-auto max-w-full w-fit [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
    {items.map(({ value: v, label, icon: Icon }) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        aria-pressed={value === v}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[12.5px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow]',
          value === v ? 'bg-white text-app-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </button>
    ))}
  </div>
);

export default SegControl;
