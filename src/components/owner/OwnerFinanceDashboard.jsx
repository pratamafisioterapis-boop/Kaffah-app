import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle, RefreshCw, Wallet, Trash2, Building, CreditCard, TrendingDown, TrendingUp, Plus, FileBarChart, ShieldCheck, Briefcase, DollarSign, Calculator, Package } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminExpenses, getAdminIncome, deleteAdminExpense, deleteAdminIncome, getOwnerExpenditures, getOwnerIncome, getOwnerReceivables, getBankAccounts, deleteOwnerExpenditure, deleteOwnerIncome, deleteOwnerReceivable } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import OwnerFinanceForm from '@/components/owner/OwnerFinanceForm';
import OwnerBankAccountManager from '@/components/owner/OwnerBankAccountManager';
import AccountingReport from '@/components/owner/AccountingReport';
import PatientIncome from '@/components/owner/PatientIncome';
import GlobalDateRangeFilter from '@/components/shared/GlobalDateRangeFilter';
import SalaryCalculator from '@/components/owner/SalaryCalculator';
import PackageHistory from '@/components/owner/PackageHistory'; 
import { formatTime } from '@/lib/dateFormatHelpers';

// --- Animated Tab Components ---
const TabButton = ({
  isActive,
  onClick,
  label,
  icon: Icon,
  themeColor,
  activeClass,
  inactiveClass
}) => <button onClick={onClick} className={cn("relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-200", isActive ? activeClass : inactiveClass)}>
    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-current" : "text-slate-400")} />
    <span>{label}</span>
    {isActive && <motion.div layoutId="activeTabIndicator" className={cn("absolute bottom-0 left-2 right-2 h-1 rounded-t-full", themeColor)} transition={{
    type: "spring",
    stiffness: 300,
    damping: 30
  }} />}
  </button>;
const SubTabButton = ({
  isActive,
  onClick,
  label,
  icon: Icon,
  activeClass,
  inactiveClass
}) => <motion.button whileHover={{
  scale: 1.02
}} whileTap={{
  scale: 0.98
}} onClick={onClick} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm border", isActive ? `${activeClass} shadow-md ring-1 ring-opacity-50` : `${inactiveClass} hover:bg-slate-50 border-slate-200 text-slate-500`)}>
    <Icon className="w-4 h-4" />
    {label}
  </motion.button>;

// --- Reusable Table Component ---
const DataTable = ({
  columns,
  data,
  loading,
  emptyMessage,
  onDelete,
  showDelete = true
}) => {
  if (loading) {
    return <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>;
  }
  if (!data || data.length === 0) {
    return <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <div className="p-4 bg-white rounded-full shadow-sm mb-3">
          <AlertCircle className="w-6 h-6 text-slate-300" />
        </div>
        <p className="font-medium">{emptyMessage}</p>
      </div>;
  }
  return <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => <th key={idx} className={cn("px-6 py-4 font-semibold tracking-wider", col.className)}>
                  {col.header}
                </th>)}
              {showDelete && <th className="px-6 py-4 text-right w-[80px]">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row, rowIdx) => <tr key={row.id || rowIdx} className="hover:bg-slate-50/80 transition-colors group">
                {columns.map((col, colIdx) => <td key={colIdx} className={cn("px-6 py-4", col.className)}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>)}
                {showDelete && <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all" onClick={() => onDelete && onDelete(row.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>}
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
};

