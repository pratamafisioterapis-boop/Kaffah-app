import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Trash2, FileText,
  BarChart3, History, Save, ShieldCheck, Fuel, HeartPulse, FileCheck2, User,
  Sparkles, Clock, CalendarDays, Stethoscope,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { parseInsentifDokterPdf, generateInsentifDokterExcel, buildInsentifDokterReport } from '@/utils/insentifDokterParser';
import {
  saveInsentifDokterHistory, listInsentifDokterHistory,
  getInsentifDokterHistoryDetail, deleteInsentifDokterHistory,
} from '@/utils/insentifDokterHistory';

const rupiah = (n) => `Rp ${new Intl.NumberFormat('id-ID').format(n || 0)}`;

const nowMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatPeriodeLabel = (monthValue) => {
  if (!monthValue) return '';
  const [y, m] = monthValue.split('-').map(Number);
  if (!y || !m) return monthValue;
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Tema visual per kategori asuransi ──────────────────────────────────────
const CATEGORY_THEME = {
  bpjs: { label: 'BPJS', icon: ShieldCheck, gradient: 'from-sky-600 via-blue-600 to-cyan-600', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  pertamina: { label: 'Pertamina', icon: Fuel, gradient: 'from-red-600 via-rose-600 to-red-700', chip: 'bg-red-50 text-red-700 border-red-200' },
  pertamedika: { label: 'Pertamedika', icon: HeartPulse, gradient: 'from-teal-600 via-emerald-600 to-teal-700', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  jaminan: { label: 'Jaminan', icon: FileCheck2, gradient: 'from-indigo-600 via-violet-600 to-purple-700', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  pribadi: { label: 'Pribadi', icon: User, gradient: 'from-amber-500 via-orange-500 to-amber-600', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const StatTile = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-xl font-extrabold text-slate-800 mt-1 tabular-nums">{value}</p>
  </div>
);

// ── Tabel rekap BPJS (dipisah: dengan / tanpa Konsul Dokter di hari sama) ──
const BpjsTable = ({ data }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50/80 text-slate-500">
          <th rowSpan={2} className="text-left px-4 py-2.5 font-semibold align-bottom border-b border-slate-200">Deskripsi</th>
          <th rowSpan={2} className="text-right px-3 py-2.5 font-semibold align-bottom border-b border-slate-200">Jumlah</th>
          <th rowSpan={2} className="text-right px-4 py-2.5 font-semibold align-bottom border-b border-slate-200">Total Nilai</th>
          <th colSpan={2} className="text-center px-3 py-1.5 font-semibold border-b border-l border-slate-200 bg-emerald-50/60 text-emerald-700">Hari Ada Konsul Dokter</th>
          <th colSpan={2} className="text-center px-3 py-1.5 font-semibold border-b border-l border-slate-200 bg-slate-100/70 text-slate-600">Hari Tanpa Konsul Dokter</th>
        </tr>
        <tr className="bg-slate-50/80 text-slate-500">
          <th className="text-right px-3 py-1.5 font-medium border-l border-slate-200">Jml</th>
          <th className="text-right px-3 py-1.5 font-medium">Nilai</th>
          <th className="text-right px-3 py-1.5 font-medium border-l border-slate-200">Jml</th>
          <th className="text-right px-3 py-1.5 font-medium">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {data.byDeskripsi.map((row) => (
          <tr
            key={row.deskripsi}
            className={`border-t border-slate-100 hover:bg-slate-50/70 transition-colors ${row.isKonsul ? 'bg-indigo-50/30' : ''}`}
          >
            <td className="px-4 py-2 text-slate-700 font-medium">
              <span className="flex items-center gap-1.5">
                {row.isKonsul && <Stethoscope className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                {row.deskripsi}
              </span>
            </td>
            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.count}</td>
            <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{rupiah(row.total)}</td>
            <td className="px-3 py-2 text-right text-emerald-700 border-l border-slate-100 tabular-nums">{row.denganKonsulDokter.count || '-'}</td>
            <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">{row.denganKonsulDokter.total ? rupiah(row.denganKonsulDokter.total) : '-'}</td>
            <td className="px-3 py-2 text-right text-slate-500 border-l border-slate-100 tabular-nums">{row.tanpaKonsulDokter.count || '-'}</td>
            <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{row.tanpaKonsulDokter.total ? rupiah(row.tanpaKonsulDokter.total) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DeskripsiTable = ({ data }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-sm">
    <table className="w-full text-sm">
      <thead className="bg-slate-50/80">
        <tr>
          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 border-b border-slate-200">Deskripsi</th>
          <th className="text-right px-3 py-2.5 font-semibold text-slate-500 border-b border-slate-200">Jumlah</th>
          <th className="text-right px-4 py-2.5 font-semibold text-slate-500 border-b border-slate-200">Total Nilai</th>
        </tr>
      </thead>
      <tbody>
        {data.byDeskripsi.map((row) => (
          <tr key={row.deskripsi} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
            <td className="px-4 py-2 text-slate-700">{row.deskripsi}</td>
            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.count}</td>
            <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{rupiah(row.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CategoryPanel = ({ categoryKey, data, isBpjs }) => {
  const theme = CATEGORY_THEME[categoryKey];
  const Icon = theme.icon;
  if (!data.count) {
    return <p className="text-sm text-slate-500 py-10 text-center">Tidak ada data untuk kategori ini.</p>;
  }
  return (
    <div className="space-y-4">
      <div className={`rounded-2xl bg-gradient-to-r ${theme.gradient} p-4 sm:p-5 shadow-lg relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">{theme.label}</p>
            <p className="text-white/80 text-xs">{data.count} transaksi &middot; {rupiah(data.total)}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Jumlah Transaksi" value={data.count} />
        <StatTile label="Total Nilai" value={rupiah(data.total)} />
      </div>
      {isBpjs ? <BpjsTable data={data} /> : <DeskripsiTable data={data} />}
    </div>
  );
};

const InsentifLaporan = ({ report, meta }) => {
  const jaminanSubtypes = useMemo(
    () => (report ? Object.entries(report.jaminan).filter(([, v]) => v.count > 0) : []),
    [report]
  );

  if (!report || (!report.bpjs.count && jaminanSubtypes.length === 0)) {
    return (
      <div className="py-14 text-center text-slate-500">
        <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">Belum ada data. Upload PDF di tab "Konversi", lalu simpan ke riwayat di sini.</p>
      </div>
    );
  }

  const defaultTab = report.bpjs.count ? 'bpjs' : jaminanSubtypes[0]?.[0];

  return (
    <div className="space-y-4">
      {meta && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pb-1">
          {meta.periode_label && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
              <CalendarDays className="w-3.5 h-3.5" /> {meta.periode_label}
            </span>
          )}
          {meta.created_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> disimpan {formatDateTime(meta.created_at)}
            </span>
          )}
          {meta.file_names?.length > 0 && (
            <span className="text-slate-400">&middot; {meta.file_names.length} file</span>
          )}
        </div>
      )}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-100/80 p-1.5">
          {report.bpjs.count > 0 && (
            <TabsTrigger value="bpjs" className="gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> BPJS
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{report.bpjs.count}</Badge>
            </TabsTrigger>
          )}
          {jaminanSubtypes.map(([key, v]) => {
            const Icon = CATEGORY_THEME[key].icon;
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {v.label}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{v.count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {report.bpjs.count > 0 && (
          <TabsContent value="bpjs" className="mt-4">
            <CategoryPanel categoryKey="bpjs" data={report.bpjs} isBpjs />
          </TabsContent>
        )}
        {jaminanSubtypes.map(([key, v]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <CategoryPanel categoryKey={key} data={v} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

// ── Riwayat: daftar laporan tersimpan per bulan ────────────────────────────
const HistoryList = ({ history, loading, selectedId, onSelect, onDelete }) => {
  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-500 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Memuat riwayat...</div>;
  }
  if (!history.length) {
    return <p className="text-sm text-slate-400 py-4">Belum ada riwayat tersimpan.</p>;
  }
  return (
    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
      {history.map((h) => {
        const active = selectedId === h.id;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id)}
            className={`group text-left rounded-xl border px-3.5 py-2.5 transition-all ${
              active
                ? 'border-indigo-400 bg-gradient-to-r from-indigo-50 to-violet-50 shadow-sm ring-1 ring-indigo-200'
                : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{h.periode_label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(h.created_at)} &middot; {h.file_names?.length || 0} file</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs font-bold text-slate-600 tabular-nums">{rupiah(h.grand_total)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onDelete(h.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

const InsentifDokterConverter = () => {
  const { toast } = useToast();
  const { clinicName, userDetails, user } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const fileInputRef = useRef(null);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]); // array of { format, fileName, rows, summary, verification }
  const [periodeMonth, setPeriodeMonth] = useState(nowMonthValue());

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetails, setHistoryDetails] = useState({}); // id -> full row (report_data)
  const [selectedHistoryId, setSelectedHistoryId] = useState(null); // null = tampilan live
  const [savingHistory, setSavingHistory] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState(null);

  const periodeLabel = formatPeriodeLabel(periodeMonth);

  const refreshHistory = useCallback(async () => {
    if (!clinicId) return;
    setHistoryLoading(true);
    try {
      const data = await listInsentifDokterHistory(clinicId);
      setHistory(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal memuat riwayat', description: err.message });
    } finally {
      setHistoryLoading(false);
    }
  }, [clinicId, toast]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      toast({ variant: 'destructive', title: 'File tidak valid', description: 'Hanya file PDF yang didukung.' });
      return;
    }

    setProcessing(true);
    const newResults = [];
    for (const file of files) {
      try {
        const res = await parseInsentifDokterPdf(file);
        newResults.push(res);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: `Gagal memproses ${file.name}`,
          description: err.message || 'Terjadi kesalahan saat membaca PDF.',
        });
      }
    }
    setResults((prev) => [...prev, ...newResults]);
    setSelectedHistoryId(null);
    setProcessing(false);

    newResults.forEach((res) => {
      if (!res.verification.isVerified && !res.verification.isMinorRounding) {
        toast({
          variant: 'destructive',
          title: `⚠️ Total tidak cocok: ${res.fileName}`,
          description: `Selisih Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}. Mohon periksa manual sebelum digunakan.`,
        });
      } else if (res.verification.isMinorRounding) {
        toast({
          title: `ℹ️ Selisih pembulatan kecil: ${res.fileName}`,
          description: `Selisih Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))} — ini pembulatan internal dari PDF sumber (bukan kesalahan ekstraksi), data baris tetap akurat.`,
        });
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (idx) => {
    setResults((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExport = () => {
    if (!results.length) return;
    try {
      const fileName = generateInsentifDokterExcel(results, periodeLabel);
      toast({ title: 'Excel berhasil dibuat', description: fileName });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat Excel', description: err.message });
    }
  };

  const liveReport = useMemo(() => (results.length ? buildInsentifDokterReport(results) : null), [results]);

  const handleSaveHistory = async () => {
    if (!liveReport) {
      toast({ variant: 'destructive', title: 'Belum ada data', description: 'Upload PDF terlebih dahulu sebelum menyimpan ke riwayat.' });
      return;
    }
    if (!clinicId) {
      toast({ variant: 'destructive', title: 'Clinic tidak ditemukan', description: 'Tidak bisa menyimpan riwayat tanpa data clinic pada akun ini.' });
      return;
    }
    setSavingHistory(true);
    try {
      const saved = await saveInsentifDokterHistory({
        clinicId,
        userId: user?.id,
        periodeLabel,
        periodeMonth: `${periodeMonth}-01`,
        fileNames: results.map((r) => r.fileName),
        report: liveReport,
      });
      setHistory((prev) => [saved, ...prev]);
      toast({ title: 'Riwayat tersimpan', description: `Laporan periode ${periodeLabel} berhasil disimpan.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan riwayat', description: err.message });
    } finally {
      setSavingHistory(false);
    }
  };

  const handleSelectHistory = async (id) => {
    if (historyDetails[id]) {
      setSelectedHistoryId(id);
      return;
    }
    setLoadingDetailId(id);
    try {
      const detail = await getInsentifDokterHistoryDetail(id);
      setHistoryDetails((prev) => ({ ...prev, [id]: detail }));
      setSelectedHistoryId(id);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal memuat detail riwayat', description: err.message });
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleDeleteHistory = async (id) => {
    try {
      await deleteInsentifDokterHistory(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      setHistoryDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedHistoryId === id) setSelectedHistoryId(null);
      toast({ title: 'Riwayat dihapus' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus riwayat', description: err.message });
    }
  };

  const activeReport = selectedHistoryId ? historyDetails[selectedHistoryId]?.report_data : liveReport;
  const activeMeta = selectedHistoryId
    ? historyDetails[selectedHistoryId]
    : (liveReport ? { periode_label: periodeLabel, file_names: results.map((r) => r.fileName), created_at: null } : null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Banner — desktop & PWA */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg`}>
            <FileSpreadsheet className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-amber-300`} />
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-amber-300/80 uppercase mb-1`}>{clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Konversi & Laporan Insentif Dokter</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>
              Upload PDF "Perincian Insentif Dokter" (PWTT/PWT atau BPJS Individu), konversi ke Excel, dan simpan laporannya sebagai riwayat bulanan
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="konversi" className="w-full">
        <TabsList>
          <TabsTrigger value="konversi" className="gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Konversi
          </TabsTrigger>
          <TabsTrigger value="laporan" className="gap-1.5">
            <BarChart3 className="w-4 h-4" /> Laporan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="konversi" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
                  Periode:
                </label>
                <input
                  type="month"
                  value={periodeMonth}
                  onChange={(e) => setPeriodeMonth(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-white text-sm outline-none flex-1 max-w-xs"
                />
              </div>

              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
                }}
              >
                {processing ? (
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                ) : (
                  <Upload className="w-10 h-10 text-slate-400 mb-3" />
                )}
                <h3 className="font-semibold text-slate-700">
                  {processing ? 'Memproses PDF...' : 'Klik atau drag & drop PDF di sini'}
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Bisa upload banyak file sekaligus, boleh campur kedua format (PWTT/PWT & BPJS Individu)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
                  disabled={processing}
                />
              </div>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((res, idx) => (
                <Card
                  key={idx}
                  className={
                    res.verification.isVerified ? 'border-green-200' :
                    res.verification.isMinorRounding ? 'border-amber-300' : 'border-red-300'
                  }
                >
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-slate-800">{res.fileName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Format: {res.format === 'A' ? 'PWTT/PWT (Pasien Jaminan)' : 'BPJS Individu'}
                            {' '}&middot; {res.rows.length} baris data
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 text-sm">
                            {res.verification.isVerified ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-green-700 font-medium">
                                  Total cocok dengan PDF (Rp {new Intl.NumberFormat('id-ID').format(res.verification.printedTotal)})
                                </span>
                              </>
                            ) : res.verification.isMinorRounding ? (
                              <>
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="text-amber-700 font-medium">
                                  Selisih pembulatan kecil Rp {new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}
                                  {' '}(dari PDF sumber, bukan kesalahan ekstraksi — data baris tetap akurat).
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-red-700 font-medium">
                                  Total tidak cocok — selisih Rp {new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}.
                                  Mohon periksa manual.
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  onClick={handleSaveHistory}
                  disabled={savingHistory}
                  variant="outline"
                  className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {savingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan ke Riwayat
                </Button>
                <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Download Excel ({results.length} file)
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="laporan" className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <History className="w-4 h-4 text-indigo-500" /> Riwayat Laporan
                </h3>
                {liveReport && (
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryId(null)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      !selectedHistoryId
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Data Live ({periodeLabel})
                  </button>
                )}
              </div>
              <HistoryList
                history={history}
                loading={historyLoading}
                selectedId={selectedHistoryId}
                onSelect={handleSelectHistory}
                onDelete={handleDeleteHistory}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="pt-6">
              {loadingDetailId ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-14">
                  <Loader2 className="w-5 h-5 animate-spin" /> Memuat laporan tersimpan...
                </div>
              ) : (
                <InsentifLaporan report={activeReport} meta={activeMeta} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InsentifDokterConverter;
