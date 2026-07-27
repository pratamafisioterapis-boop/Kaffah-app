import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Save, Award, CheckCircle2, XCircle, Camera, FolderOpen, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  getRemunerationReport,
  upsertRemunerationRealization,
  uploadRemunerationProof,
} from '@/lib/api';
import { format, addDays } from 'date-fns';
import { getTherapistPeriodRange } from '@/lib/utils';
import { cn } from '@/lib/utils';
import CircularScore from '@/components/shared/CircularScore';

const MANUAL_METRICS = ['feedback_positif', 'google_review', 'custom'];

const ManualMetricUploader = ({ row, draft, onChange, onSave, saving }) => {
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={draft.value}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          placeholder={`Realisasi (${row.unit})`}
          className="h-10 text-sm rounded-xl"
        />
        <Button
          size="icon"
          onClick={onSave}
          disabled={saving}
          className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" /> Ambil Foto
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" /> Pilih File
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onChange({ ...draft, file: e.target.files?.[0] || null })}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange({ ...draft, file: e.target.files?.[0] || null })}
        />
      </div>

      {draft.file && (
        <p className="text-[11px] text-indigo-600 truncate flex items-center gap-1">
          <ImageIcon className="w-3 h-3 shrink-0" /> {draft.file.name}
        </p>
      )}

      {row.proofUrl && !draft.file && (
        <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-indigo-600 hover:underline">
          <ImageIcon className="w-3 h-3" /> Lihat bukti tersimpan
        </a>
      )}
    </div>
  );
};

const TherapistRemuneration = ({ therapist }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [viewingPrevious, setViewingPrevious] = useState(false);

  const currentPeriod = React.useMemo(() => {
    const { startDate, endDate } = getTherapistPeriodRange(therapist);
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd'), startDateObj: startDate };
  }, [therapist]);

  const previousPeriod = React.useMemo(() => {
    const { startDate, endDate } = getTherapistPeriodRange(therapist, addDays(currentPeriod.startDateObj, -1));
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [therapist, currentPeriod]);

  // Terapis masih boleh mengisi realisasi periode sebelumnya sampai batas
  // tanggal mulai siklus baru (mis. periode 28-27, batasnya tgl 28) — lewat
  // dari tanggal itu, periode sebelumnya terkunci.
  const canFillPrevious = React.useMemo(() => {
    const startDay = therapist?.period_start_day ?? 28;
    return new Date().getDate() === startDay;
  }, [therapist]);

  const period = React.useMemo(
    () => ((viewingPrevious && canFillPrevious) ? previousPeriod : currentPeriod),
    [viewingPrevious, canFillPrevious, previousPeriod, currentPeriod]
  );

  const fetchReport = useCallback(async () => {
    if (!therapist?.id) return;
    setLoading(true);
    try {
      const { data } = await getRemunerationReport(therapist.id, period.start, period.end);
      setReport(data);
      const nextDrafts = {};
      (data?.rows || []).forEach(row => {
        if (MANUAL_METRICS.includes(row.metric_key)) {
          nextDrafts[row.id] = { value: row.realizationValue || '', file: null };
        }
      });
      setDrafts(nextDrafts);
    } finally {
      setLoading(false);
    }
  }, [therapist, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    if (!canFillPrevious && viewingPrevious) setViewingPrevious(false);
  }, [canFillPrevious, viewingPrevious]);

  const handleSaveRealization = async (row) => {
    const draft = drafts[row.id];
    if (!draft || draft.value === '') {
      toast({ variant: 'destructive', title: 'Isi nilai realisasi terlebih dahulu' });
      return;
    }
    setSavingId(row.id);
    try {
      let proofUrl = row.proofUrl || null;
      if (draft.file) {
        const { data: uploadedUrl, error: uploadError } = await uploadRemunerationProof(draft.file, therapist.id);
        if (uploadError) throw uploadError;
        proofUrl = uploadedUrl;
      }

      const { error } = await upsertRemunerationRealization({
        therapistId: therapist.id,
        criteriaId: row.id,
        periodStart: period.start,
        periodEnd: period.end,
        value: Number(draft.value),
        proofUrl,
      });
      if (error) throw error;

      toast({ title: 'Realisasi tersimpan' });
      fetchReport();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (therapist && therapist.remuneration_enabled === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm max-w-md mx-auto">
        Program remunerasi belum diaktifkan untuk akun Anda. Hubungi owner klinik untuk informasi lebih lanjut.
      </div>
    );
  }

  if (!report || (report.rows || []).length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
        Belum ada program kerja remunerasi yang diatur oleh owner.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {canFillPrevious && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Hari terakhir mengisi realisasi periode sebelumnya</p>
            <p className="text-[11px] text-amber-600">
              Periode {format(new Date(previousPeriod.start), 'dd MMM')} - {format(new Date(previousPeriod.end), 'dd MMM yyyy')} bisa diisi sampai hari ini saja.
            </p>
          </div>
          <div className="flex rounded-xl border border-amber-200 bg-white p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewingPrevious(false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                !viewingPrevious ? "bg-amber-600 text-white" : "text-amber-700"
              )}
            >
              Periode Ini
            </button>
            <button
              type="button"
              onClick={() => setViewingPrevious(true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                viewingPrevious ? "bg-amber-600 text-white" : "text-amber-700"
              )}
            >
              Periode Sebelumnya
            </button>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-16 -right-10 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-indigo-300" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-indigo-300 uppercase">Remunerasi Saya</p>
            <p className="text-xs text-slate-400">
              Periode {format(new Date(period.start), 'dd MMM yyyy')} - {format(new Date(period.end), 'dd MMM yyyy')}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-6">
          <CircularScore value={report.overallScore} active={report.isActive} />
          <div className="space-y-2">
            {report.isActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/30 gap-1.5 px-3 py-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Remunerasi Aktif
              </Badge>
            ) : (
              <Badge className="bg-red-500/15 text-red-300 border-red-400/30 gap-1.5 px-3 py-1 text-xs">
                <XCircle className="w-3.5 h-3.5" /> Belum Aktif
              </Badge>
            )}
            <p className="text-xs text-slate-400 max-w-xs">
              Remunerasi aktif otomatis setiap bulan jika target pasien tercapai.
            </p>
          </div>
        </div>
      </div>

      {/* CRITERIA CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {report.rows.map((row) => {
          const isManual = MANUAL_METRICS.includes(row.metric_key);
          const draft = drafts[row.id] || { value: '', file: null };
          const achieved = row.achievementPercent >= 100;

          return (
            <div
              key={row.id}
              className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-shadow duration-300 p-4 space-y-1 overflow-hidden"
            >
              <div className={cn(
                "absolute top-0 left-0 h-1 w-full",
                achieved ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-amber-400 to-amber-500"
              )} />

              <div className="flex items-start justify-between pt-1 gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{row.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">Bobot {row.weight_percent}% • Target {row.targetValue}{row.metric_key === 'target_pasien' ? '' : (row.unit === '%' ? '%' : ` ${row.unit}`)}</p>
                </div>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-lg shrink-0",
                  achieved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                )}>
                  {row.achievementPercent}%
                </span>
              </div>

              {!isManual ? (
                <p className="text-sm text-slate-600 pt-2">
                  Realisasi otomatis: <span className="font-semibold text-slate-800">{row.realizationValue}{row.metric_key === 'target_pasien' ? '' : (row.unit === '%' ? '%' : ` ${row.unit}`)}</span>
                </p>
              ) : (
                <ManualMetricUploader
                  row={row}
                  draft={draft}
                  onChange={(next) => setDrafts(p => ({ ...p, [row.id]: next }))}
                  onSave={() => handleSaveRealization(row)}
                  saving={savingId === row.id}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TherapistRemuneration;