// --- Main Component ---
const OwnerFinanceDashboard = () => {
  const {
    toast
  } = useToast();

  // Navigation State
  const [activeTab, setActiveTab] = useState('accounting_report'); // Default to detailed report
  const [activeOwnerTab, setActiveOwnerTab] = useState('expenditures');
  const [activeAdminTab, setActiveAdminTab] = useState('expenses');

  // Shared Date Range State (Top Level)
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // State for Data
  const [ownerData, setOwnerData] = useState({
    expenditures: [],
    income: [],
    receivables: [],
    bankAccounts: []
  });
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [adminData, setAdminData] = useState({
    expenses: [],
    income: []
  });
  const [adminLoading, setAdminLoading] = useState(false);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormType, setActiveFormType] = useState('expenditure');

  // Fetch Data Functions
  const fetchOwnerData = async () => {
  setOwnerLoading(true);

  try {
    const [expRes, incRes, recRes, bankRes] = await Promise.all([
      getOwnerExpenditures(dateRange), 
      getOwnerIncome(dateRange), 
      getOwnerReceivables(), 
      getBankAccounts()
    ]);

    console.log("DEBUG OWNER:", {
      expRes,
      incRes,
      recRes,
      bankRes
    });

    // 🚨 HANDLE ERROR DULU
    if (expRes?.error || incRes?.error || recRes?.error || bankRes?.error) {
      throw expRes?.error || incRes?.error || recRes?.error || bankRes?.error;
    }

    setOwnerData({
      expenditures: expRes?.data || [],
      income: incRes?.data || [],
      receivables: recRes?.data || [],
      bankAccounts: bankRes?.data || []
    });

  } catch (error) {
    console.error("FINAL ERROR:", error);

    toast({
      variant: "destructive",
      title: "Error",
      description: error.message || "Failed to load owner data."
    });

  } finally {
    setOwnerLoading(false);
  }
};

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const [expRes, incRes] = await Promise.all([getAdminExpenses({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }), getAdminIncome({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })]);
      
      setAdminData({
        expenses: expRes?.data || [],
        income: incRes?.data || []
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load admin data."
      });
    } finally {
      setAdminLoading(false);
    }
  };
  
  // Re-fetch when dateRange changes
  useEffect(() => {
    fetchOwnerData();
    fetchAdminData();
  }, [dateRange]);

  // Handlers
  const handleDelete = async (deleteFn, id, type, refreshFn) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const {
        error
      } = await deleteFn(id);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${type} deleted successfully.`
      });
      refreshFn();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete ${type}.`
      });
    }
  };
  const formatCurrency = amount => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount || 0);
  const formatDate = dateStr => dateStr ? format(new Date(dateStr), 'dd/MM/yyyy') : '-';
  const openForm = type => {
    setActiveFormType(type);
    setIsFormOpen(true);
  };
  return <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 p-4 md:p-8 space-y-8 font-sans text-slate-900">

      {/* Header Section */}
      <Card className="card-premium border-none shadow-xl bg-white/80 backdrop-blur-lg sticky top-2 z-30">
        <CardContent className="p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">Accounting System</h1>
              <p className="text-slate-500 font-medium mt-1">Manage finances, analytics & reporting</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
            <GlobalDateRangeFilter 
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            />

            <Button onClick={() => {
            fetchOwnerData();
            fetchAdminData();
          }} className="h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm hover:shadow transition-all">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize text-xl">Add New {activeFormType}</DialogTitle>
          </DialogHeader>
          <OwnerFinanceForm 
             type={activeFormType} 
             dateRange={dateRange} 
             onSuccess={() => {
               setIsFormOpen(false);
               fetchOwnerData();
             }} 
             onCancel={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Custom Tab Navigation */}
      <div className="flex flex-wrap gap-2 md:gap-4 p-2 bg-white/60 backdrop-blur rounded-2xl border border-white/40 shadow-sm">
        <TabButton isActive={activeTab === 'accounting_report'} onClick={() => setActiveTab('accounting_report')} label="Accounting Report" icon={FileBarChart} themeColor="bg-emerald-500" activeClass="bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200" inactiveClass="hover:bg-slate-100 text-slate-500 hover:text-slate-700" />
        <TabButton isActive={activeTab === 'salary_calculator'} onClick={() => setActiveTab('salary_calculator')} label="Salary Calculator" icon={Calculator} themeColor="bg-violet-500" activeClass="bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200" inactiveClass="hover:bg-slate-100 text-slate-500 hover:text-slate-700" />
        <TabButton isActive={activeTab === 'owner'} onClick={() => setActiveTab('owner')} label="Owner Accounting" icon={Briefcase} themeColor="bg-teal-500" activeClass="bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200" inactiveClass="hover:bg-slate-100 text-slate-500 hover:text-slate-700" />
        <TabButton isActive={activeTab === 'admin'} onClick={() => setActiveTab('admin')} label="Admin Accounting" icon={ShieldCheck} themeColor="bg-orange-500" activeClass="bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200" inactiveClass="hover:bg-slate-100 text-slate-500 hover:text-slate-700" />
        <TabButton isActive={activeTab === 'patient_income_calc'} onClick={() => setActiveTab('patient_income_calc')} label="Income Calculator" icon={Calculator} themeColor="bg-blue-500" activeClass="bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200" inactiveClass="hover:bg-slate-100 text-slate-500 hover:text-slate-700" />
      </div>

      <AnimatePresence mode="wait">
        
        {/* --- ACCOUNTING REPORT SECTION --- */}
        {activeTab === 'accounting_report' && <motion.div key="accounting_report" initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -10
      }}>
             <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-1 border border-emerald-100 shadow-lg">
                <div className="bg-white/95 backdrop-blur rounded-xl p-6">
                    <AccountingReport dateRange={dateRange} />
                </div>
             </div>
          </motion.div>}

        {/* --- SALARY CALCULATOR SECTION --- */}
        {activeTab === 'salary_calculator' && <motion.div key="salary_calculator" initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -10
      }}>
             <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-1 border border-violet-100 shadow-lg">
                <div className="bg-white/95 backdrop-blur rounded-xl p-6">
                    <SalaryCalculator />
                </div>
             </div>
          </motion.div>}

        

        {/* --- OWNER SECTION --- */}
        {activeTab === 'owner' && <motion.div key="owner" initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -10
      }} className="space-y-6">
            <div className="flex flex-wrap gap-3 pb-2">
               <SubTabButton isActive={activeOwnerTab === 'expenditures'} onClick={() => setActiveOwnerTab('expenditures')} label="Pengeluaran" icon={TrendingDown} activeClass="bg-rose-100 text-rose-700 border-rose-300" inactiveClass="" />
               <SubTabButton isActive={activeOwnerTab === 'income'} onClick={() => setActiveOwnerTab('income')} label="Pemasukan" icon={TrendingUp} activeClass="bg-emerald-100 text-emerald-700 border-emerald-300" inactiveClass="" />
               <SubTabButton isActive={activeOwnerTab === 'bank'} onClick={() => setActiveOwnerTab('bank')} label="Akun Bank" icon={Building} activeClass="bg-blue-100 text-blue-700 border-blue-300" inactiveClass="" />
               <SubTabButton isActive={activeOwnerTab === 'receivables'} onClick={() => setActiveOwnerTab('receivables')} label="Piutang" icon={CreditCard} activeClass="bg-cyan-100 text-cyan-700 border-cyan-300" inactiveClass="" />
            </div>

            <Card className="card-premium bg-gradient-owner border-none">
              <CardContent className="p-6 md:p-8">
                {activeOwnerTab === 'expenditures' && <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-teal-900">Owner Expenditures</h2>
                        <p className="text-teal-700/70">Manage your personal and operational expenses.</p>
                      </div>
                      <Button onClick={() => openForm('expenditure')} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-200">
                        <Plus className="w-4 h-4 mr-2" /> Record Expense
                      </Button>
                    </div>
                    <DataTable loading={ownerLoading} emptyMessage="No expenditures found." data={ownerData.expenditures} onDelete={id => handleDelete(deleteOwnerExpenditure, id, 'expenditure', fetchOwnerData)} columns={[{
                header: 'Date',
                accessor: 'date',
                render: row => formatDate(row.date)
              },  {
                header: 'Category',
                accessor: 'category',
                render: row => <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-rose-100 text-rose-700">{row.category}</span>
              }, {
  header: 'Sub Category',
  accessor: 'sub_category',
  render: row =>
    row.sub_category ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-teal-200 text-teal-700">
        {row.subcategory?.subcategory_name || '-'}
      </span>
    ) : (
      <span className="text-slate-400">-</span>
    )
}, {
                header: 'Description',
                accessor: 'description',
                className: 'text-slate-600'
              }, {
                header: 'Amount',
                accessor: 'amount',
                className: 'text-right font-bold text-rose-600',
                render: row => formatCurrency(row.amount)
              }]} />
                  </div>}
                {activeOwnerTab === 'income' && <div className="space-y-6">
                     <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-teal-900">Owner Income</h2>
                        <p className="text-teal-700/70">Track your incoming revenue sources.</p>
                      </div>
                      <Button onClick={() => openForm('income')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200">
                        <Plus className="w-4 h-4 mr-2" /> Record Income
                      </Button>
                    </div>
                    <DataTable loading={ownerLoading} emptyMessage="No income records found." data={ownerData.income} onDelete={id => handleDelete(deleteOwnerIncome, id, 'income', fetchOwnerData)} columns={[{
                header: 'Date',
                accessor: 'date',
                render: row => formatDate(row.date)
              },  {
                header: 'Category',
                accessor: 'category',
                render: row => <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-100 text-emerald-700">{row.category}</span>
              }, {
  header: 'Sub Category',
  accessor: 'sub_category',
  render: row =>
    row.sub_category ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-emerald-200 text-emerald-700">
        {row.sub_category}
      </span>
    ) : (
      <span className="text-slate-400">-</span>
    )
}, {
                header: 'Description',
                accessor: 'description'
              }, {
                header: 'Amount',
                accessor: 'amount',
                className: 'text-right font-bold text-emerald-600',
                render: row => formatCurrency(row.amount)
              }]} />
                  </div>}
                {activeOwnerTab === 'bank' && <OwnerBankAccountManager />}
                {activeOwnerTab === 'receivables' && <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-teal-900">Receivables (Piutang)</h2>
                        <p className="text-teal-700/70">Monitor outstanding payments.</p>
                      </div>
                      <Button onClick={() => openForm('receivable')} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-lg shadow-cyan-200">
                        <Plus className="w-4 h-4 mr-2" /> Add Receivable
                      </Button>
                    </div>
                    <DataTable loading={ownerLoading} emptyMessage="No receivables found." data={ownerData.receivables} onDelete={id => handleDelete(deleteOwnerReceivable, id, 'receivable', fetchOwnerData)} columns={[{
                header: 'Date',
                accessor: 'date',
                render: row => formatDate(row.date)
              }, {
                header: 'Name',
                accessor: 'custom_name',
                className: 'font-semibold text-slate-800'
              }, {
                header: 'Description',
                accessor: 'description'
              }, {
                header: 'Status',
                accessor: 'status',
                render: row => <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border", row.status === 'Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                            {row.status}
                          </span>
              }, {
                header: 'Amount',
                accessor: 'amount',
                className: 'text-right font-bold text-slate-700',
                render: row => formatCurrency(row.amount)
              }]} />
                  </div>}
              </CardContent>
            </Card>
          </motion.div>}

        {/* --- ADMIN SECTION --- */}
        {activeTab === 'admin' && <motion.div key="admin" initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -10
      }} className="space-y-6">
             <div className="flex gap-3 pb-2">
               <SubTabButton isActive={activeAdminTab === 'expenses'} onClick={() => setActiveAdminTab('expenses')} label="Pengeluaran Admin" icon={TrendingDown} activeClass="bg-red-100 text-red-700 border-red-300" inactiveClass="" />
               <SubTabButton isActive={activeAdminTab === 'income'} onClick={() => setActiveAdminTab('income')} label="Pemasukan Admin" icon={TrendingUp} activeClass="bg-orange-100 text-orange-700 border-orange-300" inactiveClass="" />
            </div>

            <Card className="card-premium bg-gradient-admin border-none">
              <CardContent className="p-6 md:p-8">
                {activeAdminTab === 'expenses' && <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-amber-900">Admin Expenses</h2>
                      <p className="text-amber-700/70">Operational costs recorded by clinic staff.</p>
                    </div>
                    <DataTable loading={adminLoading} emptyMessage="No admin expenses found." data={adminData.expenses} onDelete={id => handleDelete(deleteAdminExpense, id, 'admin expense', fetchAdminData)} columns={[{
                header: 'Date',
                accessor: 'transaction_date',
                render: row => formatDate(row.transaction_date)
              }, {
                header: 'Time',
                accessor: 'input_time',
                render: row => formatTime(row.input_time)
              }, {
                header: 'Category',
                accessor: 'category',
                render: row => <span className="bg-white/80 px-2 py-1 rounded-md text-xs font-semibold border border-amber-200 text-amber-800">{row.category}</span>
              }, {
                header: 'Sub Category',
                accessor: 'sub_category'
              }, {
                header: 'Description',
                accessor: 'description',
                className: 'max-w-[200px] truncate'
              }, {
                header: 'Amount',
                accessor: 'amount',
                className: 'text-right font-bold text-red-600',
                render: row => formatCurrency(row.amount)
              }]} />
                  </div>}
                {activeAdminTab === 'income' && <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-amber-900">Admin Income</h2>
                      <p className="text-amber-700/70">Additional revenue recorded by clinic staff.</p>
                    </div>
                    <DataTable loading={adminLoading} emptyMessage="No admin income found." data={adminData.income} onDelete={id => handleDelete(deleteAdminIncome, id, 'admin income', fetchAdminData)} columns={[{
                header: 'Date',
                accessor: 'transaction_date',
                render: row => formatDate(row.transaction_date)
              }, {
                header: 'Time',
                accessor: 'input_time',
                render: row => formatTime(row.input_time)
              }, {
                header: 'Source',
                accessor: 'source',
                render: row => <span className="bg-white/80 px-2 py-1 rounded-md text-xs font-semibold border border-orange-200 text-orange-800">{row.source}</span>
              }, {
                header: 'Sub Category',
                accessor: 'sub_category'
              }, {
                header: 'Description',
                accessor: 'description'
              }, {
                header: 'Amount',
                accessor: 'amount',
                className: 'text-right font-bold text-green-600',
                render: row => formatCurrency(row.amount)
              }]} />
                  </div>}
              </CardContent>
            </Card>
          </motion.div>}

        {/* --- PATIENT INCOME CALCULATION SECTION --- */}
        {activeTab === 'patient_income_calc' && <motion.div key="patient_income" initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -10
      }}>
             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-1 border border-blue-100 shadow-lg">
                <div className="bg-white/80 backdrop-blur rounded-xl p-6">
                    <PatientIncome dateRange={dateRange} />
                </div>
             </div>
          </motion.div>}
      </AnimatePresence>
    </div>;
};
export default OwnerFinanceDashboard;