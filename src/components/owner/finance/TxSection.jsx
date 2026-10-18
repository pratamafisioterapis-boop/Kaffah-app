import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile from '@/components/owner/finance/FinanceTile';
import TxList from '@/components/owner/finance/TxList';
import { fmtRp } from '@/components/owner/finance/financeTheme';

const SUBTOTAL_COLOR = { in: 'text-emerald-600', out: 'text-rose-600', neutral: 'text-slate-700' };
const ADD_COLOR = { in: 'bg-emerald-600', out: 'bg-rose-600', neutral: 'bg-teal-600' };

// Kotak berisi daftar transaksi + jumlah entri, subtotal, dan tombol Tambah.
const TxSection = ({ tone, icon, title, items = [], kind = 'neutral', loading, onAdd, onEdit, onDelete, emptyText, className }) => {
  const subtotal = items.reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return (
    <FinanceTile
      tone={tone}
      icon={icon}
      className={className}
      title={
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{items.length}</span>
        </span>
      }
      action={
        <div className="flex items-center gap-3">
          <b className={cn('text-base font-black tabular-nums', SUBTOTAL_COLOR[kind])}>{fmtRp(subtotal)}</b>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[12.5px] font-semibold text-white active:scale-[0.96] transition-transform', ADD_COLOR[kind])}
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          )}
        </div>
      }
    >
      <TxList items={items} kind={kind} loading={loading} onEdit={onEdit} onDelete={onDelete} emptyText={emptyText} />
    </FinanceTile>
  );
};

export default TxSection;
