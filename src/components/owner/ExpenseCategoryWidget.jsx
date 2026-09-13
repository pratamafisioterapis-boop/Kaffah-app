import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers, Loader2, ChevronDown, Receipt, Info } from 'lucide-react';
import { getOwnerExpenditures, getAdminExpenses } from '@/lib/api';
import { cn } from '@/lib/utils';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const formatShort = (value) => {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(0)} Rb`;
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
};

const CATEGORY_COLORS = ['#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#6366f1', '#ec4899', '#f97316', '#14b8a6', '#a855f7'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[#0b1f4b] mb-1">{item?.name}</p>
      <p className="text-slate-500">
        {formatCurrency(item?.value)} <span className="text-slate-400">({item?.pct}%)</span>
      </p>
    </div>
  );
};

const ExpenseCategoryWidget = ({ dateRange }) => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ownerExp, adminExp] = await Promise.all([
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
      ]);

      const combined = [
        ...(ownerExp?.data || []).map(e => ({
          category: e.category || 'Lainnya',
          subcategory: e.subcategory?.subcategory_name || 'Tanpa Sub-kategori',
          amount: Number(e.amount) || 0,
        })),
        ...(adminExp?.data || []).map(e => ({
          category: e.category || 'Lainnya',
          subcategory: e.subcategory?.subcategory_name || 'Tanpa Sub-kategori',
          amount: Number(e.amount) || 0,
        })),
      ];

      setRows(combined);
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
      .map(([name, { total: catTotal, subs }], i) => ({
        name,
        value: catTotal,
        pct: totalAmount > 0 ? Math.round((catTotal / totalAmount) * 100) : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        subcategories: Object.entries(subs)
          .map(([subName, subAmount]) => ({
            name: subName,
            amount: subAmount,
            pct: catTotal > 0 ? Math.round((subAmount / catTotal) * 100) : 0,
          }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.value - a.value);

    return { categories: list, total: totalAmount };
  }, [rows]);

  return (
    <div className="relative rounded-[28px] overflow-hidden bg-white shadow-lg shadow-slate-200/70">
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-rose-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-4 md:p-6 space-y-4 md:space-y-5">
        <div className={cn('flex gap-3', isPWA ? 'flex-col' : 'items-start justify-between')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-rose-100 to-orange-50 shrink-0">
              <Layers className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[#0b1f4b] font-bold text-base tracking-tight">Pengeluaran per Kategori</h3>
              <p className="text-slate-400 text-xs mt-0.5">Rincian biaya berdasarkan kategori &amp; sub-kategori</p>
            </div>
          </div>
          {categories.length > 0 && (
            <span className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-rose-50 border border-rose-100 text-rose-600">
              {categories.length} kategori
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <Info className="w-5 h-5 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Belum ada data pengeluaran pada periode ini.</p>
          </div>
        ) : (
          <>
            <div className={cn('grid gap-5', isPWA ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-5 md:items-center')}>
              <div className={cn('relative', isPWA ? 'h-48' : 'md:col-span-2 h-52')}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="90%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categories.map((c, i) => (
                        <Cell key={i} fill={c.color} className="cursor-pointer" opacity={expandedCategory && expandedCategory !== c.name ? 0.4 : 1} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Total</p>
                  <p className="text-lg font-black text-[#0b1f4b] tabular-nums">{formatShort(total)}</p>
                </div>
              </div>

              <div className="md:col-span-3 space-y-2">
                {categories.map((cat) => {
                  const isOpen = expandedCategory === cat.name;
                  return (
                    <div
                      key={cat.name}
                      className={cn(
                        'rounded-xl border transition-colors',
                        isOpen ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedCategory(isOpen ? null : cat.name)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#0b1f4b] truncate">{cat.name}</span>
                            <span className="text-sm font-black text-[#0b1f4b] tabular-nums shrink-0">{formatShort(cat.value)}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${cat.pct}%` }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 w-9 text-right shrink-0">{cat.pct}%</span>
                        <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 pl-8 space-y-2 border-t border-slate-200 pt-2.5">
                              {cat.subcategories.map((sub) => (
                                <div key={sub.name} className="flex items-center gap-2">
                                  <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="text-xs text-slate-500 truncate flex-1">{sub.name}</span>
                                  <span className="text-xs font-semibold text-[#0b1f4b] tabular-nums shrink-0">{formatCurrency(sub.amount)}</span>
                                  <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">{sub.pct}%</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseCategoryWidget;
