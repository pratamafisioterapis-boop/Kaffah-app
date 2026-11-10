import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile from '@/components/owner/finance/FinanceTile';
import TxList from '@/components/owner/finance/TxList';
import { fmtRp } from '@/components/owner/finance/financeTheme';

const SUBTOTAL_COLOR = { in: 'text-emerald-600', out: 'text-rose-600', neutral: 'text-slate-700' };
const ADD_COLOR = { in: 'bg-emerald-600', out: 'bg-rose-600', neutral: 'bg-teal-600' };
const ACTIVE_CHIP = { in: 'bg-emerald-600 text-white', out: 'bg-rose-600 text-white', neutral: 'bg-teal-600 text-white' };

// Kotak berisi daftar transaksi + jumlah entri, subtotal, filter metode pembayaran, dan tombol Tambah.
const TxSection = ({ tone, icon, title, items = [], kind = 'neutral', loading, onAdd, onEdit, onDelete, emptyText, className }) => {
  const [method, setMethod] = useState('all');

  // Daftar metode pembayaran (bank/akun) yang ada di data saat ini.
  const methods = useMemo(() => {
    const set = new Set();
    items.forEach((i) => { if (i.bank) set.add(i.bank); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Jika metode terpilih sudah tidak ada di data (mis. ganti periode), kembali ke "Semua".
  const activeMethod = method !== 'all' && !methods.includes(method) ? 'all' : method;

  const filtered = useMemo(
    () => (activeMethod === 'all' ? items : items.filter((i) => i.bank === activeMethod)),
    [items, activeMethod]
  );

  const subtotal = filtered.reduce((s, i) => s + (Number(i.amt) || 0), 0);
  const showFilter = methods.length > 1;

  return (
    <FinanceTile
      tone={tone}
      icon={icon}
      className={className}
      title={
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{filtered.length}</span>
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
      {showFilter && (
        <div className="flex flex-wrap items-center gap-1.5 pb-3" role="group" aria-label="Filter metode pembayaran">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mr-1">Metode</span>
          {['all', ...methods].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={activeMethod === m}
              onClick={() => setMethod(m)}
              className={cn(
                'h-7 px-3 rounded-full text-[12px] font-semibold transition-colors',
                activeMethod === m ? ACTIVE_CHIP[kind] : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {m === 'all' ? 'Semua' : m}
            </button>
          ))}
        </div>
      )}
      <TxList items={filtered} kind={kind} loading={loading} onEdit={onEdit} onDelete={onDelete} emptyText={emptyText} />
    </FinanceTile>
  );
};

export default TxSection;
