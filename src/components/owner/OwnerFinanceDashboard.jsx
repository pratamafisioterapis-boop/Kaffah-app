import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertCircle, RefreshCw, Wallet, Trash2, Edit2, CreditCard, TrendingDown, TrendingUp, Plus, FileBarChart, ShieldCheck, Briefcase, DollarSign, Calculator, Package, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminExpenses, getAdminIncome, deleteAdminExpense, deleteAdminIncome, getOwnerExpenditures, getOwnerIncome, getOwnerReceivables, getBankAccounts, deleteOwnerExpenditure, deleteOwnerIncome, deleteOwnerReceivable, updateOwnerReceivable } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/searchable-select';
import OwnerFinanceForm from '@/components/owner/OwnerFinanceForm';
import AccountingReport from '@/components/owner/AccountingReport';
import PatientIncome from '@/components/owner/PatientIncome';
import GlobalDateRangeFilter from '@/components/shared/GlobalDateRangeFilter';
import SalaryCalculator from '@/components/owner/SalaryCalculator';
import PackageHistory from '@/components/owner/PackageHistory'; 
import PackageFunds from '@/components/owner/PackageFunds';
import FixedCostManager from '@/components/owner/FixedCostManager';
import AdminExpenseEditModal from '@/components/admin/accounting/AdminExpenseEditModal';
import AdminIncomeEditModal from '@/components/admin/accounting/AdminIncomeEditModal';
import { formatTime } from '@/lib/dateFormatHelpers';
import { useAuth } from '@/contexts/SupabaseAuthContext';

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
const DataTable = ({ columns, data, loading, emptyMessage, onDelete, showDelete = true, onEdit, showEdit = false, accentColor = '#64748b' }) => {
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
    <>
      {/* Mobile / PWA: Card List */}
      <div className="sm:hidden overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {data.map((row, rowIdx) => (
          <div key={row.id || rowIdx} className="px-4 py-3"
            style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              {columns[0] && (
                <span className="text-xs font-semibold text-slate-700">
                  {columns[0].render ? columns[0].render(row) : row[columns[0].accessor]}
                </span>
              )}
              {(showEdit || showDelete) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {showEdit && (
                    <button onClick={() => onEdit && onEdit(row)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {showDelete && (
                    <button onClick={() => onDelete && onDelete(row.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {columns.slice(1).map((col, cIdx) => {
                const val = col.render ? col.render(row) : row[col.accessor];
                if (!val || val === '-') return null;
                return (
                  <span key={cIdx} className="text-[10px] px-2 py-0.5 rounded-md"
                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                    {col.header !== 'Jumlah' ? `${col.header}: ` : ''}{val}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden sm:block overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
              {(showEdit || showDelete) && <th className="px-5 py-3 w-20" style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px' }} />}
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
                {(showEdit || showDelete) && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      {showEdit && (
                        <button onClick={() => onEdit && onEdit(row)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {showDelete && (
                        <button onClick={() => onDelete && onDelete(row.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
};

// --- Mark Receivable As Paid Modal ---
const MarkReceivablePaidModal = ({ receivable, bankAccounts, open, onOpenChange, onSuccess }) => {
  const { toast } = useToast();
  const [bankAccountId, setBankAccountId] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setBankAccountId('');
      setPaidDate(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!bankAccountId) {
      toast({ variant: "destructive", title: "Error", description: "Pilih akun bank tujuan pembayaran." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await updateOwnerReceivable(receivable.id, {
        status: 'paid',
        bank_account_id: bankAccountId,
        paid_date: paidDate
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: "Piutang ditandai lunas." });
      onSuccess();
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">Tandai Lunas &bull; {receivable?.custom_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Tanggal Dibayar</label>
            <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="h-9 text-sm rounded-xl border-slate-200" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Masuk ke Akun Bank</label>
            <SearchableSelect
              options={(bankAccounts || []).map(acc => ({ label: `${acc.bank_name} - ${acc.account_number}`, value: acc.id }))}
              value={bankAccountId}
              onChange={setBankAccountId}
              placeholder="Pilih akun bank..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tandai Lunas'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Main Component ---
const OwnerFinanceDashboard = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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
  const [editingRecord, setEditingRecord] = useState(null);
  const [markPaidReceivable, setMarkPaidReceivable] = useState(null);
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [editingAdminExpense, setEditingAdminExpense] = useState(null);
  const [isAdminExpenseEditOpen, setIsAdminExpenseEditOpen] = useState(false);
  const [editingAdminIncome, setEditingAdminIncome] = useState(null);
  const [isAdminIncomeEditOpen, setIsAdminIncomeEditOpen] = useState(false);

  // Fetch Data Functions
  const fetchOwnerData = async () => {
  setOwnerLoading(true);

  try {
    const [expRes, incRes, recRes, bankRes] = await Promise.all([
      getOwnerExpenditures(dateRange), 
      getOwnerIncome(dateRange), 
      getOwnerReceivables(dateRange),
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
  
  // Owner/Admin Accounting data cuma dipakai di tab "owner" & "admin" (tab
  // lain seperti Accounting Report punya fetch sendiri) — fetch on-demand
  // saat tab-nya aktif supaya nggak nembak 2x query yang sama di background
  // tiap kali dashboard dibuka atau dateRange berubah.
  useEffect(() => {
    if (activeTab === 'owner') fetchOwnerData();
  }, [dateRange, activeTab]);

  useEffect(() => {
    if (activeTab === 'admin') fetchAdminData();
  }, [dateRange, activeTab]);

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
    setEditingRecord(null);
    setIsFormOpen(true);
  };
  const openEditForm = (type, record) => {
    setActiveFormType(type);
    setEditingRecord(record);
    setIsFormOpen(true);
  };
  const openAdminExpenseEdit = (record) => {
    setEditingAdminExpense(record);
    setIsAdminExpenseEditOpen(true);
  };
  const openAdminIncomeEdit = (record) => {
    setEditingAdminIncome(record);
    setIsAdminIncomeEditOpen(true);
  };
  return <div className="w-full space-y-6 font-sans text-slate-900">

      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <Wallet className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">{useAuth().clinicName || ''}</p>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Accounting System</h2>
              <p className="text-sm text-slate-400 mt-0.5">Manage finances, analytics & reporting</p>
            </div>
          </div>
          {!isPWA && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl px-3 py-2">
              <span className="text-amber-300/80 text-[10px] font-bold uppercase tracking-wider shrink-0">Periode</span>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="text-xs bg-transparent border-0 outline-none text-white font-medium w-[110px] [color-scheme:dark]"
              />
              <span className="text-white/30 shrink-0">–</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="text-xs bg-transparent border-0 outline-none text-white font-medium w-[110px] [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => { fetchOwnerData(); fetchAdminData(); }}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors text-slate-300 hover:text-white shrink-0"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          )}
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingRecord(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize text-xl">{editingRecord ? 'Edit' : 'Add New'} {activeFormType}</DialogTitle>
          </DialogHeader>
          <OwnerFinanceForm
             type={activeFormType}
             dateRange={dateRange}
             editRecord={editingRecord}
             onSuccess={() => {
               setIsFormOpen(false);
               setEditingRecord(null);
               fetchOwnerData();
             }}
             onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }}
          />
        </DialogContent>
      </Dialog>

      <MarkReceivablePaidModal
        receivable={markPaidReceivable}
        bankAccounts={ownerData.bankAccounts}
        open={isMarkPaidOpen}
        onOpenChange={setIsMarkPaidOpen}
        onSuccess={() => { setIsMarkPaidOpen(false); fetchOwnerData(); }}
      />

      <AdminExpenseEditModal
        isOpen={isAdminExpenseEditOpen}
        onClose={() => { setIsAdminExpenseEditOpen(false); setEditingAdminExpense(null); }}
        expense={editingAdminExpense}
        onSuccess={fetchAdminData}
      />

      <AdminIncomeEditModal
        isOpen={isAdminIncomeEditOpen}
        onClose={() => { setIsAdminIncomeEditOpen(false); setEditingAdminIncome(null); }}
        income={editingAdminIncome}
        onSuccess={fetchAdminData}
      />

      {/* Custom Tab Navigation */}
      <div className="relative">
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
        {isPWA && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-slate-50 to-transparent" />
        )}
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
            <div className="flex gap-1.5 p-1 w-fit max-w-full rounded-xl overflow-x-auto" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', scrollbarWidth: 'none' }}>
              <SubTabButton isActive={activeOwnerTab === 'expenditures'} onClick={() => setActiveOwnerTab('expenditures')} label="Pengeluaran" icon={TrendingDown} color="rose" />
              <SubTabButton isActive={activeOwnerTab === 'income'} onClick={() => setActiveOwnerTab('income')} label="Pemasukan" icon={TrendingUp} color="emerald" />
              <SubTabButton isActive={activeOwnerTab === 'receivables'} onClick={() => setActiveOwnerTab('receivables')} label="Piutang" icon={CreditCard} color="cyan" />
              <SubTabButton isActive={activeOwnerTab === 'fixed_cost'} onClick={() => setActiveOwnerTab('fixed_cost')} label="Rutin Bulanan" icon={Wallet} color="blue" />
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
                    showEdit onEdit={row => openEditForm('expenditure', row)}
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
                      { header: 'Bank', accessor: 'bank_accounts', render: row => row.bank_accounts?.bank_name
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.bank_accounts.bank_name}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
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
                    showEdit onEdit={row => openEditForm('income', row)}
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
                      { header: 'Bank', accessor: 'bank_accounts', render: row => row.bank_accounts?.bank_name
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.bank_accounts.bank_name}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums" style={{ color: '#059669' }}>{formatCurrency(row.amount)}</span>
                      )},
                    ]} />
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
                      { header: 'Status', accessor: 'status', render: row => {
                        const labels = { pending: 'Belum Lunas', paid: 'Lunas', cancelled: 'Dibatalkan' };
                        const colors = {
                          pending: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                          paid: { bg: '#f0fdf4', color: '#059669', border: '#bbf7d0' },
                          cancelled: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
                        };
                        const c = colors[row.status] || colors.pending;
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                            {labels[row.status] || row.status}
                          </span>
                        );
                      }},
                      { header: 'Jumlah', accessor: 'amount', className: 'text-right', render: row => (
                        <span className="font-bold tabular-nums text-slate-700">{formatCurrency(row.amount)}</span>
                      )},
                      { header: 'Aksi', accessor: 'action', render: row => (
                        row.status === 'pending' ? (
                          <button
                            onClick={() => { setMarkPaidReceivable(row); setIsMarkPaidOpen(true); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-white"
                            style={{ background: '#059669' }}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Tandai Lunas
                          </button>
                        ) : row.bank_account_id ? (
                          <span className="text-[10px] text-slate-400">
                            {ownerData.bankAccounts.find(b => b.id === row.bank_account_id)?.bank_name || '-'}
                          </span>
                        ) : null
                      )},
                    ]} />
                </div>
              )}

              {activeOwnerTab === 'fixed_cost' && (
                <div className="p-5">
                  <FixedCostManager />
                </div>
              )}
            </div>
          </motion.div>}

        {/* --- ADMIN SECTION --- */}
        {activeTab === 'admin' && <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex gap-1.5 p-1 w-fit max-w-full rounded-xl overflow-x-auto" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', scrollbarWidth: 'none' }}>
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
                    showEdit onEdit={openAdminExpenseEdit}
                    columns={[
                      { header: 'Tanggal', accessor: 'transaction_date', render: row => formatDate(row.transaction_date) },
                      { header: 'Kategori', accessor: 'category', render: row => (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>{row.category}</span>
                      )},
                      { header: 'Sub Kategori', accessor: 'sub_category', render: row => (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          {row.sub_category}
                          {row.description?.startsWith('Ambil barang gudang:') && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }} title="Diambil dari Stok Gudang">
                              Stok Gudang
                            </span>
                          )}
                        </span>
                      )},
                      { header: 'Deskripsi', accessor: 'description', className: 'truncate max-w-[200px]' },
                      { header: 'Bank', accessor: 'bank_accounts', render: row => row.bank_accounts?.bank_name
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.bank_accounts.bank_name}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
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
                    showEdit onEdit={openAdminIncomeEdit}
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
                      { header: 'Bank', accessor: 'bank_accounts', render: row => row.bank_accounts?.bank_name
                        ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>{row.bank_accounts.bank_name}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      },
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