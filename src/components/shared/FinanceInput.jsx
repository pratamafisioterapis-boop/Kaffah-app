import React, { useState, useEffect } from 'react';
import { 
  Plus, DollarSign, CreditCard, TrendingDown, TrendingUp, 
  Calendar, Loader2, Trash2, Edit2, AlertCircle, FileText,
  Check, ChevronsUpDown, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { 
  getExpenses, createExpense, 
  getAdditionalIncome, createAdditionalIncome, 
  getBankAccounts, createBankAccount, deleteBankAccount,
  getReceivables, createReceivable, updateReceivable,
  getPatients,
  getAccountingCategories,
  getAccountingSubcategories
} from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const FinanceInput = ({ role }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data States
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [patients, setPatients] = useState([]);
  
  // Category States
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  // Loaders
  const [loading, setLoading] = useState(true);

  // Form Dialogs
  const [activeTab, setActiveTab] = useState("expenses");
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [isReceivableOpen, setIsReceivableOpen] = useState(false);

  // Searchable Dropdown State
  const [openSubCat, setOpenSubCat] = useState(false);
  const [searchSubCat, setSearchSubCat] = useState("");

  // Form Data
  const [expenseForm, setExpenseForm] = useState({
    main_category: '', sub_category: '', amount: '', transaction_date: format(new Date(), 'yyyy-MM-dd'), 
    description: '', bank_account_id: ''
  });
  const [incomeForm, setIncomeForm] = useState({
    source: '', amount: '', transaction_date: format(new Date(), 'yyyy-MM-dd'), 
    description: '', bank_account_id: ''
  });
  const [bankForm, setBankForm] = useState({
    bank_name: '', account_number: '', holder_name: '', balance: '0', account_type: 'checking'
  });
  const [receivableForm, setReceivableForm] = useState({
    patient_id: '', total_amount: '', outstanding_amount: '', paid_amount: '0', 
    due_date: '', status: 'Unpaid'
  });

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [activeTab]);

  const fetchCategories = async () => {
    const [catRes, subRes] = await Promise.all([
      getAccountingCategories(),
      getAccountingSubcategories()
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (subRes.data) setSubcategories(subRes.data);
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always fetch banks for dropdowns
      const banksRes = await getBankAccounts();
      if (banksRes.data) setBankAccounts(banksRes.data);

      if (activeTab === 'expenses') {
        const res = await getExpenses();
        if (res.data) setExpenses(res.data);
      } else if (activeTab === 'income') {
        const res = await getAdditionalIncome();
        if (res.data) setIncomes(res.data);
      } else if (activeTab === 'banks') {
        // already fetched
      } else if (activeTab === 'receivables') {
        const [recRes, patRes] = await Promise.all([getReceivables(), getPatients()]);
        if (recRes.data) setReceivables(recRes.data);
        if (patRes.data) setPatients(patRes.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---

  const handleSelectSubCategory = (sub) => {
    const parentCat = categories.find(c => c.id === sub.category_id);
    const mainCatName = parentCat ? parentCat.category_name : '';
    
    setExpenseForm({
        ...expenseForm,
        sub_category: sub.subcategory_name,
        main_category: mainCatName
    });
    setOpenSubCat(false);
    setSearchSubCat("");
  };

  // Filter subcategories based on search
  const filteredSubCategories = subcategories.filter(sub => 
    sub.subcategory_name.toLowerCase().includes(searchSubCat.toLowerCase())
  );

  const handleCreateExpense = async () => {
    if (!expenseForm.amount || !expenseForm.main_category || !expenseForm.transaction_date || !expenseForm.sub_category) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Mohon lengkapi semua data termasuk kategori." });
      return;
    }

    // Fix: Handle empty string for UUID fields
    const payload = { ...expenseForm, created_by: user.id };
    if (payload.bank_account_id === '') payload.bank_account_id = null;

    const { error } = await createExpense(payload);
    if (!error) {
      toast({ title: "Pengeluaran Dicatat" });
      setIsExpenseOpen(false);
      setExpenseForm({ main_category: '', sub_category: '', amount: '', transaction_date: format(new Date(), 'yyyy-MM-dd'), description: '', bank_account_id: '' });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleCreateIncome = async () => {
    if (!incomeForm.amount || !incomeForm.source || !incomeForm.transaction_date) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Mohon lengkapi data wajib." });
      return;
    }

    // Fix: Handle empty string for UUID fields
    const payload = { ...incomeForm, created_by: user.id };
    if (payload.bank_account_id === '') payload.bank_account_id = null;

    const { error } = await createAdditionalIncome(payload);
    if (!error) {
      toast({ title: "Pemasukan Dicatat" });
      setIsIncomeOpen(false);
      setIncomeForm({ source: '', amount: '', transaction_date: format(new Date(), 'yyyy-MM-dd'), description: '', bank_account_id: '' });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleCreateBank = async () => {
    if (!bankForm.bank_name) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama Bank wajib diisi." });
      return;
    }
    const { error } = await createBankAccount(bankForm);
    if (!error) {
      toast({ title: "Akun Bank Ditambahkan" });
      setIsBankOpen(false);
      setBankForm({ bank_name: '', account_number: '', holder_name: '', balance: '0', account_type: 'checking' });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleDeleteBank = async (id) => {
    if(!window.confirm("Hapus akun bank ini?")) return;
    const { error } = await deleteBankAccount(id);
    if (!error) {
      toast({ title: "Terhapus" });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleCreateReceivable = async () => {
    if (!receivableForm.patient_id || !receivableForm.total_amount) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Pasien dan Jumlah wajib diisi." });
      return;
    }
    // Auto calc outstanding
    const outstanding = parseFloat(receivableForm.total_amount) - parseFloat(receivableForm.paid_amount || 0);
    
    const { error } = await createReceivable({ 
      ...receivableForm, 
      outstanding_amount: outstanding
    });

    if (!error) {
      toast({ title: "Piutang Dicatat" });
      setIsReceivableOpen(false);
      setReceivableForm({ patient_id: '', total_amount: '', outstanding_amount: '', paid_amount: '0', due_date: '', status: 'Unpaid' });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  const handleUpdateReceivableStatus = async (id, status) => {
    const { error } = await updateReceivable(id, { status });
    if (!error) {
      toast({ title: "Status Diperbarui" });
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Input Keuangan & Operasional</h2>
          <p className="text-slate-500">Kelola arus kas, pengeluaran, dan data keuangan lainnya.</p>
        </div>
      </div>

      <Tabs defaultValue="expenses" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px] h-auto p-1 bg-slate-100">
          <TabsTrigger value="expenses" className="data-[state=active]:bg-white py-2">Pengeluaran</TabsTrigger>
          <TabsTrigger value="income" className="data-[state=active]:bg-white py-2">Pemasukan Lain</TabsTrigger>
          {role === 'owner' && (
            <>
              <TabsTrigger value="banks" className="data-[state=active]:bg-white py-2">Data Bank</TabsTrigger>
              <TabsTrigger value="receivables" className="data-[state=active]:bg-white py-2">Piutang</TabsTrigger>
            </>
          )}
        </TabsList>

        <div className="mt-6">
          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsExpenseOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
                <TrendingDown className="w-4 h-4 mr-2" /> Catat Pengeluaran
              </Button>
            </div>
            
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">Belum ada data.</div>
              ) : (
                expenses.map(ex => (
                  <div key={ex.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(ex.transaction_date), 'dd/MM/yyyy')}</span>
                      <span className="font-medium text-red-600 shrink-0 whitespace-nowrap">Rp {parseFloat(ex.amount).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ex.main_category}</p>
                      <p className="text-xs text-slate-500 truncate">{ex.sub_category}</p>
                    </div>
                    {ex.description && <p className="text-sm text-slate-600 truncate">{ex.description}</p>}
                    <p className="text-xs text-slate-400">{ex.bank_account?.bank_name || 'Cash'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Sumber Dana</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada data.</TableCell></TableRow>
                  ) : (
                    expenses.map(ex => (
                      <TableRow key={ex.id}>
                        <TableCell>{format(new Date(ex.transaction_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <div className="font-medium">{ex.main_category}</div>
                          <div className="text-xs text-slate-500">{ex.sub_category}</div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{ex.description || '-'}</TableCell>
                        <TableCell>{ex.bank_account?.bank_name || 'Cash'}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          Rp {parseFloat(ex.amount).toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* INCOME TAB */}
          <TabsContent value="income" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsIncomeOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                <TrendingUp className="w-4 h-4 mr-2" /> Catat Pemasukan
              </Button>
            </div>
            
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {incomes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">Belum ada data.</div>
              ) : (
                incomes.map(inc => (
                  <div key={inc.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(inc.transaction_date), 'dd/MM/yyyy')}</span>
                      <span className="font-medium text-green-600 shrink-0 whitespace-nowrap">Rp {parseFloat(inc.amount).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="font-medium truncate">{inc.source}</p>
                    {inc.description && <p className="text-sm text-slate-600 truncate">{inc.description}</p>}
                    <p className="text-xs text-slate-400">{inc.bank_account?.bank_name || 'Cash'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Masuk Ke</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {incomes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada data.</TableCell></TableRow>
                  ) : (
                    incomes.map(inc => (
                      <TableRow key={inc.id}>
                        <TableCell>{format(new Date(inc.transaction_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{inc.source}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{inc.description || '-'}</TableCell>
                        <TableCell>{inc.bank_account?.bank_name || 'Cash'}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          Rp {parseFloat(inc.amount).toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* BANKS TAB (Owner Only) */}
          {role === 'owner' && (
            <TabsContent value="banks" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setIsBankOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <CreditCard className="w-4 h-4 mr-2" /> Tambah Akun Bank
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map(bank => (
                  <div key={bank.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteBank(bank.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{bank.bank_name}</h3>
                        <p className="text-xs text-slate-500 uppercase">{bank.account_type}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">{bank.account_number}</p>
                      <p className="text-xs text-slate-400">{bank.holder_name}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">Saldo Saat Ini</p>
                      <p className="text-xl font-bold text-slate-800">Rp {parseFloat(bank.balance).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}

          {/* RECEIVABLES TAB (Owner Only) */}
          {role === 'owner' && (
            <TabsContent value="receivables" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setIsReceivableOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
                  <FileText className="w-4 h-4 mr-2" /> Catat Piutang
                </Button>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {receivables.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200">Tidak ada data piutang.</div>
                ) : (
                  receivables.map(rec => (
                    <div key={rec.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{rec.patient?.full_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{rec.patient?.rm_number}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                          rec.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          rec.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {rec.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="text-slate-500">Total: Rp {parseFloat(rec.total_amount).toLocaleString('id-ID')}</span>
                        <span className="font-bold text-red-600 whitespace-nowrap">Sisa: Rp {parseFloat(rec.outstanding_amount).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Jatuh tempo: {rec.due_date ? format(new Date(rec.due_date), 'dd/MM/yyyy') : '-'}</span>
                        {rec.status !== 'Paid' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateReceivableStatus(rec.id, 'Paid')}>
                            Tandai Lunas
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>Total Tagihan</TableHead>
                      <TableHead>Sisa Tagihan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data piutang.</TableCell></TableRow>
                    ) : (
                      receivables.map(rec => (
                        <TableRow key={rec.id}>
                          <TableCell>{rec.due_date ? format(new Date(rec.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>
                            <div className="font-medium">{rec.patient?.full_name}</div>
                            <div className="text-xs text-slate-500">{rec.patient?.rm_number}</div>
                          </TableCell>
                          <TableCell>Rp {parseFloat(rec.total_amount).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="font-bold text-red-600">Rp {parseFloat(rec.outstanding_amount).toLocaleString('id-ID')}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              rec.status === 'Paid' ? 'bg-green-100 text-green-700' :
                              rec.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {rec.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {rec.status !== 'Paid' && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateReceivableStatus(rec.id, 'Paid')}>
                                Tandai Lunas
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* --- DIALOGS --- */}

      {/* Expense Dialog */}
      <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Catat Pengeluaran Baru</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-medium text-slate-500">Tanggal</label>
                 <Input type="date" value={expenseForm.transaction_date} onChange={(e) => setExpenseForm({...expenseForm, transaction_date: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-medium text-slate-500">Jumlah (Rp)</label>
                 <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} />
               </div>
            </div>
            
            {/* Searchable Sub Category Dropdown */}
            <div>
               <label className="text-xs font-medium text-slate-500 mb-1 block">Sub Kategori</label>
               <Popover open={openSubCat} onOpenChange={setOpenSubCat}>
                 <PopoverTrigger asChild>
                   <Button
                     variant="outline"
                     role="combobox"
                     aria-expanded={openSubCat}
                     className="w-full justify-between font-normal"
                   >
                     {expenseForm.sub_category || "Pilih Sub Kategori..."}
                     <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2 border-b">
                       <div className="flex items-center px-2">
                         <Search className="mr-2 h-4 w-4 opacity-50" />
                         <input 
                           className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                           placeholder="Cari sub kategori..."
                           value={searchSubCat}
                           onChange={(e) => setSearchSubCat(e.target.value)}
                           autoFocus
                         />
                       </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                       {filteredSubCategories.length === 0 ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">Tidak ada hasil.</div>
                       ) : (
                          filteredSubCategories.map(sub => (
                             <div
                               key={sub.id}
                               className={cn(
                                 "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                 expenseForm.sub_category === sub.subcategory_name ? "bg-slate-100" : ""
                               )}
                               onClick={() => handleSelectSubCategory(sub)}
                             >
                               <Check
                                 className={cn(
                                   "mr-2 h-4 w-4",
                                   expenseForm.sub_category === sub.subcategory_name ? "opacity-100" : "opacity-0"
                                 )}
                               />
                               {sub.subcategory_name}
                             </div>
                          ))
                       )}
                    </div>
                 </PopoverContent>
               </Popover>
            </div>

            <div>
               <label className="text-xs font-medium text-slate-500">Kategori Utama</label>
               <Input 
                  value={expenseForm.main_category} 
                  readOnly 
                  disabled 
                  className="bg-slate-100 text-slate-600 font-medium" 
                  placeholder="Otomatis terisi" 
               />
            </div>

            <div>
               <label className="text-xs font-medium text-slate-500">Deskripsi</label>
               <Input value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} />
            </div>
            <div>
               <label className="text-xs font-medium text-slate-500">Sumber Dana</label>
               <Select value={expenseForm.bank_account_id} onValueChange={(val) => setExpenseForm({...expenseForm, bank_account_id: val})}>
                 <SelectTrigger><SelectValue placeholder="Pilih Akun Bank / Cash" /></SelectTrigger>
                 <SelectContent>
                   {bankAccounts.map(b => (
                     <SelectItem key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpenseOpen(false)}>Batal</Button>
            <Button onClick={handleCreateExpense}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Dialog */}
      <Dialog open={isIncomeOpen} onOpenChange={setIsIncomeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Catat Pemasukan Lain</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-medium text-slate-500">Tanggal</label>
                 <Input type="date" value={incomeForm.transaction_date} onChange={(e) => setIncomeForm({...incomeForm, transaction_date: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-medium text-slate-500">Jumlah (Rp)</label>
                 <Input type="number" value={incomeForm.amount} onChange={(e) => setIncomeForm({...incomeForm, amount: e.target.value})} />
               </div>
            </div>
            <div>
               <label className="text-xs font-medium text-slate-500">Sumber Pemasukan</label>
               <Select value={incomeForm.source} onValueChange={(val) => setIncomeForm({...incomeForm, source: val})}>
                 <SelectTrigger><SelectValue placeholder="Pilih Sumber" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="Investasi">Investasi / Suntikan Modal</SelectItem>
                   <SelectItem value="Penjualan Aset">Penjualan Aset</SelectItem>
                   <SelectItem value="Hibah">Hibah</SelectItem>
                   <SelectItem value="Lainnya">Lainnya</SelectItem>
                 </SelectContent>
               </Select>
            </div>
            <div>
               <label className="text-xs font-medium text-slate-500">Deskripsi</label>
               <Input value={incomeForm.description} onChange={(e) => setIncomeForm({...incomeForm, description: e.target.value})} />
            </div>
            <div>
               <label className="text-xs font-medium text-slate-500">Masuk Ke Akun</label>
               <Select value={incomeForm.bank_account_id} onValueChange={(val) => setIncomeForm({...incomeForm, bank_account_id: val})}>
                 <SelectTrigger><SelectValue placeholder="Pilih Akun Bank" /></SelectTrigger>
                 <SelectContent>
                   {bankAccounts.map(b => (
                     <SelectItem key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsIncomeOpen(false)}>Batal</Button>
             <Button onClick={handleCreateIncome} className="bg-green-600 hover:bg-green-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Dialog */}
      <Dialog open={isBankOpen} onOpenChange={setIsBankOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Tambah Data Bank</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
             <div>
               <label className="text-xs font-medium text-slate-500">Nama Bank / Wallet</label>
               <Input value={bankForm.bank_name} onChange={(e) => setBankForm({...bankForm, bank_name: e.target.value})} placeholder="Contoh: BCA, Mandiri, Cash Drawer" />
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Nomor Rekening</label>
               <Input value={bankForm.account_number} onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})} />
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Atas Nama</label>
               <Input value={bankForm.holder_name} onChange={(e) => setBankForm({...bankForm, holder_name: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-medium text-slate-500">Saldo Awal</label>
                  <Input type="number" value={bankForm.balance} onChange={(e) => setBankForm({...bankForm, balance: e.target.value})} />
               </div>
               <div>
                  <label className="text-xs font-medium text-slate-500">Tipe Akun</label>
                  <Select value={bankForm.account_type} onValueChange={(val) => setBankForm({...bankForm, account_type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking (Giro)</SelectItem>
                      <SelectItem value="savings">Savings (Tabungan)</SelectItem>
                      <SelectItem value="cash">Cash (Tunai)</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsBankOpen(false)}>Batal</Button>
             <Button onClick={handleCreateBank}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receivable Dialog */}
      <Dialog open={isReceivableOpen} onOpenChange={setIsReceivableOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Catat Piutang Baru</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
             <div>
               <label className="text-xs font-medium text-slate-500">Pasien</label>
               <Select value={receivableForm.patient_id} onValueChange={(val) => setReceivableForm({...receivableForm, patient_id: val})}>
                 <SelectTrigger><SelectValue placeholder="Pilih Pasien" /></SelectTrigger>
                 <SelectContent>
                   {patients.map(p => (
                     <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Total Tagihan (Rp)</label>
               <Input type="number" value={receivableForm.total_amount} onChange={(e) => setReceivableForm({...receivableForm, total_amount: e.target.value})} />
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Sudah Dibayar (Rp)</label>
               <Input type="number" value={receivableForm.paid_amount} onChange={(e) => setReceivableForm({...receivableForm, paid_amount: e.target.value})} />
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Jatuh Tempo</label>
               <Input type="date" value={receivableForm.due_date} onChange={(e) => setReceivableForm({...receivableForm, due_date: e.target.value})} />
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsReceivableOpen(false)}>Batal</Button>
             <Button onClick={handleCreateReceivable}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceInput;