import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart as PieIcon, ChevronDown } from 'lucide-react';
import { getOwnerExpenditures, getAdminExpenses } from '@/lib/api';
import { cn } from '@/lib/utils';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { Donut } from '@/components/owner/finance/charts';
import { CHART_COLORS, fmtShort, fmtRp } from '@/components/owner/finance/financeTheme';

const ExpenseCategoryWidget = ({ dateRange, className }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ownerExp, adminExp] = await Promise.all([
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
      ]);
      const toRow = (e) => ({
        category: e.category || 'Lainnya',
        subcategory: e.subcategory?.subcategory_name || 'Tanpa Sub-kategori',
        amount: Number(e.amount) || 0,
      });
      setRows([...(ownerExp?.data || []).map(toRow), ...(adminExp?.data || []).map(toRow)]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { categories, total } = useMemo(() => {
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = { total: 0, subs: {} };
      grouped[r.category].total += r.amount;
      grouped[r.category].subs[r.subcategory] = (grouped[r.category].subs[r.subcategory] || 0) + r.amount;
    });
    const totalAmount = Object.values(grouped).reduce((s, c) => s + c.total, 0);
    const list = Object.entries(grouped)
      .map(([name, { total: catTotal, subs }]) => ({
        key: name,
        name,
        value: catTotal,
        pct: totalAmount > 0 ? Math.round((catTotal / totalAmount) * 100) : 0,
        subcategories: Object.entries(subs)
          .map(([subName, amount]) => ({ name: subName, amount, pct: catTotal > 0 ? Math.round((amount / catTotal) * 100) : 0 }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.value - a.value)
      .map((c, i) => ({ ...c, color: CHART_COLORS[i % CHART_COLORS.length] }));
    return { categories: list, total: totalAmount };
  }, [rows]);

  const current = categories.find(c => c.key === selected);

  return (
    <FinanceTile tone="warn" icon={PieIcon} title="Pengeluaran per Kategori" className={className}>
      {loading ? (
        <TileLoading />
      ) : categories.length === 0 ? (
        <TileEmpty>Belum ada pengeluaran pada periode ini.</TileEmpty>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <Donut items={categories} selected={selected} onSelect={setSelected} className="w-[150px] shrink-0 mx-auto sm:mx-0">
            <b className="text-xl font-black tabular-nums leading-tight text-app-ink">{fmtShort(current ? current.value : total)}</b>
            <small className="text-xs text-slate-500 max-w-[90px] truncate">{current ? current.name : 'Total'}</small>
          </Donut>

          <div className="flex-1 min-w-[200px] grid gap-0.5">
            {categories.map(cat => {
              const open = selected === cat.key;
              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(open ? null : cat.key)}
                    aria-expanded={open}
                    className={cn('w-full grid grid-cols-[10px_1fr_auto_auto_16px] items-center gap-2 px-2 py-2 rounded-xl text-left transition-colors', open ? 'bg-slate-100' : 'hover:bg-slate-50')}
                  >
                    <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium text-app-ink break-words min-w-0">{cat.name}</span>
                    <span className="text-sm font-bold tabular-nums">{fmtShort(cat.value)}</span>
                    <span className="text-xs text-slate-500 w-9 text-right tabular-nums">{cat.pct}%</span>
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.77, 0, 0.175, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pl-7 pr-2 pb-2 pt-1 grid gap-1.5">
                          {cat.subcategories.map(sub => (
                            <div key={sub.name} className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="flex-1 min-w-0 break-words">{sub.name}</span>
                              <b className="text-app-ink font-semibold tabular-nums">{fmtRp(sub.amount)}</b>
                              <span className="w-8 text-right tabular-nums">{sub.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </FinanceTile>
  );
};

export default ExpenseCategoryWidget;
