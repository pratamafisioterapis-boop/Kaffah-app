import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Loader2, AlertCircle, Wallet, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getPatientTypeOptions } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const ServiceRateManager = () => {
  const { toast } = useToast();
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [patientTypes, setPatientTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeRateInputs, setTypeRateInputs] = useState({});
  const [savingTypeLabel, setSavingTypeLabel] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [form, setForm] = useState({ service_name: '', rate: '' });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingRate, setDeletingRate] = useState(null);

  const fetchRates = async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('service_rates')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('service_name', { ascending: true });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat tarif jasa.' });
    } else {
      setRates(data || []);
    }
    setLoading(false);
  };

  const fetchPatientTypes = async () => {
    setLoadingTypes(true);
    const { data } = await getPatientTypeOptions();
    setPatientTypes(data || []);
    setLoadingTypes(false);
  };

  useEffect(() => { fetchRates(); fetchPatientTypes(); }, [clinicId]);

  // Gabungkan Tipe Pasien (dari Setup) dengan tarif yang sudah pernah diisi
  const mergedTypeRates = useMemo(() => {
    return patientTypes.map((pt) => {
      const match = rates.find(
        (r) => (r.service_name || '').trim().toLowerCase() === (pt.label || '').trim().toLowerCase()
      );
      return { key: pt.id, id: pt.id, label: pt.label, rateRow: match || null };
    });
  }, [patientTypes, rates]);

  // Tarif yang namanya tidak cocok dengan Tipe Pasien manapun (input manual/lama)
  const customRates = useMemo(() => {
    const typeLabels = patientTypes.map((pt) => (pt.label || '').trim().toLowerCase());
    return rates.filter((r) => !typeLabels.includes((r.service_name || '').trim().toLowerCase()));
  }, [rates, patientTypes]);

  const handleQuickSave = async (id, label, rateRow) => {
    const inputValue = typeRateInputs[id];
    const rateValue = parseFloat(inputValue) || 0;
    setSavingTypeLabel(id);
    try {
      if (rateRow) {
        const { data, error } = await supabase
          .from('service_rates')
          .update({ rate: rateValue })
          .eq('id', rateRow.id)
          .select()
          .single();
        if (error) throw error;
        setRates((prev) => prev.map((r) => (r.id === rateRow.id ? data : r)));
      } else {
        const { data, error } = await supabase
          .from('service_rates')
          .insert({ service_name: label, rate: rateValue, clinic_id: clinicId })
          .select()
          .single();
        if (error) throw error;
        setRates((prev) => [...prev, data]);
      }
      toast({ title: 'Berhasil', description: `Tarif "${label}" disimpan.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } finally {
      setSavingTypeLabel(null);
    }
  };

  const openAdd = () => {
    setEditingRate(null);
    setForm({ service_name: '', rate: '' });
    setIsFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingRate(item);
    setForm({ service_name: item.service_name, rate: item.rate });
    setIsFormOpen(true);
  };

  const openDelete = (item) => {
    setDeletingRate(item);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    const name = form.service_name.trim();
    const rateValue = parseFloat(form.rate) || 0;
    if (!name) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Nama tipe pasien/layanan wajib diisi.' });
      return;
    }
    setIsProcessing(true);
    try {
      if (editingRate) {
        const { data, error } = await supabase
          .from('service_rates')
          .update({ service_name: name, rate: rateValue })
          .eq('id', editingRate.id)
          .select()
          .single();
        if (error) throw error;
        setRates(prev => prev.map(r => r.id === editingRate.id ? data : r));
        toast({ title: 'Berhasil', description: 'Tarif diperbarui.' });
      } else {
        const { data, error } = await supabase
          .from('service_rates')
          .insert({ service_name: name, rate: rateValue, clinic_id: clinicId })
          .select()
          .single();
        if (error) throw error;
        setRates(prev => [...prev, data]);
        toast({ title: 'Berhasil', description: 'Tarif ditambahkan.' });
      }
      setIsFormOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRate) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('service_rates').delete().eq('id', deletingRate.id);
      if (error) throw error;
      setRates(prev => prev.filter(r => r.id !== deletingRate.id));
      toast({ title: 'Terhapus', description: 'Tarif dihapus.' });
      setIsDeleteOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menghapus', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Tarif Jasa Terapis per Tipe Pasien</h2>
          <p className="text-sm text-slate-500">Nilai insentif yang diterima terapis untuk setiap tipe pasien/layanan. Nama harus sama/mirip dengan Tipe Pasien di Setup.</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Tarif
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Tarif berdasarkan Tipe Pasien (Setup) */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Tipe Pasien (dari Setup)</h3>
          {loadingTypes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : patientTypes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-sm">
              Belum ada Tipe Pasien di Setup. Tambahkan dulu di tab "Tipe Pasien".
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {mergedTypeRates.map(({ key, id, label, rateRow }) => {
                const currentValue = typeRateInputs[id] !== undefined
                  ? typeRateInputs[id]
                  : (rateRow?.rate ?? '');
                const isSaving = savingTypeLabel === id;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1 sm:flex-initial">
                        <span className="font-medium text-slate-700 truncate block">{label || '(Tanpa nama)'}</span>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {rateRow ? `${formatCurrency(rateRow.rate)} / sesi` : 'Belum diatur'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        type="number"
                        value={currentValue}
                        onChange={(e) => setTypeRateInputs((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Rp 0"
                        className="flex-1 sm:w-32 h-9 text-sm"
                      />
                      <Button
                        size="icon"
                        onClick={() => handleQuickSave(id, label, rateRow)}
                        disabled={isSaving}
                        className="h-9 w-9 shrink-0 bg-blue-600 hover:bg-blue-700"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tarif kustom (nama tidak cocok dengan Tipe Pasien manapun) */}
        {customRates.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Tarif Kustom Lainnya</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {customRates.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">{item.service_name}</span>
                      <p className="text-xs text-emerald-600 font-semibold mt-0.5">{formatCurrency(item.rate)} / sesi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(item)} className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{editingRate ? 'Edit' : 'Tambah'} Tarif Jasa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Nama Tipe Pasien/Layanan</label>
              <Input
                value={form.service_name}
                onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                placeholder="Contoh: DUA KELUHAN"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Insentif per Sesi (Rp)</label>
              <Input
                type="number"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="Contoh: 50000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
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
            <DialogDescription>
              Hapus tarif "{deletingRate?.service_name}"?
            </DialogDescription>
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

export default ServiceRateManager;