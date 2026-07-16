import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import {
  Wallet, Plus, Pencil, Trash2, Loader2, AlertCircle, PiggyBank,
  Building2, Landmark, TrendingUp, Calendar as CalendarIcon, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  getOwnerInitialCapital,
  createOwnerInitialCapital,
  updateOwnerInitialCapital,
  deleteOwnerInitialCapital,
  getBankAccounts,
} from '@/lib/api';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const formatDate = (dateStr) => (dateStr ? format(new Date(dateStr), 'dd/MM/yyyy') : '-');

const SOURCE_OPTIONS = [
  { value: 'Modal Sendiri', label: 'Modal Sendiri' },
  { value: 'Investor', label: 'Investor / Mitra' },
  { value: 'Pinjaman Bank', label: 'Pinjaman Bank' },
  { value: 'Lainnya', label: 'Lainnya' },
];

const sourceStyle = (source) => {
  const map = {
    'Modal Sendiri': { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
    'Investor': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    'Pinjaman Bank': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    'Lainnya': { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  };
  return map[source] || map['Lainnya'];
};

const emptyForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  source: 'Modal Sendiri',
  bank_account_id: '',
  description: '',
};

const ModalAwalManagement = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();

  const isPWA =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://'));

  const [items, setItems] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' | 'edit'
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await getOwnerInitialCapital();
    if (res?.error) {
      toast({ variant: 'destructive', title: 'Gagal memuat data', description: res.error.message });
    } else {
      setItems(res?.data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchBankAccounts = useCallback(async () => {
    const res = await getBankAccounts();
    if (!res?.error) setBankAccounts(res?.data || []);
  }, []);

  useEffect(() => {
    fetchItems();
    fetchBankAccounts();
  }, [fetchItems, fetchBankAccounts]);

  const totalModal = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
    [items]
  );

  const bySource = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      map[i.source] = (map[i.source] || 0) + (Number(i.amount) || 0);
    });
    return map;
  }, [items]);

  const openAddForm = () => {
    setFormMode('add');
    setForm(emptyForm);
    setEditingId(null);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = (item) => {
    setFormMode('edit');
    setForm({
      date: item.date || format(new Date(), 'yyyy-MM-dd'),
      amount: String(item.amount ?? ''),
      source: item.source || 'Modal Sendiri',
      bank_account_id: item.bank_account_id || '',
      description: item.description || '',
    });
    setEditingId(item.id);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.date) errors.date = 'Tanggal wajib diisi';
    if (!form.amount || parseFloat(form.amount) <= 0) errors.amount = 'Jumlah harus lebih dari 0';
    if (!form.source) errors.source = 'Sumber modal wajib dipilih';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsProcessing(true);

    const payload = {
      date: form.date,
      amount: parseFloat(form.amount) || 0,
      source: form.source,
      bank_account_id: form.bank_account_id || null,
      description: form.description?.trim() || null,
    };

    const res = formMode === 'add'
      ? await createOwnerInitialCapital(payload)
      : await updateOwnerInitialCapital(editingId, payload);

    setIsProcessing(false);

    if (res?.error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: res.error.message });
      return;
    }

    if (formMode === 'add') {
      setItems((prev) => [res.data, ...prev]);
      toast({ title: 'Modal awal berhasil ditambahkan' });
    } else {
      setItems((prev) => prev.map((i) => (i.id === editingId ? res.data : i)));
      toast({ title: 'Modal awal berhasil diperbarui' });
    }
    setIsFormOpen(false);
  };

  const openDelete = (item) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsProcessing(true);
    const res = await deleteOwnerInitialCapital(deletingItem.id);
    setIsProcessing(false);

    if (res?.error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: res.error.message });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
    toast({ title: 'Data modal awal dihapus' });
    setIsDeleteOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Modal Awal | Owner Dashboard</title>
        <meta name="description" content="Kelola pencatatan modal awal klinik." />
      </Helmet>

      <div className="space-y-5 pb-24 md:pb-8 animate-in fade-in duration-500">
        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 text-white p-5 md:p-7 shadow-xl">
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-900/40 shrink-0">
                <PiggyBank className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-1">
                  Manajemen Keuangan
                </p>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">Modal Awal</h1>
                <p className="text-slate-400 text-xs mt-1">Pencatatan suntikan modal & investasi awal klinik.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-2.5">
                <span className="text-emerald-300 text-[10px] font-bold uppercase tracking-wider">Total Modal Awal</span>
                <span className="text-lg md:text-xl font-bold tabular-nums">{formatCurrency(totalModal)}</span>
              </div>
              <Button
                onClick={openAddForm}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold shadow-lg shadow-emerald-900/30 shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Tambah
              </Button>
            </div>
          </div>
        </div>

        {/* ── Summary Cards by Source ── */}
        {Object.keys(bySource).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOURCE_OPTIONS.map((opt) => {
              const style = sourceStyle(opt.value);
              const value = bySource[opt.value] || 0;
              return (
                <div
                  key={opt.value}
                  className="rounded-2xl p-4 bg-white border shadow-sm"
                  style={{ borderColor: style.border }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: style.bg }}
                    >
                      <Landmark className="w-3.5 h-3.5" style={{ color: style.color }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 truncate">{opt.label}</span>
                  </div>
                  <p className="text-sm md:text-base font-bold tabular-nums text-slate-800 break-words">
                    {formatCurrency(value)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Data List ── */}
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Riwayat Modal Awal</h3>
                <p className="text-xs text-slate-400">{items.length} catatan modal</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-500" />
                <p className="text-xs text-slate-400 font-medium">Memuat data...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f1f5f9' }}>
                  <AlertCircle className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400 mb-2">Belum ada data modal awal.</p>
                <Button variant="link" onClick={openAddForm} className="text-emerald-600">
                  Tambahkan modal awal pertama
                </Button>
              </div>
            ) : isPWA ? (
              // ── Mobile / PWA Card List ──
              <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0' }}>
                {items.map((item, idx) => {
                  const style = sourceStyle(item.source);
                  return (
                    <div
                      key={item.id}
                      className="px-4 py-3"
                      style={{ background: idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(item.amount)}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditForm(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openDelete(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                          {formatDate(item.date)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                          {item.source}
                        </span>
                        {item.bank_account && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            {item.bank_account.bank_name}
                          </span>
                        )}
                        {item.description && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md truncate max-w-[200px]" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // ── Desktop Table ──
              <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['Tanggal', 'Sumber', 'Akun Bank', 'Keterangan', 'Jumlah'].map((h) => (
                          <th
                            key={h}
                            className={`px-5 py-3 whitespace-nowrap ${h === 'Jumlah' ? 'text-right' : ''}`}
                            style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                          >
                            {h}
                          </th>
                        ))}
                        <th className="px-5 py-3 w-24" style={{ color: '#94a3b8' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, rowIdx) => {
                        const style = sourceStyle(item.source);
                        return (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group transition-colors hover:bg-slate-50/70"
                            style={{ borderBottom: rowIdx === items.length - 1 ? 'none' : '1px solid #f1f5f9' }}
                          >
                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">{formatDate(item.date)}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                              >
                                {item.source}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                              {item.bank_account ? `${item.bank_account.bank_name} - ${item.bank_account.account_number}` : '-'}
                            </td>
                            <td className="px-5 py-3.5 text-slate-500 truncate max-w-[220px]">{item.description || '-'}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-right font-bold tabular-nums text-emerald-600">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditForm(item)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openDelete(item)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              {formMode === 'add' ? 'Tambah Modal Awal' : 'Edit Modal Awal'}
            </DialogTitle>
            <DialogDescription>
              Catat suntikan modal atau investasi awal untuk klinik.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" /> Tanggal
                </label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
                {formErrors.date && <p className="text-[11px] text-rose-500">{formErrors.date}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600">Jumlah (Rp)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Contoh: 50000000"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                {formErrors.amount && <p className="text-[11px] text-rose-500">{formErrors.amount}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Sumber Modal
              </label>
              <Select value={form.source} onValueChange={(val) => setForm((f) => ({ ...f, source: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih sumber modal" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.source && <p className="text-[11px] text-rose-500">{formErrors.source}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5" /> Akun Bank (opsional)
              </label>
              <Select
                value={form.bank_account_id || 'none'}
                onValueChange={(val) => setForm((f) => ({ ...f, bank_account_id: val === 'none' ? '' : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Akun Bank</SelectItem>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.bank_name} - {acc.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Keterangan (opsional)
              </label>
              <Textarea
                placeholder="Misal: Setoran modal awal pendirian klinik"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isProcessing}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>
              Hapus catatan modal awal sebesar{' '}
              <span className="font-semibold text-slate-700">{formatCurrency(deletingItem?.amount)}</span>{' '}
              tanggal {formatDate(deletingItem?.date)}? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isProcessing}>
              Batal
            </Button>
            <Button onClick={handleDelete} disabled={isProcessing} className="bg-rose-600 hover:bg-rose-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalAwalManagement;
