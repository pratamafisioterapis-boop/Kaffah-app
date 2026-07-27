import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Trash2, Eye, Download, Wallet, Receipt, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  getPayrollRecordsForTherapist, upsertPayrollRecord, deletePayrollRecord, getCurrentClinic,
  getDailyRecaps, getTherapistSchedules, getTherapistTimeOff, getServiceRates, getRemunerationReport,
} from '@/lib/api';
import {
  calculateAttendanceDays, calculateFullSalary, calculateCustomSalary, calculateRemunerationCommission,
  getTherapistPeriodRange,
} from '@/lib/utils';
import { generatePayslipPDF, payslipFileName } from '@/lib/payslipGenerator';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
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

const STATUS_LABEL = { draft: 'Draft', approved: 'Disetujui', paid: 'Paid' };
const STATUS_BADGE_CLASS = {
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const PayrollManagerModal = ({ open, onClose, therapist }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(emptyForm(therapist));
  const [attendanceDays, setAttendanceDays] = useState(0);
  const [calculatingAuto, setCalculatingAuto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [commissionBreakdown, setCommissionBreakdown] = useState(null);

  useEffect(() => {
    if (open && therapist?.id) {
      setForm(emptyForm(therapist));
      setAttendanceDays(0);
      setCommissionBreakdown(null);
      fetchRecords();
      fetchClinic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, therapist?.id]);

  // Setiap periode berubah, hitung ulang Uang Transport (transport per hari x
  // hari kerja) dan Jasa Insentif memakai logika yang sama dengan Simulasi
  // Hitung Gaji (Salary Calculator), supaya kedua tempat selalu konsisten.
  useEffect(() => {
    if (open && therapist?.id && form.payroll_period_start && form.payroll_period_end) {
      const handle = setTimeout(() => {
        recalculateFromAttendance(form.payroll_period_start, form.payroll_period_end);
      }, 300);
      return () => clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, therapist?.id, form.payroll_period_start, form.payroll_period_end]);

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

  const handlePeriodeIni = () => {
    // Payroll dibuat untuk periode yang baru saja SELESAI (dibayar setelah
    // periode tutup). Kalau hari ini persis tanggal mulai siklus baru,
    // getTherapistPeriodRange akan mengembalikan siklus baru yang baru mulai
    // (belum ada datanya) — jadi mundurkan referensi 1 hari supaya yang
    // kepilih periode sebelumnya yang baru saja berakhir kemarin.
    const startDay = therapist?.period_start_day ?? 28;
    const today = new Date();
    const referenceDate = today.getDate() === startDay
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      : today;
    const { startDate, endDate } = getTherapistPeriodRange(therapist, referenceDate);
    setForm((prev) => ({
      ...prev,
      payroll_period_start: format(startDate, 'yyyy-MM-dd'),
      payroll_period_end: format(endDate, 'yyyy-MM-dd'),
    }));
  };

  const recalculateFromAttendance = async (startDateStr, endDateStr) => {
    if (!therapist?.id || !startDateStr || !endDateStr) return;
    setCalculatingAuto(true);
    try {
      const salaryType = therapist.salary_scheme || 'full_salary';
      const isProbation = salaryType === 'probation';

      const [scheduleRes, timeOffRes, recapsRes, ratesRes] = await Promise.all([
        getTherapistSchedules(therapist.id),
        getTherapistTimeOff(therapist.id),
        getDailyRecaps({ startDate: startDateStr, endDate: endDateStr, therapistId: therapist.id, limit: 'all' }),
        salaryType === 'custom_salary' ? getServiceRates() : Promise.resolve({ data: [] }),
      ]);

      const days = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr);
      setAttendanceDays(days);

      const therapistRecaps = recapsRes.data || [];
      let transportAllowance = 0;
      let incentiveAmount = 0;

      if (!isProbation) {
        transportAllowance = (parseFloat(therapist.transport_per_day) || 0) * days;

        if (salaryType === 'full_salary') {
          incentiveAmount = calculateFullSalary(therapistRecaps);
        } else {
          const rateMap = {};
          (ratesRes.data || []).forEach((r) => { rateMap[r.service_name] = r.rate; });
          incentiveAmount = calculateCustomSalary(therapistRecaps, rateMap);
        }
      }

      // Komisi remunerasi: 2% (atau tarif klinik) dari profit (omzet - take
      // home pay sebelum komisi), discale oleh skor performa remunerasi.
      const revenue = calculateFullSalary(therapistRecaps);
      const { data: remunerationReport } = await getRemunerationReport(therapist.id, startDateStr, endDateStr);
      const overallScore = remunerationReport?.overallScore || 0;
      const ratePercent = parseFloat(clinic?.remuneration_commission_rate_percent) || 2;

      // Komisi hanya cair kalau remunerasi aktif secara global UNTUK terapis
      // ini DAN target pasien periode ini tercapai (remunerationReport.isActive) —
      // sebelumnya field isActive ini tidak dipakai sama sekali di sini,
      // jadi komisi tetap muncul walau target pasien periode berjalan belum tercapai.
      const { profit, marginPercent, commission } = calculateRemunerationCommission({
        revenue,
        baseSalary: parseFloat(therapist.base_salary) || 0,
        transportAllowance,
        incentiveAmount,
        overallScore,
        remunerationEnabled: therapist.remuneration_enabled !== false && remunerationReport?.isActive === true,
        ratePercent,
      });

      setCommissionBreakdown({
        revenue, profit, marginPercent, overallScore, ratePercent,
        isActive: remunerationReport?.isActive === true,
      });

      setForm((prev) => ({
        ...prev,
        transport_per_day: transportAllowance,
        incentive_amount: incentiveAmount,
        custom_commission: commission,
      }));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Menghitung Otomatis', description: error.message });
    } finally {
      setCalculatingAuto(false);
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

  const handleMarkAsPaid = async (record) => {
    setMarkingPaidId(record.id);
    const { data, error } = await upsertPayrollRecord({
      id: record.id,
      physiotherapist_id: record.physiotherapist_id,
      payroll_period_start: record.payroll_period_start,
      payroll_period_end: record.payroll_period_end,
      salary_scheme: record.salary_scheme,
      base_salary: record.base_salary,
      transport_per_day: record.transport_per_day,
      incentive_amount: record.incentive_amount,
      custom_commission: record.custom_commission,
      total_salary: record.total_salary,
      status: 'paid',
    });
    setMarkingPaidId(null);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: error.message });
    } else {
      setRecords((prev) => prev.map((r) => (r.id === record.id ? data : r)));
      toast({ title: 'Berhasil', description: 'Slip gaji ditandai sebagai Dibayar.' });
    }
  };

  const handleView = (record) => {
    const doc = generatePayslipPDF(record, therapist, clinic || {});
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Mulai</label>
              <Input type="date" value={form.payroll_period_start} onChange={(e) => setForm({ ...form, payroll_period_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Selesai</label>
              <Input type="date" value={form.payroll_period_end} onChange={(e) => setForm({ ...form, payroll_period_end: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePeriodeIni}
                className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                Periode Ini ({therapist ? `Tgl ${therapist.period_start_day ?? 28} - ${therapist.period_end_day ?? 27}` : '...'})
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Gaji Pokok</label>
              <Input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                Uang Transport
                {calculatingAuto && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                {!calculatingAuto && attendanceDays > 0 && (
                  <span className="text-[10px] font-normal text-slate-400">({attendanceDays} hari kerja)</span>
                )}
              </label>
              <Input type="number" value={form.transport_per_day} onChange={(e) => setForm({ ...form, transport_per_day: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                Jasa Insentif
                {calculatingAuto && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </label>
              <Input type="number" value={form.incentive_amount} onChange={(e) => setForm({ ...form, incentive_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                Komisi (dari Remunerasi)
                {calculatingAuto && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </label>
              <Input type="number" value={form.custom_commission} onChange={(e) => setForm({ ...form, custom_commission: e.target.value })} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-1">
            Uang Transport &amp; Jasa Insentif otomatis dihitung dari periode di atas (mengikuti hari kerja &amp; skema gaji terapis, sama seperti Simulasi Hitung Gaji). Nilainya tetap bisa diubah manual bila perlu.
          </p>
          {commissionBreakdown && (
            <div className="text-[11px] text-slate-500 rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span>Omzet periode</span>
                <span className="font-medium text-slate-700">{formatCurrency(commissionBreakdown.revenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Profit (omzet − take home pay)</span>
                <span className={`font-medium ${commissionBreakdown.profit < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                  {formatCurrency(commissionBreakdown.profit)} ({commissionBreakdown.marginPercent.toFixed(0)}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Skor performa remunerasi</span>
                <span className="font-medium text-slate-700">{commissionBreakdown.overallScore}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tarif komisi</span>
                <span className="font-medium text-slate-700">{commissionBreakdown.ratePercent}% dari profit</span>
              </div>
              {!commissionBreakdown.isActive && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-amber-600">Status remunerasi periode ini</span>
                  <span className="font-medium text-amber-600">Nonaktif (target pasien belum tercapai)</span>
                </div>
              )}
            </div>
          )}

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
                      {format(new Date(r.payroll_period_end), 'MMMM yyyy', { locale: idLocale })}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLASS[r.status] || STATUS_BADGE_CLASS.paid}`}>
                      {STATUS_LABEL[r.status] || STATUS_LABEL.paid}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.status !== 'paid' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-600"
                        onClick={() => handleMarkAsPaid(r)}
                        disabled={markingPaidId === r.id}
                        title="Tandai Dibayar"
                      >
                        {markingPaidId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      </Button>
                    )}
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

      <PdfPreviewModal
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        url={previewUrl}
        title="Preview Slip Gaji"
      />
    </Dialog>
  );
};

export default PayrollManagerModal;
