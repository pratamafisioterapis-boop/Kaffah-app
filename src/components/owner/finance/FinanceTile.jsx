import React from 'react';
import { cn } from '@/lib/utils';
import { TONES } from '@/components/owner/finance/financeTheme';

// Kotak dasar dashboard finance: ikon + judul pendek di kiri, aksi opsional di kanan.
const FinanceTile = ({ tone = 'acc', icon: Icon, title, action, tinted = false, className, children }) => {
  const t = TONES[tone] || TONES.acc;
  return (
    <section
      className={cn(
        'min-w-0 rounded-[22px] border border-slate-100 bg-white p-4 md:p-5 shadow-sm',
        'transition-[transform,box-shadow] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md',
        tinted && t.tint,
        className
      )}
    >
      <header className="flex items-center gap-2 mb-3 min-h-[28px]">
        {Icon && (
          <span className={cn('w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0', t.icon)}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <h3 className="text-[13px] font-semibold text-slate-500 leading-tight min-w-0 break-words">{title}</h3>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
};

export const TileEmpty = ({ children }) => (
  <p className="text-sm text-slate-500 text-center py-8">{children}</p>
);

export const TileLoading = ({ className }) => (
  <div className={cn('flex justify-center py-10', className)}>
    <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin motion-reduce:animate-none" />
  </div>
);

export default FinanceTile;
