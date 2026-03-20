import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOwnerExpenditures, getOwnerIncome, getAdminExpenses, getAdminIncome, getDailyRecaps } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';

const FinanceReportSection = ({ dateRange }) => {
  const [data, setData] = useState({ all: [], income: [], expenses: [] });
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [ownerExp, ownerInc, adminExp, adminInc, dailyRecaps] = await Promise.all([
         getOwnerExpenditures(), 
         getOwnerIncome(),
         getAdminExpenses({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
         getAdminIncome({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
         getDailyRecaps({ startDate: dateRange.startDate, endDate: dateRange.endDate })
      ]);

      const formatItem = (item, type, source) => ({
        id: item.id,
        date: item.date || item.transaction_date || item.recap_date,
        input_time: item.input_time || item.created_at, 
        category: item.category || (item.service_type ? `Patient Income (${item.service_type})` : 'General'),
        description: item.description || (item.patient ? `${item.patient.full_name} - ${item.diagnosis || ''}` : ''),
        amount: Number(item.amount),
        type, 
        source 
      });

      const filterDate = (item) => {
         const d = item.date || item.transaction_date;
         if (!dateRange.startDate || !dateRange.endDate) return true;
         return d >= dateRange.startDate && d <= dateRange.endDate;
      };

      const combinedExpenses = [
        ...(ownerExp.data || []).filter(filterDate).map(i => formatItem(i, 'expense', 'Owner')),
        ...(adminExp.data || []).map(i => formatItem(i, 'expense', 'Admin'))
      ].sort((a,b) => new Date(b.date) - new Date(a.date));

      const combinedIncome = [
        ...(ownerInc.data || []).filter(filterDate).map(i => formatItem(i, 'income', 'Owner')),
        ...(adminInc.data || []).map(i => formatItem(i, 'income', 'Admin')),
        ...(dailyRecaps.data || []).map(i => formatItem(i, 'income', 'Patient'))
      ].sort((a,b) => new Date(b.date) - new Date(a.date));

      const combinedAll = [...combinedIncome, ...combinedExpenses].sort((a,b) => new Date(b.date) - new Date(a.date));

      setData({ all: combinedAll, income: combinedIncome, expenses: combinedExpenses });

    } catch (error) {
      console.error("Report fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    if (timeStr.includes('T')) return format(new Date(timeStr), 'HH:mm');
    return timeStr.substring(0, 5);
  };

  const ReportTable = ({ items, type }) => {
    const total = items.reduce((acc, curr) => acc + curr.amount, 0);

    return (
      <div className="space-y-6">
         <div className={cn(
           "p-6 rounded-2xl flex justify-between items-center shadow-sm border",
           type === 'income' ? "bg-emerald-50 border-emerald-100" : 
           type === 'expense' ? "bg-rose-50 border-rose-100" : "bg-indigo-50 border-indigo-100"
         )}>
            <div className="flex items-center gap-3">
               <div className={cn(
                 "p-2 rounded-lg",
                 type === 'income' ? "bg-emerald-100 text-emerald-600" : 
                 type === 'expense' ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"
               )}>
                  {type === 'income' ? <TrendingUp className="w-6 h-6" /> : type === 'expense' ? <TrendingDown className="w-6 h-6" /> : <PieChart className="w-6 h-6" />}
               </div>
               <span className="font-semibold text-slate-700 text-lg">Total {type === 'all' ? 'Transactions' : type === 'income' ? 'Income' : 'Expenses'}</span>
            </div>
            <span className={cn(
              "text-3xl font-bold",
              type === 'income' ? "text-emerald-700" : type === 'expense' ? "text-rose-700" : "text-indigo-700"
            )}>
               {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total)}
            </span>
         </div>
         
         <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
           <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-500">Date</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 w-[100px]">Time</th>
                  <th className="px-6 py-4 font-semibold text-slate-500">Source</th>
                  <th className="px-6 py-4 font-semibold text-slate-500">Category</th>
                  <th className="px-6 py-4 font-semibold text-slate-500">Description</th>
                  <th className="px-6 py-4 font-semibold text-slate-500 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-medium">No transactions found for this period</td></tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">{format(new Date(item.date), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">{formatTime(item.input_time)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold border",
                          item.source === 'Owner' ? "bg-purple-50 text-purple-700 border-purple-100" : 
                          item.source === 'Admin' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          "bg-emerald-50 text-emerald-700 border-emerald-100"
                        )}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{item.category}</td>
                      <td className="px-6 py-4 text-slate-500 max-w-[300px] truncate" title={item.description}>{item.description || '-'}</td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold tabular-nums",
                        item.type === 'income' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {item.type === 'expense' ? '-' : '+'} {new Intl.NumberFormat('id-ID').format(item.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
           </div>
         </div>
      </div>
    );
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-4 md:p-8">
        <Tabs defaultValue="income" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/50 border border-white/40 p-1 h-12 rounded-xl backdrop-blur-sm shadow-sm">
            <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 font-medium transition-all">Pemasukan (Income)</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-rose-100 data-[state=active]:text-rose-800 font-medium transition-all">Pengeluaran (Expenses)</TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-800 font-medium transition-all">All Transactions</TabsTrigger>
          </TabsList>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <TabsContent value="income">
              <ReportTable items={data.income} type="income" />
            </TabsContent>
            <TabsContent value="expenses">
              <ReportTable items={data.expenses} type="expense" />
            </TabsContent>
            <TabsContent value="all">
              <ReportTable items={data.all} type="all" />
            </TabsContent>
          </motion.div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FinanceReportSection;