import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, AlertCircle, Wallet, RefreshCw, Banknote } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { autoPostFixedCosts, getAccountingSubcategories } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import SearchableSelect from '@/components/ui/searchable-select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const isSalaryItem = (name) => /gaji/i.test(name || '');

const FixedCostManager = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemPostDay, setNewItemPostDay] = useState('1');
  const [newItemSubcategory, setNewItemSubcategory] = useState('');
  const [newItemAutoPost, setNewItemAutoPost] = useState(true);
  const [autoPostTouched, setAutoPostTouched] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: posted }, subsRes] = await Promise.all([
      autoPostFixedCosts(),
      getAccountingSubcategories(),
    ]);
    if (posted?.length) {
      toast({ title: 'Item diposting', description: `${posted.length} item bulan ini otomatis tercatat sebagai pengeluaran.` });
    }
    if (subsRes?.data) {
      setSubcategories(subsRes.data
        .filter(sub => sub.subcategory_name && sub.parent_category?.type === 'expense')
        .map(sub => ({
          label: sub.subcategory_name,
          value: sub.id,
          description: `Kategori: ${sub.parent_category?.category_name || 'N/A'}`,
        })));
    }
    const { data, error } = await supabase
      .from('clinic_fixed_costs')
      .select('id, item_name, amount, post_day, last_posted_month, subcategory_id, auto_post')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  }, [clinicId, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!autoPostTouched) setNewItemAutoPost(!isSalaryItem(newItemName));
  }, [newItemName, autoPostTouched]);

  const totalMonthly = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);

  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSaveItem = async (id, overrides = {}) => {
    const item = { ...items.find(i => i.id === id), ...overrides };
    if (!item) return;
    const { error } = await supabase
      .from('clinic_fixed_costs')
      .update({
        item_name: item.item_name,
        amount: parseFloat(item.amount) || 0,
        post_day: parseInt(item.post_day) || 1,
        subcategory_id: item.subcategory_id || null,
        auto_post: !!item.auto_post,
      })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    } else {
      toast({ title: 'Item diperbarui' });
    }
  };

  const handleToggleAutoPost = (id, checked) => {
    handleUpdateItem(id, 'auto_post', checked);
    handleSaveItem(id, { auto_post: checked });
  };

  const handleChangeSubcategory = (id, value) => {
    handleUpdateItem(id, 'subcategory_id', value);
    handleSaveItem(id, { subcategory_id: value });
  };

  const handleAddItem = async () => {
    if (!clinicId) return;
    const name = newItemName.trim();
    const amount = parseFloat(newItemAmount) || 0;
    if (!name) {
      toast({ variant: 'destructive', title: 'Nama item wajib diisi' });
      return;
    }
    const postDay = Math.min(Math.max(parseInt(newItemPostDay) || 1, 1), 31);
    setIsProcessing(true);
    const { data, error } = await supabase
      .from('clinic_fixed_costs')
      .insert({
        clinic_id: clinicId,
        item_name: name,
        amount,
        post_day: postDay,
        subcategory_id: newItemSubcategory || null,
        auto_post: newItemAutoPost,
      })
      .select()
      .single();
    setIsProcessing(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah item', description: error.message });
      return;
    }
    setItems(prev => [...prev, data]);
    setNewItemName('');
    setNewItemAmount('');
    setNewItemPostDay('1');
    setNewItemSubcategory('');
    setNewItemAutoPost(true);
    setAutoPostTouched(false);
    setIsAddOpen(false);
    toast({ title: 'Item ditambahkan' });
  };

  const openDelete = (item) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsProcessing(true);
    const { error } = await supabase.from('clinic_fixed_costs').delete().eq('id', deletingItem.id);
    setIsProcessing(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== deletingItem.id));
    toast({ title: 'Item dihapus' });
    setIsDeleteOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-0">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Pengeluaran Rutin Bulanan</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Item dengan Auto-Posting aktif akan otomatis tercatat sebagai pengeluaran tiap tanggal yang ditentukan. Item gaji tidak auto-posting di sini — nanti terposting otomatis setelah payroll dibuat.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Item
        </Button>
      </div>

      <div className="p-6">
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p>Belum ada item.</p>
              <Button variant="link" onClick={() => setIsAddOpen(true)} className="text-blue-600 mt-2">Tambahkan item pertama</Button>
            </div>
          ) : (
            items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col gap-3 p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 md:flex-1">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-amber-600" />
                    </div>
                    <Input
                      value={item.item_name}
                      onChange={(e) => handleUpdateItem(item.id, 'item_name', e.target.value)}
                      onBlur={() => handleSaveItem(item.id)}
                      placeholder="Nama item"
                      className="flex-1 min-w-0"
                    />
                  </div>
                  <div className="flex items-end gap-2 pl-12 md:pl-0">
                    <div className="flex-1 md:w-40">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1 md:hidden">Jumlah/bulan</label>
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleUpdateItem(item.id, 'amount', e.target.value)}
                        onBlur={() => handleSaveItem(item.id)}
                        className="w-full"
                      />
                    </div>
                    <div className="w-16 shrink-0">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1 md:hidden">Tgl posting</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={item.post_day}
                        onChange={(e) => handleUpdateItem(item.id, 'post_day', e.target.value)}
                        onBlur={() => handleSaveItem(item.id)}
                        title="Tanggal posting tiap bulan"
                        className="w-full"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(item)} className="h-10 w-10 text-slate-500 hover:text-red-600 hover:bg-red-50 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 pl-0 md:pl-12">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Sub Kategori</label>
                    <SearchableSelect
                      options={subcategories}
                      value={item.subcategory_id}
                      onChange={(val) => handleChangeSubcategory(item.id, val)}
                      placeholder="Pilih sub kategori..."
                      allowCreate={false}
                      notFoundText="Sub kategori tidak ditemukan."
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={!!item.auto_post} onCheckedChange={(checked) => handleToggleAutoPost(item.id, checked)} />
                    <span className={item.auto_post ? 'text-xs font-medium text-slate-600' : 'text-xs font-medium text-indigo-600 flex items-center gap-1'}>
                      {item.auto_post ? 'Auto-Posting' : <><Banknote className="w-3.5 h-3.5" /> Via Payroll</>}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 mt-4 border border-slate-100">
            <span className="text-sm font-semibold text-slate-600">Total Pengeluaran Rutin per Bulan</span>
            <span className="text-base font-bold text-indigo-600">{formatCurrency(totalMonthly)}</span>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Tambah Item Pengeluaran Rutin</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Nama Item</label>
              <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Contoh: Sewa Ruko" autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Sub Kategori</label>
              <SearchableSelect
                options={subcategories}
                value={newItemSubcategory}
                onChange={setNewItemSubcategory}
                placeholder="Pilih sub kategori..."
                allowCreate={false}
                notFoundText="Sub kategori tidak ditemukan."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Jumlah per Bulan (Rp)</label>
              <Input type="number" value={newItemAmount} onChange={(e) => setNewItemAmount(e.target.value)} placeholder="Contoh: 8000000" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Tanggal Posting Tiap Bulan (1-31)</label>
              <Input type="number" min="1" max="31" value={newItemPostDay} onChange={(e) => setNewItemPostDay(e.target.value)} placeholder="Contoh: 1" />
              <p className="text-xs text-slate-500">Jika bulan tidak punya tanggal itu (mis. 31 di Februari), akan diposting di hari terakhir bulan tersebut.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-Posting</p>
                <p className="text-xs text-slate-500">Matikan untuk item gaji — akan terposting otomatis lewat payroll, bukan dari sini.</p>
              </div>
              <Switch checked={newItemAutoPost} onCheckedChange={(v) => { setNewItemAutoPost(v); setAutoPostTouched(true); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button onClick={handleAddItem} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>Hapus item "{deletingItem?.item_name}"? Item ini tidak akan lagi auto-posting bulan depan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button onClick={handleDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixedCostManager;
