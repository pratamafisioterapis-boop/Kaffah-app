import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getOwnerExpenditures, getOwnerIncome, getAdminExpenses, getAdminIncome } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { processPatientIncomeData } from '@/lib/financeUtils';
import { generateExcelReport, generatePDFReport } from '@/lib/exportUtils';
import { useToast } from '@/components/ui/use-toast';

const SummaryCard = ({ title, amount, type, icon: Icon, colorClass }) => (
  <Card className="border-0 shadow-md ring-1 ring-slate-100 overflow-hidden relative">
    <div className={cn("absolute top-0 right-0 p-4 opacity-10", colorClass)}>
       <Icon className="w-24 h-24" />
    </div>
    <CardContent className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("p-2 rounded-lg bg-white shadow-sm border", colorClass.replace('text-', 'text-opacity-100 text-'))}>
          <Icon className={cn("w-5 h-5", colorClass)} />
        </div>
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      <p className={cn("text-2xl md:text-3xl font-bold tracking-tight", colorClass)}>
        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)}
      </p>
    </CardContent>
  </Card>
);

const DetailedTable = ({ title, data, type }) => {
    const total = data.reduce((acc, curr) => acc + curr.amount, 0);
    const isIncome = type === 'income';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {isIncome ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-rose-500" />}
                    {title}
                </h3>
                <span className={cn("text-xl font-bold", isIncome ? "text-emerald-700" : "text-rose-700")}>
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
                </span>
            </div>
            
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 w-[15%]">Date</th>
                                <th className="px-6 py-3 w-[15%]">Source</th>
                                <th className="px-6 py-3 w-[20%]">Category</th>
                                <th className="px-6 py-3 w-[30%]">Description</th>
                                <th className="px-6 py-3 w-[20%] text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        No data available for this period
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, idx) => (
                                    <tr key={`${item.source}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-3 font-mono text-slate-600">
                                            {format(new Date(item.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-xs font-bold border",
                                                item.source === 'Owner' ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                item.source === 'Admin' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                "bg-blue-50 text-blue-700 border-blue-100"
                                            )}>
                                                {item.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-700 font-medium">
                                            {item.category || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500 max-w-[300px] truncate" title={item.description}>
                                            {item.description || '-'}
                                        </td>
                                        <td className={cn("px-6 py-3 text-right font-bold", isIncome ? "text-emerald-600" : "text-rose-600")}>
                                            {new Intl.NumberFormat('id-ID').format(item.amount)}
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

const CombinedFinanceReport = ({ dateRange }) => {
  const [data, setData] = useState({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch raw data from all sources
        const [
            ownerExp, 
            ownerInc, 
            adminExp, 
            adminInc, 
            recapsRes, 
            trackingsRes
        ] = await Promise.all([
            getOwnerExpenditures(),
            getOwnerIncome(),
            getAdminExpenses({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
            getAdminIncome({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
            // FIXED: Explicitly specify the foreign key for the patient relationship to avoid ambiguity
            supabase.from('daily_recaps').select('*, patient:patients!daily_recaps_patient_id_fkey(full_name)').gte('amount', 0).order('recap_date'),
            supabase.from('package_tracking').select('*')
        ]);

        // 2. Filter Helper
        const filterByDate = (item, dateField = 'date') => {
            if (!dateRange?.startDate || !dateRange?.endDate) return true;
            return item[dateField] >= dateRange.startDate && item[dateField] <= dateRange.endDate;
        };

        // 3. Process Patient Income (Special Logic)
        const patientIncome = processPatientIncomeData(recapsRes.data || [], trackingsRes.data || [])
            .filter(item => filterByDate(item, 'date'))
            .map(item => ({
                date: item.date,
                source: 'Patient',
                category: 'Treatment Session',
                description: item.description,
                amount: item.nominal // Use the calculated per-session nominal
            }));

        // 4. Standardize & Filter Owner/Admin Data
        const cleanOwnerExp = (ownerExp.data || []).filter(i => filterByDate(i)).map(i => ({
            date: i.date, source: 'Owner', category: i.category, description: i.description, amount: Number(i.amount)
        }));
        const cleanOwnerInc = (ownerInc.data || []).filter(i => filterByDate(i)).map(i => ({
            date: i.date, source: 'Owner', category: i.category, description: i.description, amount: Number(i.amount)
        }));
        // Admin endpoints already filtered by date if passed, but let's be safe
        const cleanAdminExp = (adminExp.data || []).map(i => ({
            date: i.transaction_date, source: 'Admin', category: i.category, description: i.description, amount: Number(i.amount)
        }));
        const cleanAdminInc = (adminInc.data || []).map(i => ({
            date: i.transaction_date, source: 'Admin', category: i.category, description: i.description, amount: Number(i.amount)
        }));

        // 5. Combine
        const allIncome = [...cleanOwnerInc, ...cleanAdminInc, ...patientIncome].sort((a,b) => new Date(b.date) - new Date(a.date));
        const allExpenses = [...cleanOwnerExp, ...cleanAdminExp].sort((a,b) => new Date(b.date) - new Date(a.date));

        setData({ income: allIncome, expenses: allExpenses });

      } catch (error) {
        console.error("Combined Report Error:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load report data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, toast]);

  const handleExportExcel = async () => {
      setExporting(true);
      try {
          generateExcelReport(data.income, data.expenses, dateRange);
          toast({ title: "Success", description: "Excel report downloaded successfully." });
      } catch (error) {
          console.error(error);
          toast({ variant: "destructive", title: "Error", description: "Failed to generate Excel report." });
      } finally {
          setExporting(false);
      }
  };

  const handleExportPDF = async () => {
      setExporting(true);
      try {
          generatePDFReport(data.income, data.expenses, dateRange);
          toast({ title: "Success", description: "PDF report downloaded successfully." });
      } catch (error) {
          console.error(error);
          toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF report." });
      } finally {
          setExporting(false);
      }
  };

  const totalIncome = data.income.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenses = data.expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-slate-500">Compiling financial data...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-100 pb-6 mb-2">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    Reports
                </h2>
                <p className="text-slate-500 mt-1">Comprehensive financial overview for {format(new Date(dateRange.startDate), 'dd MMM yyyy')} - {format(new Date(dateRange.endDate), 'dd MMM yyyy')}</p>
            </div>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    onClick={handleExportExcel} 
                    disabled={exporting}
                    className="border-green-200 hover:bg-green-50 text-green-700"
                >
                    {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                    Export Excel
                </Button>
                <Button 
                    variant="outline" 
                    onClick={handleExportPDF} 
                    disabled={exporting}
                    className="border-red-200 hover:bg-red-50 text-red-700"
                >
                    {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Export PDF
                </Button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard 
                title="Total Income" 
                amount={totalIncome} 
                icon={TrendingUp} 
                colorClass="text-emerald-600"
            />
            <SummaryCard 
                title="Total Expenses" 
                amount={totalExpenses} 
                icon={TrendingDown} 
                colorClass="text-rose-600"
            />
            <SummaryCard 
                title="Net Profit" 
                amount={netProfit} 
                icon={Wallet} 
                colorClass={netProfit >= 0 ? "text-indigo-600" : "text-amber-600"}
            />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <DetailedTable title="Detailed Income" data={data.income} type="income" />
            <DetailedTable title="Detailed Expenses" data={data.expenses} type="expense" />
        </div>
    </div>
  );
};

export default CombinedFinanceReport;