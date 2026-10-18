import React from 'react';
import { format, parseISO } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, toneFor, fmtRp } from '@/components/owner/finance/financeTheme';
import { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';

const fmtDate = (d) => {
  if (!d) return '-';
  try { return format(typeof d === 'string' ? parseISO(d) : new Date(d), 'dd/MM/yyyy'); } catch { return '-'; }
};

export const Pill = ({ tone, children, className }) => {
  const t = tone ? TONES[tone] : null;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap', t ? `${t.soft} ${t.text}` : 'bg-slate-100 text-slate-500', className)}>
      {children}
    </span>
  );
};

const AMOUNT_COLOR = { in: 'text-emerald-600', out: 'text-rose-600', neutral: 'text-slate-700' };

// Daftar transaksi gaya bento: baris di desktop, kartu ringkas di HP.
// items: [{ id, date, cat, sub, badge, desc, bank, amt }]. onEdit/onDelete opsional.
const TxList = ({ items, kind = 'neutral', onEdit, onDelete, loading, emptyText = 'Belum ada data' }) => {
  if (loading) return <TileLoading />;
  if (!items || items.length === 0) return <TileEmpty>{emptyText}</TileEmpty>;
  const hasActions = !!(onEdit || onDelete);
  const amountCls = cn('font-bold tabular-nums whitespace-nowrap', AMOUNT_COLOR[kind]);

  const Actions = ({ item }) => hasActions && (
    <span className="inline-flex items-center gap-1 justify-end">
      {onEdit && (
        <button type="button" aria-label="Ubah" onClick={() => onEdit(item)} className="w-8 h-8 rounded-[10px] bg-slate-100 text-slate-500 hover:text-app-ink flex items-center justify-center transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}
      {onDelete && (
        <button type="button" aria-label="Hapus" onClick={() => onDelete(item)} className="w-8 h-8 rounded-[10px] bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );

  return (
    // Tinggi dibatasi; isi di-scroll di dalam kartu.
    <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto overscroll-contain pr-1">
      {items.map((item, idx) => (
        <div key={item.id ?? idx}>
          {/* Desktop */}
          <div className={cn(
            'hidden sm:grid items-center gap-3 px-1.5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors',
            hasActions ? 'grid-cols-[84px_minmax(120px,1.1fr)_minmax(0,1.6fr)_84px_120px_72px]' : 'grid-cols-[84px_minmax(120px,1.1fr)_minmax(0,1.6fr)_84px_120px]'
          )}>
            <span className="text-xs text-slate-500 tabular-nums">{fmtDate(item.date)}</span>
            <span className="grid gap-0.5 min-w-0 justify-items-start">
              {item.cat ? <Pill tone={toneFor(item.cat)}>{item.cat}</Pill> : null}
              {item.sub ? <small className="text-[11.5px] text-slate-500 break-words">{item.sub}</small> : null}
            </span>
            <span className="min-w-0 break-words text-sm text-slate-700">
              {item.desc || '-'}
              {item.badge && <Pill tone="sky" className="ml-2">{item.badge}</Pill>}
            </span>
            <span>{item.bank ? <Pill>{item.bank}</Pill> : null}</span>
            <span className={cn('text-right text-sm', amountCls)}>{fmtRp(item.amt)}</span>
            {hasActions && <Actions item={item} />}
          </div>

          {/* Mobile / PWA */}
          {/* Ringkas: 2 baris (judul + nominal, lalu kategori/tanggal/bank) */}
          <div className="sm:hidden grid gap-1 px-1 py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-[13px] leading-snug font-semibold text-slate-800">{item.desc || '-'}</span>
              <span className={cn('text-[13px] leading-snug shrink-0', amountCls)}>{fmtRp(item.amt)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-x-1.5 min-w-0 text-[11px] text-slate-500">
                {item.cat ? <Pill tone={toneFor(item.cat)} className="shrink-0 px-1.5 py-0 text-[10.5px]">{item.cat}</Pill> : null}
                {item.sub ? <span className="truncate min-w-0">{item.sub}</span> : null}
                {item.badge ? <Pill tone="sky" className="shrink-0 px-1.5 py-0 text-[10.5px]">{item.badge}</Pill> : null}
                <span className="shrink-0 whitespace-nowrap tabular-nums">{item.sub || item.cat || item.badge ? '· ' : ''}{fmtDate(item.date)}{item.bank ? ` · ${item.bank}` : ''}</span>
              </div>
              {hasActions && <Actions item={item} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TxList;
