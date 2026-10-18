import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Wallet, TrendingDown, TrendingUp, CreditCard, FileBarChart, ShieldCheck, Briefcase, Calculator, Package, CheckCircle2, Trash2, Repeat } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminExpenses, getAdminIncome, deleteAdminExpense, deleteAdminIncome, getOwnerExpenditures, getOwnerIncome, getOwnerReceivables, getBankAccounts, deleteOwnerExpenditure, deleteOwnerIncome, deleteOwnerReceivable, updateOwnerReceivable, autoPostFixedCosts } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/searchable-select';
import OwnerFinanceForm from '@/components/owner/OwnerFinanceForm';
import AccountingReport from '@/components/owner/AccountingReport';
import SalaryCalculator from '@/components/owner/SalaryCalculator';
import PackageFunds from '@/components/owner/PackageFunds';
import FixedCostManager from '@/components/owner/FixedCostManager';
import AdminExpenseEditModal from '@/components/admin/accounting/AdminExpenseEditModal';
import AdminIncomeEditModal from '@/components/admin/accounting/AdminIncomeEditModal';
import PageHero from '@/components/shared/PageHero';
import { confirmAction } from '@/lib/confirmAction';
import FinanceTile, { TileEmpty } from '@/components/owner/finance/FinanceTile';
import SegControl from '@/components/owner/finance/SegControl';
import TxSection from '@/components/owner/finance/TxSection';
import { Pill } from '@/components/owner/finance/TxList';
import { fmtRp } from '@/components/owner/finance/financeTheme';

// Tab utama halaman Accounting. Warna aktif mengikuti tone tiap tab.
const MAIN_TABS = [
  { key: 'accounting_report', label: 'Laporan', icon: FileBarChart, active: 'bg-teal-600 border-teal-600 text-white' },
  { key: 'salary_calculator', label: 'Gaji', icon: Calculator, active: 'bg-violet-600 border-violet-600 text-white' },
  { key: 'owner', label: 'Owner', icon: Briefcase, active: 'bg-emerald-600 border-emerald-600 text-white' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, active: 'bg-amber-600 border-amber-600 text-white' },
  { key: 'package_funds', label: 'Dana Paket', icon: Package, active: 'bg-blue-600 border-blue-600 text-white' },
];

const OWNER_SUBTABS = [
  { value: 'expenditures', label: 'Pengeluaran', icon: TrendingDown },
  { value: 'income', label: 'Pemasukan', icon: TrendingUp },
  { value: 'receivables', label: 'Piutang', icon: CreditCard },
  { value: 'fixed_cost', label: 'Rutin', icon: Repeat },
];

const ADMIN_SUBTABS = [
  { value: 'expenses', label: 'Pengeluaran Admin', icon: TrendingDown },
  { value: 'income', label: 'Pemasukan Admin', icon: TrendingUp },
];

const RECEIVABLE_LABELS = { pending: 'Belum Lunas', paid: 'Lunas', cancelled: 'Dibatalkan' };
const RECEIVABLE_TONES = { pending: 'warn', paid: 'pos', cancelled: undefined };

