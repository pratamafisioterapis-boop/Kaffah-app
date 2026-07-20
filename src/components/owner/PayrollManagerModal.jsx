import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Trash2, Eye, Download, Wallet, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  getPayrollRecordsForTherapist, upsertPayrollRecord, deletePayrollRecord, getCurrentClinic,
} from '@/lib/api';
import { generatePayslipPDF, payslipFileName } from '@/lib/payslipGenerator';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const emptyForm = (therapist) => ({
  payroll_period_start: '',
  payroll_period_end: '',
  base_salary: therapist?.base_salary || 0,
  transport_per_day: therapist?.transport_per_day || 0,
  incentive_amount: 0,
  custom_commission: 0,
});

const formatCurrency = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

const PayrollManagerModal = ({ open, onClose, therapist }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(emptyForm(therapist));

  useEffect(() => {
    if (open && therapist?.id) {
      setForm(emptyForm(therapist));
      fetchRecords();
      fetchClinic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, therapist?.id]);

  const fetchClinic = async () => {
    const { data } = await getCurrentClinic();
    if (data) {
      setClinic(data);
      setForm((prev) => ({
        ...prev,
        incentive_amount: prev.incentive_amount === 0
          ? (data.therapist_incentive_per_patient || 0)
          : prev.incentive_amount,
      }));
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await getPayrollRecordsForTherapist(therapist.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Memuat', description: error.message });
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const total = useMemo(() => {
    return (
      (parseFloat(form.base_salary) || 0) +
      (parseFloat(form.transport_per_day) || 0) +
      (parseFloat(form.incentive_amount) || 0) +
      (parseFloat(form.custom_commission) || 0)
    );
  }, [form]);

  const handleSave = async () => {
    if (!form.payroll_period_start || !form.payroll_period_end) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Periode wajib diisi.' });
      return;
    }

    setSaving(true);
    const { data, error } = await upsertPayrollRecord({
      physiotherapist_id: therapist.id,
      salary_scheme: therapist.salary_scheme || 'full_salary',
      ...form,
      total_salary: total,
    });
    setSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } else {
      toast({ title: 'Berhasil', description: 'Slip gaji berhasil dibuat.' });
      setRecords((prev) => [data, ...prev]);
      setForm(emptyForm(therapist));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus slip gaji ini?')) return;
    const { success, error } = await deletePayrollRecord(id);
    if (success) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: 'Terhapus', description: 'Slip gaji telah dihapus.' });
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: error?.message });
    }
  };

  const handleView = (record) => {
    const doc = generatePayslipPDF(record, therapist, clinic || {});
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleDownload = (record) => {
    const doc = generatePayslipPDF(record, therapist, clinic || {});
    doc.save(payslipFileName(record, therapist));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" /> Payroll: {therapist?.name}
          </DialogTitle>
          <DialogDescription>
            Buat slip gaji baru dan kelola riwayat payroll terapis ini.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <h4 className="font-semibold text-sm text-slate-800">Buat Slip Gaji Baru</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Mulai</label>
              <Input type="date" value={form.payroll_period_start} onChange={(e) => setForm({ ...form, payroll_period_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Selesai</label>
              <Input type="date" value={form.payroll_period_end} onChange={(e) => setForm({ ...form, payroll_period_end: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Gaji Pokok</label>
              <Input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Uang Transport</label>
              <Input type="number" value={form.transport_per_day} onChange={(e) => setForm({ ...form, transport_per_day: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Jasa Insentif</label>
              <Input type="number" value={form.incentive_amount} onChange={(e) => setForm({ ...form, incentive_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Komisi (dari Remunerasi)</label>
              <Input type="number" value={form.custom_commission} onChange={(e) => setForm({ ...form, custom_commission: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-600">Total Take Home Pay</span>
            <span className="text-lg font-bold text-emerald-700">{formatCurrency(total)}</span>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Simpan Slip Gaji
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-slate-800">Riwayat Payroll</h4>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">Belum ada slip gaji untuk terapis ini.</p>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {records.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {format(new Date(r.payroll_period_start), 'd MMM', { locale: idLocale })} — {format(new Date(r.payroll_period_end), 'd MMM yyyy', { locale: idLocale })}
                    </p>
                    <p className="text-xs text-slate-500">{formatCurrency(r.total_salary)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => handleView(r)} title="Lihat">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleDownload(r)} title="Download">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(r.id)} title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayrollManagerModal;
