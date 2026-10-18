import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  getOwnerIncome, getAdminIncome, getPatientIncomeFromPackages,
  getOwnerExpenditures, getAdminExpenses,
} from '@/lib/api';

// Revenue, pengeluaran, profit & margin per bulan (default 12 bulan terakhir).
// Bulan berjalan ditimpa angka getBepFinancials() (`bepFinancials`) supaya sama
// dengan widget Break Even Point & ringkasan kesehatan finance (fixed cost +
// pengeluaran s/d hari ini + transport & insentif terapis).
const useMonthlyFinance = (bepFinancials, months = 12, reloadKey = 0) => {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState({ income: [], expense: [] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const startDate = format(startOfMonth(subMonths(today, months - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd');
    try {
      const [ownerInc, adminInc, patientInc, ownerExp, adminExp] = await Promise.all([
        getOwnerIncome({ startDate, endDate }),
        getAdminIncome({ startDate, endDate }),
        getPatientIncomeFromPackages({ startDate, endDate }),
        getOwnerExpenditures({ startDate, endDate }),
        getAdminExpenses({ startDate, endDate }),
      ]);
      setRaw({
        income: [
          ...(ownerInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
          ...(adminInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
          ...(patientInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
        ],
        expense: [
          ...(ownerExp?.data || []).map(e => ({ date: e.date, amount: Number(e.amount) || 0 })),
          ...(adminExp?.data || []).map(e => ({ date: e.transaction_date || e.date, amount: Number(e.amount) || 0 })),
        ],
      });
    } catch (err) {
      console.error('useMonthlyFinance error:', err);
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(); }, [fetchData, reloadKey]);

  const monthly = useMemo(() => {
    const today = new Date();
    const buckets = {};
    eachMonthOfInterval({ start: startOfMonth(subMonths(today, months - 1)), end: startOfMonth(today) }).forEach(m => {
      const key = format(m, 'yyyy-MM');
      buckets[key] = {
        monthKey: key,
        monthLabel: format(m, 'MMM yyyy', { locale: idLocale }),
        shortLabel: format(m, 'MMM', { locale: idLocale }),
        revenue: 0,
        expense: 0,
      };
    });
    raw.income.forEach(i => {
      const b = i.date && buckets[String(i.date).slice(0, 7)];
      if (b) b.revenue += i.amount;
    });
    raw.expense.forEach(e => {
      const b = e.date && buckets[String(e.date).slice(0, 7)];
      if (b) b.expense += e.amount;
    });
    const current = buckets[format(today, 'yyyy-MM')];
    if (bepFinancials && current) {
      current.revenue = bepFinancials.revenueThisMonth || 0;
      current.expense = bepFinancials.totalCost || 0;
    }
    return Object.values(buckets).map(b => {
      const profit = b.revenue - b.expense;
      const margin = b.revenue > 0 ? (profit / b.revenue) * 100 : 0;
      return { ...b, profit, margin: Math.round(margin * 10) / 10 };
    });
  }, [raw, months, bepFinancials]);

  return { monthly, loading };
};

export default useMonthlyFinance;