// Normalisasi baris API ke bentuk yang dipakai TxList.
const mapOwnerExpense = (r) => ({ id: r.id, date: r.date, cat: r.category, sub: r.subcategory?.subcategory_name, desc: r.description, bank: r.bank_accounts?.bank_name, amt: Number(r.amount) || 0, raw: r });
const mapOwnerIncome = (r) => ({ id: r.id, date: r.date, cat: r.category, sub: r.sub_category, desc: r.description, bank: r.bank_accounts?.bank_name, amt: Number(r.amount) || 0, raw: r });
const mapAdminExpense = (r) => ({
  id: r.id, date: r.transaction_date, cat: r.category, sub: r.sub_category,
  badge: r.description?.startsWith('Ambil barang gudang:') ? 'Stok Gudang' : null,
  desc: r.description, bank: r.bank_accounts?.bank_name, amt: Number(r.amount) || 0, raw: r,
});
const mapAdminIncome = (r) => ({ id: r.id, date: r.transaction_date || r.date, cat: r.source || r.category, sub: r.sub_category, desc: r.description, bank: r.bank_accounts?.bank_name, amt: Number(r.amount) || 0, raw: r });

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
      <DialogContent className="sm:max-w-[420px] rounded-app-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">Tandai Lunas &bull; {receivable?.custom_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Tanggal Dibayar</label>
            <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="h-9 text-sm rounded-app border-slate-200" />
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
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-app">Batal</Button>
            <Button onClick={handleSubmit} disabled={loading} className="rounded-app bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tandai Lunas'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


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
    await autoPostFixedCosts();
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
    if (!await confirmAction(`Are you sure you want to delete this ${type}?`)) return;
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
  const receivableDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '-');

  return (
    <div className="w-full space-y-5 font-sans text-slate-900">

      {/* Hero Banner */}
      <PageHero image="/hero/clinara-accounting-hero.webp" title="Accounting" highlight="System" description="Kelola keuangan, analitik & laporan klinik." />

      {!isPWA && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2 bg-white border border-slate-100 shadow-sm rounded-[14px] px-3 py-2">
            <span className="text-app-accent text-xs font-bold uppercase tracking-wider shrink-0">Periode</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-app-ink font-medium w-[110px]"
            />
            <span className="text-slate-300 shrink-0">–</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-app-ink font-medium w-[110px]"
            />
            <button
              onClick={() => { fetchOwnerData(); fetchAdminData(); }}
              className="w-9 h-9 rounded-[10px] bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500 hover:text-app-accent shrink-0"
              title="Refresh"
              aria-label="Muat ulang"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingRecord(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-app-lg">
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

      {/* Tab utama */}
      <div className="relative">
        <div className="flex overflow-x-auto gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MAIN_TABS.map(({ key, label, icon: Icon, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              aria-pressed={activeTab === key}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] border text-[13px] font-semibold whitespace-nowrap transition-[background-color,color,border-color] duration-200',
                activeTab === key ? active : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        {isPWA && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-slate-50 to-transparent" />
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* --- LAPORAN --- */}
        {activeTab === 'accounting_report' && (
          <motion.div key="accounting_report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AccountingReport dateRange={dateRange} onDateRangeChange={setDateRange} />
          </motion.div>
        )}

        {/* --- GAJI --- */}
        {activeTab === 'salary_calculator' && (
          <motion.div key="salary_calculator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <SalaryCalculator dateRange={dateRange} setDateRange={setDateRange} />
          </motion.div>
        )}

        {/* --- OWNER --- */}
        {activeTab === 'owner' && (
          <motion.div key="owner" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <SegControl items={OWNER_SUBTABS} value={activeOwnerTab} onChange={setActiveOwnerTab} />

            {activeOwnerTab === 'expenditures' && (
              <TxSection
                tone="neg" icon={TrendingDown} title="Pengeluaran Owner" kind="out"
                items={ownerData.expenditures.map(mapOwnerExpense)} loading={ownerLoading}
                emptyText="Belum ada pengeluaran."
                onAdd={() => openForm('expenditure')}
                onEdit={(item) => openEditForm('expenditure', item.raw)}
                onDelete={(item) => handleDelete(deleteOwnerExpenditure, item.id, 'expenditure', fetchOwnerData)}
              />
            )}

            {activeOwnerTab === 'income' && (
              <TxSection
                tone="pos" icon={TrendingUp} title="Pemasukan Owner" kind="in"
                items={ownerData.income.map(mapOwnerIncome)} loading={ownerLoading}
                emptyText="Belum ada pemasukan."
                onAdd={() => openForm('income')}
                onEdit={(item) => openEditForm('income', item.raw)}
                onDelete={(item) => handleDelete(deleteOwnerIncome, item.id, 'income', fetchOwnerData)}
              />
            )}

            {activeOwnerTab === 'receivables' && (
              <FinanceTile
                tone="sky" icon={CreditCard}
                title={
                  <span className="inline-flex items-center gap-2">
                    Piutang
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{ownerData.receivables.length}</span>
                  </span>
                }
                action={
                  <div className="flex items-center gap-3">
                    <b className="text-base font-black tabular-nums text-blue-600">
                      {fmtRp(ownerData.receivables.filter(r => r.status === 'pending').reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                    </b>
                    <button
                      type="button"
                      onClick={() => openForm('receivable')}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[12.5px] font-semibold text-white bg-teal-600 active:scale-[0.96] transition-transform"
                    >
                      + Tambah
                    </button>
                  </div>
                }
              >
                {ownerLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : ownerData.receivables.length === 0 ? (
                  <TileEmpty>Belum ada piutang.</TileEmpty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ownerData.receivables.map((row) => (
                      <div key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-3">
                        <div className="flex-1 min-w-[160px]">
                          <p className="text-sm font-semibold text-slate-800 break-words">{row.custom_name}</p>
                          <p className="text-xs text-slate-500 break-words">{receivableDate(row.date)}{row.description ? ` · ${row.description}` : ''}</p>
                        </div>
                        <span className="font-bold tabular-nums text-blue-600">{fmtRp(row.amount)}</span>
                        <Pill tone={RECEIVABLE_TONES[row.status]}>{RECEIVABLE_LABELS[row.status] || row.status}</Pill>
                        {row.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => { setMarkPaidReceivable(row); setIsMarkPaidOpen(true); }}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[12.5px] font-semibold text-white bg-emerald-600 active:scale-[0.96] transition-transform"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
                          </button>
                        ) : row.bank_account_id ? (
                          <Pill>{ownerData.bankAccounts.find(b => b.id === row.bank_account_id)?.bank_name || '-'}</Pill>
                        ) : null}
                        <button
                          type="button"
                          aria-label="Hapus"
                          onClick={() => handleDelete(deleteOwnerReceivable, row.id, 'receivable', fetchOwnerData)}
                          className="w-8 h-8 rounded-[10px] bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FinanceTile>
            )}

            {activeOwnerTab === 'fixed_cost' && <FixedCostManager />}
          </motion.div>
        )}

        {/* --- ADMIN --- */}
        {activeTab === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <SegControl items={ADMIN_SUBTABS} value={activeAdminTab} onChange={setActiveAdminTab} />

            {activeAdminTab === 'expenses' && (
              <TxSection
                tone="neg" icon={TrendingDown} title="Pengeluaran Admin" kind="out"
                items={adminData.expenses.map(mapAdminExpense)} loading={adminLoading}
                emptyText="Belum ada pengeluaran admin."
                onEdit={(item) => openAdminExpenseEdit(item.raw)}
                onDelete={(item) => handleDelete(deleteAdminExpense, item.id, 'admin expense', fetchAdminData)}
              />
            )}

            {activeAdminTab === 'income' && (
              <TxSection
                tone="pos" icon={TrendingUp} title="Pemasukan Admin" kind="in"
                items={adminData.income.map(mapAdminIncome)} loading={adminLoading}
                emptyText="Belum ada pemasukan admin."
                onEdit={(item) => openAdminIncomeEdit(item.raw)}
                onDelete={(item) => handleDelete(deleteAdminIncome, item.id, 'admin income', fetchAdminData)}
              />
            )}
          </motion.div>
        )}

        {/* --- DANA PAKET --- */}
        {activeTab === 'package_funds' && (
          <motion.div key="package_funds" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <PackageFunds />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default OwnerFinanceDashboard;
