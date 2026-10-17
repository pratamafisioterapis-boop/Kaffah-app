import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dialog di layar sempit tampil sebagai panel yang naik dari bawah, di layar
// lebar tetap dialog di tengah. Dipakai lewat <DialogContent className={SHEET_DIALOG} />.
export const SHEET_DIALOG =
  'max-h-[92dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-h-[90vh]';

// Kolom tabel responsif: kartu bertumpuk di layar sempit, grid kolom di >=1180px.
export const WIDE = 'min-[1180px]';

export const PageHead = ({ title, description, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div className="min-w-0">
      <h1 className="text-xl min-[700px]:text-2xl font-semibold tracking-tight text-app-ink [text-wrap:balance]">{title}</h1>
      {description && <p className="mt-1 text-sm text-app-muted max-w-[60ch]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 max-sm:w-full [&>*]:max-sm:flex-1">{actions}</div>}
  </div>
);

export const Panel = ({ className, children, ...props }) => (
  <section className={cn('bg-white rounded-2xl border border-app-border', className)} {...props}>{children}</section>
);

export const PanelTitle = ({ children, hint }) => (
  <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
    <h2 className="text-[15px] font-semibold text-app-ink">{children}</h2>
    {hint && <span className="text-xs text-app-muted">{hint}</span>}
  </div>
);

const PILL = {
  ok: 'bg-emerald-50 text-emerald-800',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-800',
  info: 'bg-app-soft text-app-accent',
  neutral: 'bg-slate-100 text-slate-700',
};
export const Pill = ({ tone = 'neutral', dot = true, className, children }) => (
  <span className={cn('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap', PILL[tone], className)}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

export const EmptyState = ({ title, children, icon: Icon = Inbox }) => (
  <div className="py-10 px-5 text-center text-sm text-app-muted">
    <Icon className="w-8 h-8 mx-auto mb-3 text-slate-300" />
    <p className="font-semibold text-app-ink mb-0.5">{title}</p>
    {children}
  </div>
);

export const Spinner = () => (
  <div className="flex justify-center py-16" role="status" aria-label="Memuat">
    <div className="w-8 h-8 rounded-full border-[3px] border-app-soft border-t-app-accent animate-spin" />
  </div>
);

export const Initials = ({ name, className }) => (
  <span className={cn('w-10 h-10 rounded-xl bg-app-soft text-app-accent grid place-items-center text-sm font-semibold shrink-0', className)}>
    {(String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase()}
  </span>
);

// Tombol aksi kecil: ikon saja di layar lebar, ikon + teks di layar sempit.
export const RowAction = React.forwardRef(({ icon: Icon, label, tone, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    title={label}
    className={cn(
      'inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 rounded-xl border border-app-border bg-white text-[13px] font-medium text-app-ink transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
      'hover:bg-app-soft hover:text-app-accent',
      'min-[1180px]:border-transparent min-[1180px]:px-0 min-[1180px]:text-app-muted',
      tone === 'danger' && 'text-red-700 hover:bg-red-50 hover:text-red-700 min-[1180px]:text-red-700',
      className
    )}
    {...props}
  >
    <Icon className="w-[18px] h-[18px]" />
    <span className="min-[1180px]:sr-only">{label}</span>
  </button>
));
RowAction.displayName = 'RowAction';
