import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Settings2, Loader2, TrendingUp, Users, Wallet, Info, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

// avgRevenuePerPatient & avgIncentivePerPatient dihitung otomatis di RevenueOverview.jsx
// dari data transaksi & tabel service_rates periode berjalan.
const BreakEvenPointWidget = ({ avgRevenuePerPatient = 0, avgIncentivePerPatient = 0, totalPatientsInPeriod = 0 }) => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

  const fetchItems = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_fixed_costs')
      .select('id, item_name, amount')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalFixedCost = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);

  const handleAddItem = async () => {
    if (!clinicId) return;
    const name = newItemName.trim();
    const amount = parseFloat(newItemAmount) || 0;
    if (!name) {
      toast({ variant: 'destructive', title: 'Nama item wajib diisi' });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('clinic_fixed_costs')
      .insert({ clinic_id: clinicId, item_name: name, amount })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah item', description: error.message });
      return;
    }
    setItems(prev => [...prev, data]);
    setNewItemName('');
    setNewItemAmount('');
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSaveItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const { error } = await supabase
      .from('clinic_fixed_costs')
      .update({ item_name: item.item_name, amount: parseFloat(item.amount) || 0 })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    }
  };

  const handleDeleteItem = async (id) => {
    const { error } = await supabase.from('clinic_fixed_costs').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
    toast({ title: 'Item dihapus' });
  };

  const contributionMargin = useMemo(() => Math.max(avgRevenuePerPatient - avgIncentivePerPatient, 0), [avgRevenuePerPatient, avgIncentivePerPatient]);
  const bepPatients = useMemo(() => {
    if (contributionMargin <= 0) return null;
    return Math.ceil(totalFixedCost / contributionMargin);
  }, [totalFixedCost, contributionMargin]);
  const bepRevenue = useMemo(() => bepPatients ? bepPatients * avgRevenuePerPatient : null, [bepPatients, avgRevenuePerPatient]);
  const progressPct = useMemo(() => {
    if (!bepPatients || bepPatients === 0) return 0;
    return Math.min(Math.round((totalPatientsInPeriod / bepPatients) * 100), 100);
  }, [totalPatientsInPeriod, bepPatients]);
  const isConfigured = totalFixedCost > 0 && contributionMargin > 0;

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-800/50" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)' }}>
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-6 space-y-5">
        <div className={cn("flex gap-3", isPWA ? "flex-col" : "items-start justify-between")}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/40 shrink-0">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base tracking-tight">Break Even Point</h3>
              <p className="text-slate-400 text-xs mt-0.5">Titik impas berdasarkan biaya tetap & insentif terapis</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors shrink-0",
              isPWA ? "w-full" : ""
            )}
          >
            <Settings2 className="w-3.5 h-3.5" /> Atur Fixed Cost
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : !isConfigured ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-center">
            <Info className="w-5 h-5 text-indigo-300 mx-auto mb-2" />
            <p className="text-sm text-slate-300">
              {totalFixedCost <= 0
                ? 'Tambahkan minimal 1 item fixed cost untuk melihat titik impas.'
                : 'Insentif terapis per pasien belum terdeteksi dari data Tarif Jasa Terapis.'}
            </p>
            <Button onClick={() => setIsOpen(true)} className="mt-3 bg-indigo-600 hover:bg-indigo-700">Atur Fixed Cost</Button>
          </div>
        ) : (
          <>
            <div className={cn("grid gap-3", isPWA ? "grid-cols-1" : "grid-cols-2")}>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">BEP Pasien/Sesi</p>
                <p className="text-2xl font-bold text-white tabular-nums">{bepPatients?.toLocaleString('id-ID') ?? '-'}</p>
                <p className="text-[11px] text-slate-400 mt-1">per bulan</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">BEP Revenue</p>
                <p className="text-lg font-bold text-white tabular-nums break-words">{formatCurrency(bepRevenue)}</p>
                <p className="text-[11px] text-slate-400 mt-1">per bulan</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className={cn("flex text-xs gap-1", isPWA ? "flex-col" : "items-center justify-between")}>
                <span className="text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Progress periode ini</span>
                <span className="text-white font-semibold">{totalPatientsInPeriod} / {bepPatients} pasien</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: progressPct >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #a855f7)' }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {progressPct >= 100 ? 'Sudah melewati titik impas 🎉' : `${100 - progressPct}% lagi menuju titik impas`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                Fixed Cost: <span className="text-slate-200 font-semibold">{formatCurrency(totalFixedCost)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Insentif/Pasien: <span className="text-slate-200 font-semibold">{formatCurrency(avgIncentivePerPatient)}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              *Insentif per pasien dihitung otomatis dari rata-rata Tarif Jasa Terapis periode ini.
            </p>
          </>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Fixed Cost Bulanan</DialogTitle>
            <DialogDescription>Rincian biaya tetap klinik per item (sewa, gaji admin, listrik, dll).</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[360px] overflow-y-auto pr-1">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Belum ada item fixed cost.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    value={item.item_name}
                    onChange={(e) => handleUpdateItem(item.id, 'item_name', e.target.value)}
                    onBlur={() => handleSaveItem(item.id)}
                    placeholder="Nama item"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleUpdateItem(item.id, 'amount', e.target.value)}
                    onBlur={() => handleSaveItem(item.id)}
                    placeholder="Jumlah"
                    className="w-36"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Contoh: Sewa Ruko"
              className="flex-1"
            />
            <Input
              type="number"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              placeholder="Contoh: 8000000"
              className="w-36"
            />
            <Button onClick={handleAddItem} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 mt-2">
            <span className="text-sm font-semibold text-slate-600">Total Fixed Cost</span>
            <span className="text-base font-bold text-indigo-600">{formatCurrency(totalFixedCost)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BreakEvenPointWidget;