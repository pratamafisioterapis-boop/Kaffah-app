import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Award, CheckCircle2, XCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  getRemunerationReport,
  upsertRemunerationRealization,
  uploadRemunerationProof,
} from '@/lib/api';
import { format } from 'date-fns';
import { getTherapistPeriodRange } from '@/lib/utils';

const MANUAL_METRICS = ['feedback_positif', 'google_review', 'custom'];

const TherapistRemuneration = ({ therapist }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const period = React.useMemo(() => {
    const { startDate, endDate } = getTherapistPeriodRange(therapist);
    return { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') };
  }, [therapist]);

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

  if (!report || (report.rows || []).length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
        Belum ada program kerja remunerasi yang diatur oleh owner.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-bold">Remunerasi Saya</h1>
            <p className="text-slate-400 text-xs mt-1">
              Periode {format(new Date(period.start), 'dd MMM yyyy')} - {format(new Date(period.end), 'dd MMM yyyy')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-300">{report.overallScore}%</p>
            {report.isActive ? (
              <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/40 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Remunerasi Aktif
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-100 border-red-400/40 text-[10px] gap-1">
                <XCircle className="w-3 h-3" /> Belum Aktif
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.rows.map((row) => {
          const isManual = MANUAL_METRICS.includes(row.metric_key);
          const draft = drafts[row.id] || { value: '', file: null };

          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{row.name}</p>
                  <p className="text-xs text-slate-400">Bobot {row.weight_percent}% • Target {row.targetValue}{row.unit === '%' ? '%' : ` ${row.unit}`}</p>
                </div>
                <Badge className={row.achievementPercent >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                  {row.achievementPercent}%
                </Badge>
              </div>

              {!isManual ? (
                <p className="text-sm text-slate-600">
                  Realisasi otomatis: <span className="font-semibold">{row.realizationValue}{row.unit === '%' ? '%' : ` ${row.unit}`}</span>
                </p>
              ) : (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={draft.value}
                      onChange={(e) => setDrafts(p => ({ ...p, [row.id]: { ...p[row.id], value: e.target.value } }))}
                      placeholder={`Realisasi (${row.unit})`}
                      className="h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveRealization(row)}
                      disabled={savingId === row.id}
                      className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                    >
                      {savingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-indigo-600">
                    <Upload className="w-3.5 h-3.5" />
                    {draft.file ? draft.file.name : 'Unggah bukti (screenshot)'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setDrafts(p => ({ ...p, [row.id]: { ...p[row.id], file: e.target.files?.[0] || null } }))}
                    />
                  </label>
                  {row.proofUrl && (
                    <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
                      <ImageIcon className="w-3.5 h-3.5" /> Lihat bukti tersimpan
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TherapistRemuneration;
