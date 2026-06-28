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
import PackageFunds from '@/components/owner/PackageFunds';
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
const SubTabButton = ({ isActive, onClick, label, icon: Icon, color }) => {
  const colors = {
    rose:    { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
    emerald: { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0' },
    blue:    { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    cyan:    { bg: '#ecfeff', color: '#0891b2', border: '#a5f3fc' },
  };
  const c = colors[color] || colors.blue;
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
      style={{
        background: isActive ? c.bg : 'white',
        color: isActive ? c.color : '#94a3b8',
        border: `1px solid ${isActive ? c.border : '#e2e8f0'}`,
        boxShadow: isActive ? `0 1px 4px ${c.color}18` : 'none',
      }}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};

// --- Reusable Table Component ---
const DataTable = ({ columns, data, loading, emptyMessage, onDelete, showDelete = true, accentColor = '#64748b' }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Loader2 className="w-6 h-6 animate-spin mb-2" style={{ color: accentColor }} />
        <p className="text-xs text-slate-400 font-medium">Memuat data...</p>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f1f5f9' }}>
          <AlertCircle className="w-5 h-5 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {columns.map((col, idx) => (
                <th key={idx} className={cn("px-5 py-3 whitespace-nowrap", col.className)}
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {col.header}
                </th>
              ))}
              {showDelete && <th className="px-5 py-3 w-14" style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px' }} />}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={row.id || rowIdx}
                className="group transition-colors"
                style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = rowIdx % 2 === 0 ? 'white' : '#fafafa'}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn("px-5 py-3", col.className)} style={{ color: '#475569' }}>
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
                {showDelete && (
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => onDelete && onDelete(row.id)}
                      className="opacity-0 group-hover:opacity-100 transition-all w-7 h-7 rounded-lg flex items-center justify-center ml-auto"
                      style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-6 shadow-xl sticky top-2 z-30">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Kaffah Physiotherapy</p>
              <h1 className="text-white text-xl font-bold leading-tight">Accounting System</h1>
              <p className="text-slate-400 text-xs mt-0.5">Manage finances, analytics & reporting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">Periode</span>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="text-xs bg-transparent border-0 outline-none text-white font-medium w-[110px]"
              />
              <span className="text-slate-500 shrink-0">–</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="text-xs bg-transparent border-0 outline-none text-white font-medium w-[110px]"
              />
            </div>
            <button
              onClick={() => { fetchOwnerData(); fetchAdminData(); }}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors text-slate-400 hover:text-white shrink-0"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
      <div className="flex overflow-x-auto gap-2 pb-1" style={{ scrollbarWidth: 'none' }}>
        {[
          { key: 'accounting_report',   label: 'Accounting Report',  icon: FileBarChart, active: 'bg-emerald-500 text-white shadow-emerald-200/60', inactive: 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600' },
          { key: 'salary_calculator',   label: 'Salary Calculator',  icon: Calculator,   active: 'bg-violet-500 text-white shadow-violet-200/60',  inactive: 'bg-white text-slate-500 border border-slate-200 hover:border-violet-300 hover:text-violet-600' },
          { key: 'owner',               label: 'Owner Accounting',   icon: Briefcase,    active: 'bg-teal-500 text-white shadow-teal-200/60',      inactive: 'bg-white text-slate-500 border border-slate-200 hover:border-teal-300 hover:text-teal-600' },
          { key: 'admin',               label: 'Admin Accounting',   icon: ShieldCheck,  active: 'bg-orange-500 text-white shadow-orange-200/60',  inactive: 'bg-white text-slate-500 border border-slate-200 hover:border-orange-300 hover:text-orange-600' },
          { key: 'package_funds',       label: 'Dana Paket',         icon: Package,      active: 'bg-cyan-500 text-white shadow-cyan-200/60',      inactive: 'bg-white text-slate-500 border border-slate-200 hover:border-cyan-300 hover:text-cyan-600' },
        ].map(({ key, label, icon: Icon, active, inactive }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shadow-sm ${activeTab === key ? active + ' shadow-md' : inactive}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Quick Action Widget */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'linear-gradient(to right, #f0fdfa, #f0fdf4)', border: '1px solid #99f6e4' }}>
        <div className="flex items-center gap-2 mr-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#14b8a6', opacity: 0.85 }}>
            <DollarSign className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-teal-700">Quick Input Owner</span>
        </div>
        <button
          onClick={() => openForm('expenditure')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
          style={{ background: '#e11d48' }}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          + Pengeluaran
        </button>
        <button
          onClick={() => openForm('income')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm"
          style={{ background: '#059669' }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          + Pemasukan
        </button>
        <span className="text-[11px] text-teal-500 hidden sm:inline ml-1">Catat transaksi tanpa berpindah tab</span>
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
                    <AccountingReport
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
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
                    <SalaryCalculator
  dateRange={dateRange}
  setDateRange={setDateRange}
/>
                </div>
             </div>
          </motion.div>}

        

        {/* --- OWNER SECTION --- */}
        {activeTab === 'owner' && <motion.div key="owner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex gap-1.5 p-1 w-fit rounded-xl" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <SubTabButton isActive={activeOwnerTab === 'expenditures'} onClick={() => setActiveOwnerTab('expenditures')} label="Pengeluaran" icon={TrendingDown} color="rose" />
              <SubTabButton isActive={activeOwnerTab === 'income'} onClick={() => setActiveOwnerTab('income')} label="Pemasukan" icon={TrendingUp} color="emerald" />
              <SubTabButton isActive={activeOwnerTab === 'bank'} onClick={() => setActiveOwnerTab('bank')} label="Akun Bank" icon={Building} color="blue" />
              <SubTabButton isActive={activeOwnerTab === 'receivables'} onClick={() => setActiveOwnerTab('receivables')} label="Piutang" icon={CreditCard} color="cyan" />
            </div>

            <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              {activeOwnerTab === 'expenditures' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#fff1f2' }}>
                        <TrendingDown className="w-4 h-4" style={{ color: '#e11d48' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Pengeluaran Owner</h3>
                        <p className="text-xs text-slate-400">{ownerData.expenditures.length} transaksi dalam periode ini</p>
                      </div>
                    </div>
                    <button onClick={() => openForm('expenditure')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#e11d48' }}>
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                  <DataTable accentColor="#e11d48" loading={ownerLoading} emptyMessage="Belum ada pengeluaran."
                    data={ownerData.expenditures}
                    onDelete={id => handleDelete(deleteOwnerExpenditure, id, 'expenditure', fetchOwnerData)}
                    columns={[
                      { header: 'Tanggal', accessor: 'date', render: row => formatDate(row.date) },
                      { header: 'Kategori', accessor: 'category', render: row => (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>{row.category}</span>
                      )},
                      { header: 'Sub Kategori', accessor: 'sub_category', render: row => row.subcategory?.subcategory_name
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.subcategory.subcategory_name}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[180px]' },
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums" style={{ color: '#e11d48' }}>{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
                </div>
              )}

              {activeOwnerTab === 'income' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                        <TrendingUp className="w-4 h-4" style={{ color: '#059669' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Pemasukan Owner</h3>
                        <p className="text-xs text-slate-400">{ownerData.income.length} transaksi dalam periode ini</p>
                      </div>
                    </div>
                    <button onClick={() => openForm('income')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#059669' }}>
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                  <DataTable accentColor="#059669" loading={ownerLoading} emptyMessage="Belum ada pemasukan."
                    data={ownerData.income}
                    onDelete={id => handleDelete(deleteOwnerIncome, id, 'income', fetchOwnerData)}
                    columns={[
                      { header: 'Tanggal', accessor: 'date', render: row => formatDate(row.date) },
                      { header: 'Kategori', accessor: 'category', render: row => (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>{row.category}</span>
                      )},
                      { header: 'Sub Kategori', accessor: 'sub_category', render: row => row.sub_category
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.sub_category}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[180px]' },
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums" style={{ color: '#059669' }}>{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
                </div>
              )}

              {activeOwnerTab === 'bank' && (
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                      <Building className="w-4 h-4" style={{ color: '#2563eb' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Akun Bank</h3>
                      <p className="text-xs text-slate-400">Kelola rekening bank owner</p>
                    </div>
                  </div>
                  <OwnerBankAccountManager />
                </div>
              )}

              {activeOwnerTab === 'receivables' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#ecfeff' }}>
                        <CreditCard className="w-4 h-4" style={{ color: '#0891b2' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Piutang</h3>
                        <p className="text-xs text-slate-400">{ownerData.receivables.length} data piutang</p>
                      </div>
                    </div>
                    <button onClick={() => openForm('receivable')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#0891b2' }}>
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  </div>
                  <DataTable accentColor="#0891b2" loading={ownerLoading} emptyMessage="Belum ada piutang."
                    data={ownerData.receivables}
                    onDelete={id => handleDelete(deleteOwnerReceivable, id, 'receivable', fetchOwnerData)}
                    columns={[
                      { header: 'Tanggal', accessor: 'date', render: row => formatDate(row.date) },
                      { header: 'Nama', accessor: 'custom_name', render: row => (
                        <span className="font-semibold text-slate-700">{row.custom_name}</span>
                      )},
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[180px]' },
                      { header: 'Status', accessor: 'status', render: row => (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{
                          background: row.status === 'Paid' ? '#f0fdf4' : '#fffbeb',
                          color: row.status === 'Paid' ? '#059669' : '#d97706',
                          border: `1px solid ${row.status === 'Paid' ? '#bbf7d0' : '#fde68a'}`
                        }}>{row.status}</span>
                      )},
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums text-slate-700">{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
                </div>
              )}
            </div>
          </motion.div>}

        {/* --- ADMIN SECTION --- */}
        {activeTab === 'admin' && <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex gap-1.5 p-1 w-fit rounded-xl" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <SubTabButton isActive={activeAdminTab === 'expenses'} onClick={() => setActiveAdminTab('expenses')} label="Pengeluaran Admin" icon={TrendingDown} color="rose" />
              <SubTabButton isActive={activeAdminTab === 'income'} onClick={() => setActiveAdminTab('income')} label="Pemasukan Admin" icon={TrendingUp} color="emerald" />
            </div>

            <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              {activeAdminTab === 'expenses' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#fff1f2' }}>
                      <TrendingDown className="w-4 h-4" style={{ color: '#e11d48' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Pengeluaran Admin</h3>
                      <p className="text-xs text-slate-400">{adminData.expenses.length} transaksi dalam periode ini</p>
                    </div>
                  </div>
                  <DataTable accentColor="#e11d48" loading={adminLoading} emptyMessage="Belum ada pengeluaran admin."
                    data={adminData.expenses}
                    onDelete={id => handleDelete(deleteAdminExpense, id, 'admin expense', fetchAdminData)}
                    columns={[
                      { header: 'Tanggal', accessor: 'transaction_date', render: row => formatDate(row.transaction_date) },
                      { header: 'Kategori', accessor: 'category', render: row => (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>{row.category}</span>
                      )},
                      { header: 'Sub Kategori', accessor: 'sub_category', className: 'text-slate-500' },
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[200px]' },
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums" style={{ color: '#e11d48' }}>{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
                </div>
              )}

              {activeAdminTab === 'income' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                      <TrendingUp className="w-4 h-4" style={{ color: '#059669' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Pemasukan Admin</h3>
                      <p className="text-xs text-slate-400">{adminData.income.length} transaksi dalam periode ini</p>
                    </div>
                  </div>
                  <DataTable accentColor="#059669" loading={adminLoading} emptyMessage="Belum ada pemasukan admin."
                    data={adminData.income}
                    onDelete={id => handleDelete(deleteAdminIncome, id, 'admin income', fetchAdminData)}
                    columns={[
                      { header: 'Tanggal', accessor: 'transaction_date', render: row => formatDate(row.transaction_date || row.date) },
                      { header: 'Sub Kategori', accessor: 'sub_category', className: 'text-slate-500' },
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[160px]' },
                      { header: 'Metode Pembayaran', accessor: 'source', render: row => {
                        const val = row.source || row.category;
                        return val
                          ? <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>{val}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>;
                      }},
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums" style={{ color: '#059669' }}>{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
                </div>
              )}
            </div>
          </motion.div>}

        
          {/* --- PACKAGE FUNDS SECTION --- */}
{activeTab === 'package_funds' && (
  <motion.div
    key="package_funds"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
  >
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-1 border border-cyan-100 shadow-lg">
      <div className="bg-white/90 backdrop-blur rounded-xl p-6">
        <PackageFunds />
      </div>
    </div>
  </motion.div>
)}
      </AnimatePresence>
    </div>;
};
export default OwnerFinanceDashboard;