import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Save, Loader2, Award, Settings2, CheckCircle2, XCircle,
  Image as ImageIcon, Target, ThumbsUp, Star, Clock, FileCheck2, Sparkles, Scale,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getActivePhysiotherapists,
  getRemunerationCriteria,
  createRemunerationCriteria,
  updateRemunerationCriteria,
  deleteRemunerationCriteria,
  getRemunerationReport,
  getCurrentClinic,
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { format, subMonths } from 'date-fns';
import { getTherapistPeriodRange, cn } from '@/lib/utils';
import CircularScore from '@/components/shared/CircularScore';

const METRIC_LABELS = {
  target_pasien: 'Target Pasien (otomatis)',
  feedback_positif: 'Feedback Positif (manual terapis)',
  google_review: 'Google Review (manual terapis)',
  kehadiran: 'Kedisiplinan Kehadiran (otomatis)',
  kelengkapan_soap: 'Kelengkapan SOAP (otomatis)',
  custom: 'Kustom (manual terapis)',
};

const METRIC_ICONS = {
  target_pasien: Target,
  feedback_positif: ThumbsUp,
  google_review: Star,
  kehadiran: Clock,
  kelengkapan_soap: FileCheck2,
  custom: Sparkles,
};

const TARGET_MODE_LABELS = {
  percent_of_patient_target: '% dari nilai Target Pasien',
  fixed_percent: 'Persentase tetap (%)',
  fixed_value: 'Nilai tetap',
};

const emptyForm = {
  name: '',
  metricKey: 'custom',
  targetMode: 'fixed_percent',
  targetValue: 100,
  weightPercent: 10,
  unit: '%',
};

const RemunerationManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [reports, setReports] = useState({});
  const [loadingReports, setLoadingReports] = useState(false);
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = periode berjalan saat ini, 1 = satu periode lalu, dst.

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [clinic, setClinic] = useState(null);
  const [commissionRateInput, setCommissionRateInput] = useState('2');
  const [savingCommissionRate, setSavingCommissionRate] = useState(false);

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [therapistsRes, criteriaRes, clinicRes] = await Promise.all([
        getActivePhysiotherapists(),
        getRemunerationCriteria(),
        getCurrentClinic(),
      ]);
      setTherapists((therapistsRes.data || []).filter(t => t.remuneration_enabled !== false));
      setCriteria(criteriaRes.data || []);
      if (clinicRes.data) {
        setClinic(clinicRes.data);
        setCommissionRateInput(String(clinicRes.data.remuneration_commission_rate_percent ?? 2));
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data remunerasi.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBaseData(); }, [fetchBaseData]);

  const fetchReports = useCallback(async () => {
    if (!therapists.length) return;
    setLoadingReports(true);
    try {
      // Each therapist can have their own payroll/target cycle
      // (period_start_day/period_end_day), so the report must be computed
      // per therapist's own period — using one shared date range for
      // everyone caused the owner's numbers to silently diverge from the
      // therapist's own Remunerasi page (and made saved realizations
      // invisible here, since they're keyed by the therapist's real period).
      const referenceDate = subMonths(new Date(), periodOffset);
      const entries = await Promise.all(therapists.map(async (t) => {
        const { startDate, endDate } = getTherapistPeriodRange(t, referenceDate);
        const periodStart = format(startDate, 'yyyy-MM-dd');
        const periodEnd = format(endDate, 'yyyy-MM-dd');
        const { data } = await getRemunerationReport(t.id, periodStart, periodEnd);
        return [t.id, data];
      }));
      setReports(Object.fromEntries(entries));
    } finally {
      setLoadingReports(false);
    }
  }, [therapists, periodOffset]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingCriteria(item);
      setFormData({
        name: item.name,
        metricKey: item.metric_key,
        targetMode: item.target_mode,
        targetValue: item.target_value,
        weightPercent: item.weight_percent,
        unit: item.unit,
      });
    } else {
      setEditingCriteria(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Nama wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      if (editingCriteria) {
        const { error } = await updateRemunerationCriteria(editingCriteria.id, formData);
        if (error) throw error;
        toast({ title: 'Program kerja diperbarui' });
      } else {
        const isAuto = ['target_pasien', 'kehadiran', 'kelengkapan_soap'].includes(formData.metricKey);
        const { error } = await createRemunerationCriteria({ ...formData, isAuto, sortOrder: criteria.length + 1 });
        if (error) throw error;
        toast({ title: 'Program kerja ditambahkan' });
      }
      setIsDialogOpen(false);
      await fetchBaseData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus program kerja "${item.name}"?`)) return;
    const { error } = await deleteRemunerationCriteria(item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    toast({ title: 'Program kerja dihapus' });
    fetchBaseData();
  };

  const handleSaveCommissionRate = async () => {
    if (!clinic?.id) return;
    const rate = Number(commissionRateInput);
    if (isNaN(rate) || rate < 0) {
      toast({ variant: 'destructive', title: 'Tarif tidak valid' });
      return;
    }
    setSavingCommissionRate(true);
    const { error } = await supabase
      .from('clinics')
      .update({ remuneration_commission_rate_percent: rate })
      .eq('id', clinic.id);
    setSavingCommissionRate(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    setClinic(prev => ({ ...prev, remuneration_commission_rate_percent: rate }));
    toast({ title: 'Tarif komisi disimpan' });
  };

  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight_percent || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="performance" className="flex items-center gap-1.5 data-[state=active]:bg-white rounded-lg px-3 py-2 text-xs">
            <Award className="w-3.5 h-3.5" /> Penilaian Performa
          </TabsTrigger>
          <TabsTrigger value="criteria" className="flex items-center gap-1.5 data-[state=active]:bg-white rounded-lg px-3 py-2 text-xs">
            <Settings2 className="w-3.5 h-3.5" /> Program Kerja & Bobot
          </TabsTrigger>
        </TabsList>

        {/* ================= PENILAIAN PERFORMA ================= */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs text-slate-500">
            <span>Setiap terapis dinilai berdasarkan periode gajinya masing-masing (lihat label periode di tiap kartu).</span>
            {loadingReports && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
            <div className={cn("flex items-center gap-1 shrink-0", !loadingReports && "ml-auto")}>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPeriodOffset(p => p + 1)}
                disabled={loadingReports}
                title="Periode sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="min-w-[110px] text-center font-semibold text-slate-600">
                {periodOffset === 0 ? 'Periode Berjalan' : `${periodOffset} Periode Lalu`}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPeriodOffset(p => Math.max(0, p - 1))}
                disabled={loadingReports || periodOffset === 0}
                title="Periode berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {criteria.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada program kerja. Tambahkan di tab "Program Kerja & Bobot".
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {therapists.map((t) => {
                const report = reports[t.id];
                const score = report?.overallScore ?? 0;
                const active = !!report?.isActive;
                return (
                  <div key={t.id} className="rounded-2xl overflow-hidden shadow-lg shadow-slate-900/5 border border-slate-200/60">
                    {/* Premium dark hero header */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5">
                      <div className="absolute -top-10 -right-6 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />
                      <div className="relative flex items-center gap-4">
                        <CircularScore value={score} active={active} size={84} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm truncate">{t.name}</p>
                          <p className="text-[11px] text-slate-400">{t.specialization || 'Fisioterapis'}</p>
                          {report && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              Periode {format(new Date(report.periodStart), 'dd MMM')} - {format(new Date(report.periodEnd), 'dd MMM yyyy')}
                            </p>
                          )}
                          <div className="mt-2">
                            {active ? (
                              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/30 gap-1 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Remunerasi Aktif
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/15 text-red-300 border-red-400/30 gap-1 text-[10px]">
                                <XCircle className="w-3 h-3" /> Belum Aktif
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metric rows */}
                    <div className="bg-white divide-y divide-slate-100">
                      {(report?.rows || []).map((row) => {
                        const Icon = METRIC_ICONS[row.metric_key] || Sparkles;
                        const achieved = row.achievementPercent >= 100;
                        return (
                          <div key={row.id} className="relative flex items-center gap-3 px-4 py-3">
                            <div className={cn(
                              "absolute left-0 top-0 bottom-0 w-1",
                              achieved ? "bg-emerald-400" : "bg-amber-400"
                            )} />
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-1",
                              achieved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate">{row.name}</p>
                              <p className="text-[10px] text-slate-400">Bobot {row.weight_percent}%</p>
                              {(row.proofUrls || (row.proofUrl ? [row.proofUrl] : [])).length > 0 && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                  {(row.proofUrls || [row.proofUrl]).map((url, i) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                                      <ImageIcon className="w-3 h-3" /> Lihat bukti {(row.proofUrls || []).length > 1 ? `#${i + 1}` : ''}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] font-mono text-slate-700">
                                {row.metric_key === 'target_pasien'
                                  ? `${row.realizationValue} / ${row.targetValue}`
                                  : <>{row.realizationValue}{row.unit === '%' ? '%' : ''} / {row.targetValue}{row.unit === '%' ? '%' : ` ${row.unit}`}</>}
                              </p>
                              <p className={cn("text-xs font-bold", achieved ? "text-emerald-600" : "text-amber-600")}>
                                {row.achievementPercent}%
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ================= PROGRAM KERJA & BOBOT ================= */}
        <TabsContent value="criteria" className="space-y-4 mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 shadow-lg">
            <div className="absolute -top-10 -right-6 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <Scale className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Program Kerja & Bobot Penilaian</p>
                  <p className="text-[11px] text-slate-400">
                    Total bobot saat ini: <span className={cn("font-semibold", totalWeight === 100 ? "text-emerald-400" : "text-amber-400")}>{totalWeight}%</span> (idealnya 100%)
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/20 border-0">
                <Plus className="w-4 h-4 mr-1.5" /> Tambah Program Kerja
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <Label className="text-xs font-semibold text-slate-700">Tarif Komisi Remunerasi (%)</Label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Nilai komisi terapis = tarif ini × profit periode (omzet − take home pay) × skor performa. Dipakai otomatis saat membuat slip gaji.
                </p>
              </div>
              <div className="flex items-end gap-2 shrink-0">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={commissionRateInput}
                  onChange={(e) => setCommissionRateInput(e.target.value)}
                  className="w-24 h-9 text-sm"
                />
                <Button size="sm" onClick={handleSaveCommissionRate} disabled={savingCommissionRate} className="bg-indigo-600 hover:bg-indigo-700 h-9">
                  {savingCommissionRate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {criteria.map((item) => {
              const Icon = METRIC_ICONS[item.metric_key] || Sparkles;
              return (
                <div key={item.id} className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-shadow duration-300 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{METRIC_LABELS[item.metric_key] || item.metric_key}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(item)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Target</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{item.target_value}{item.target_mode !== 'fixed_value' ? '%' : ''}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider">Bobot</p>
                      <p className="text-sm font-bold text-indigo-700 mt-0.5">{item.weight_percent}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Satuan</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{item.unit}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">{TARGET_MODE_LABELS[item.target_mode]}</p>
                </div>
              );
            })}
            {criteria.length === 0 && (
              <div className="md:col-span-2 text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-200">
                Belum ada program kerja.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= DIALOG FORM ================= */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCriteria ? 'Edit Program Kerja' : 'Tambah Program Kerja'}</DialogTitle>
            <DialogDescription>Atur nama, target, bobot, dan satuan penilaian performa terapis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nama Program Kerja</Label>
              <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Google Review" />
            </div>
            <div className="space-y-1.5">
              <Label>Sumber Data / Metrik</Label>
              <select
                value={formData.metricKey}
                onChange={(e) => setFormData(p => ({ ...p, metricKey: e.target.value }))}
                className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm"
                disabled={!!editingCriteria}
              >
                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Metode Target</Label>
                <select
                  value={formData.targetMode}
                  onChange={(e) => setFormData(p => ({ ...p, targetMode: e.target.value }))}
                  className="w-full h-10 rounded-md border border-slate-300 px-3 text-sm"
                >
                  {Object.entries(TARGET_MODE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Nilai Target</Label>
                <Input type="number" value={formData.targetValue} onChange={(e) => setFormData(p => ({ ...p, targetValue: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bobot (%)</Label>
                <Input type="number" value={formData.weightPercent} onChange={(e) => setFormData(p => ({ ...p, weightPercent: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Input value={formData.unit} onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))} placeholder="%, pasien, review, dst." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RemunerationManager;
