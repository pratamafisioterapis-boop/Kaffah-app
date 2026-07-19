import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Save, Loader2, Award, Settings2, CheckCircle2, XCircle, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getActivePhysiotherapists,
  getRemunerationCriteria,
  createRemunerationCriteria,
  updateRemunerationCriteria,
  deleteRemunerationCriteria,
  getRemunerationReport,
} from '@/lib/api';
import { format } from 'date-fns';
import { getTherapistPeriodRange } from '@/lib/utils';

const METRIC_LABELS = {
  target_pasien: 'Target Pasien (otomatis)',
  feedback_positif: 'Feedback Positif (manual terapis)',
  google_review: 'Google Review (manual terapis)',
  kehadiran: 'Kedisiplinan Kehadiran (otomatis)',
  kelengkapan_soap: 'Kelengkapan SOAP (otomatis)',
  custom: 'Kustom (manual terapis)',
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [therapistsRes, criteriaRes] = await Promise.all([
        getActivePhysiotherapists(),
        getRemunerationCriteria(),
      ]);
      setTherapists((therapistsRes.data || []).filter(t => t.remuneration_enabled !== false));
      setCriteria(criteriaRes.data || []);
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
      const entries = await Promise.all(therapists.map(async (t) => {
        const { startDate, endDate } = getTherapistPeriodRange(t);
        const periodStart = format(startDate, 'yyyy-MM-dd');
        const periodEnd = format(endDate, 'yyyy-MM-dd');
        const { data } = await getRemunerationReport(t.id, periodStart, periodEnd);
        return [t.id, data];
      }));
      setReports(Object.fromEntries(entries));
    } finally {
      setLoadingReports(false);
    }
  }, [therapists]);

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
            Setiap terapis dinilai berdasarkan periode gajinya masing-masing (lihat label periode di tiap kartu).
            {loadingReports && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
          </div>

          {criteria.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada program kerja. Tambahkan di tab "Program Kerja & Bobot".
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {therapists.map((t) => {
                const report = reports[t.id];
                return (
                  <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.specialization || 'Fisioterapis'}</p>
                        {report && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Periode {format(new Date(report.periodStart), 'dd MMM yyyy')} - {format(new Date(report.periodEnd), 'dd MMM yyyy')}
                          </p>
                        )}
                      </div>
                      {report && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-indigo-600">{report.overallScore}%</p>
                          {report.isActive ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Remunerasi Aktif
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1">
                              <XCircle className="w-3 h-3" /> Belum Aktif
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(report?.rows || []).map((row) => (
                        <div key={row.id} className="flex items-center justify-between px-4 py-2.5 text-xs gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-700 truncate">{row.name}</p>
                            <p className="text-slate-400">Bobot {row.weight_percent}%</p>
                            {row.proofUrl && (
                              <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline mt-0.5">
                                <ImageIcon className="w-3 h-3" /> Lihat bukti
                              </a>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-mono text-slate-800">{row.realizationValue}{row.unit === '%' ? '%' : ''} / {row.targetValue}{row.unit === '%' ? '%' : ''} {row.unit !== '%' ? row.unit : ''}</p>
                            <p className={row.achievementPercent >= 100 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                              {row.achievementPercent}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ================= PROGRAM KERJA & BOBOT ================= */}
        <TabsContent value="criteria" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Total bobot saat ini: <span className={totalWeight === 100 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{totalWeight}%</span> (idealnya 100%)
            </p>
            <Button size="sm" onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Program Kerja
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program Kerja</TableHead>
                  <TableHead>Sumber Data</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Bobot</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs text-slate-500">{METRIC_LABELS[item.metric_key] || item.metric_key}</TableCell>
                    <TableCell className="text-xs">
                      {item.target_value}{item.target_mode !== 'fixed_value' ? '%' : ''} <span className="text-slate-400">({TARGET_MODE_LABELS[item.target_mode]})</span>
                    </TableCell>
                    <TableCell>{item.weight_percent}%</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {criteria.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Belum ada program kerja.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
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
