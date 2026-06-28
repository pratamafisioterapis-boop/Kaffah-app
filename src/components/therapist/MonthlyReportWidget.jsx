import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { FileBarChart2, Users, ClipboardCheck, ClipboardX, Loader2, ChevronDown, ChevronUp, X, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createMedicalRecord } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/**
 * Menghitung periode laporan:
 * - Muncul mulai tanggal 28 setiap bulan
 * - Periode: tgl 28 bulan lalu s/d tgl 27 bulan ini
 */
const getReportPeriod = () => {
  const now = new Date();
  const day = now.getDate();

  // Widget hanya aktif mulai tgl 28
  if (day < 28) return null;

  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // tgl 28 bulan lalu
  const startDate = new Date(year, month - 1, 28);
  // tgl 27 bulan ini
  const endDate = new Date(year, month, 27);

  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    labelStart: format(startDate, 'dd MMM yyyy', { locale: idLocale }),
    labelEnd: format(endDate, 'dd MMM yyyy', { locale: idLocale }),
  };
};

const MonthlyReportWidget = ({ therapistId, therapistUserId }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [soapModalOpen, setSoapModalOpen] = useState(false);
  const [unfilledRecaps, setUnfilledRecaps] = useState([]);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [soapForm, setSoapForm] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [savingSOAP, setSavingSOAP] = useState(false);
  const { toast } = useToast();

  const period = getReportPeriod();

  useEffect(() => {
    if (!therapistId || !period) {
      setLoading(false);
      return;
    }
    loadReport();
  }, [therapistId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      // 1. Ambil semua recaps dalam periode untuk therapist ini
      const { data: recaps, error: recapsError } = await supabase
        .from('daily_recaps')
        .select(`
          id,
          patient_type,
          actual_patient_id,
          patient_id,
          recap_date,
          service_type,
          actual_patient:patients!actual_patient_id ( id, full_name, medical_record_number ),
          main_patient:patients!patient_id ( id, full_name, medical_record_number )
        `)
        .eq('therapist_id', therapistId)
        .gte('recap_date', period.startDate)
        .lte('recap_date', period.endDate)
        .order('recap_date', { ascending: true });

      if (recapsError) throw recapsError;

      const allRecaps = recaps || [];
      const recapIds = allRecaps.map(r => r.id);

      // 2. Ambil label patient_type dari operational_options
      const { data: options } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'patient_type')
        .eq('is_active', true);

      const optionsMap = (options || []).reduce((acc, item) => {
        acc[item.id] = item.label;
        return acc;
      }, {});

      // 3. Hitung per tipe pasien
      const typeCountMap = {};
      allRecaps.forEach(r => {
        const typeLabel = optionsMap[r.patient_type] || r.patient_type || 'Tidak Diketahui';
        typeCountMap[typeLabel] = (typeCountMap[typeLabel] || 0) + 1;
      });

      // 4. Hitung unique pasien
      const uniquePatientIds = new Set();
      allRecaps.forEach(r => {
        const pid = r.actual_patient_id || r.patient_id;
        if (pid) uniquePatientIds.add(pid);
      });

      // 5. Cek SOAP yang sudah diisi vs belum
      let filledCount = 0;
      let unfilledCount = 0;

      if (recapIds.length > 0) {
        // Ambil medical_records yang ada untuk recap-recap ini (chunk 200)
        const chunkSize = 200;
        const filledRecapIds = new Set();

        for (let i = 0; i < recapIds.length; i += chunkSize) {
          const chunk = recapIds.slice(i, i + chunkSize);
          const { data: medRecords } = await supabase
            .from('medical_records')
            .select('daily_recap_id')
            .in('daily_recap_id', chunk);

          (medRecords || []).forEach(m => {
            if (m.daily_recap_id) filledRecapIds.add(m.daily_recap_id);
          });
        }

        filledCount = recapIds.filter(id => filledRecapIds.has(id)).length;
        unfilledCount = recapIds.length - filledCount;

        // Simpan detail recaps yang belum diisi SOAP
        const unfilledDetail = allRecaps
          .filter(r => !filledRecapIds.has(r.id))
          .map(r => ({
            id: r.id,
            recap_date: r.recap_date,
            service_type: r.service_type,
            patient_id: r.actual_patient_id || r.patient_id,
            patient_name: r.actual_patient?.full_name || r.main_patient?.full_name || 'Pasien Tidak Diketahui',
            medical_record_number: r.actual_patient?.medical_record_number || r.main_patient?.medical_record_number || '-',
          }));
        setUnfilledRecaps(unfilledDetail);
      }

      setReport({
        totalVisits: allRecaps.length,
        totalUniquePatients: uniquePatientIds.size,
        typeBreakdown: Object.entries(typeCountMap).sort((a, b) => b[1] - a[1]),
        filledSoap: filledCount,
        unfilledSoap: unfilledCount,
      });
    } catch (err) {
      console.error('MonthlyReportWidget error:', err);
    } finally {
      setLoading(false);
    }
  };
const handleOpenSoapModal = () => {
    if (!report || report.unfilledSoap === 0) return;
    setSelectedRecap(null);
    setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });
    setSoapModalOpen(true);
  };

  const handleSelectRecap = (recap) => {
    setSelectedRecap(recap);
    setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });
  };

  const handleSaveSOAP = async () => {
    if (!selectedRecap) return;
    if (!soapForm.subjective || !soapForm.objective || !soapForm.assessment || !soapForm.plan) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Semua field SOAP wajib diisi.' });
      return;
    }
    setSavingSOAP(true);
    try {
      const payload = {
        patient_id: selectedRecap.patient_id,
        daily_recap_id: selectedRecap.id,
        subjective: soapForm.subjective,
        objective: soapForm.objective,
        assessment: soapForm.assessment,
        plan: soapForm.plan,
        record_type: 'DAILY_EVALUATION',
        created_by: therapistUserId,
      };
      const { error } = await createMedicalRecord(payload);
      if (error) throw new Error(error.message);

      toast({ title: 'SOAP Tersimpan!', description: `SOAP untuk ${selectedRecap.patient_name} berhasil disimpan.` });

      // Update state: hapus dari daftar unfilled
      const updatedUnfilled = unfilledRecaps.filter(r => r.id !== selectedRecap.id);
      setUnfilledRecaps(updatedUnfilled);
      setSelectedRecap(null);
      setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });

      // Update report count
      setReport(prev => ({
        ...prev,
        filledSoap: prev.filledSoap + 1,
        unfilledSoap: prev.unfilledSoap - 1,
      }));

      if (updatedUnfilled.length === 0) {
        setSoapModalOpen(false);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: err.message });
    } finally {
      setSavingSOAP(false);
    }
  };

  // Jika bukan tgl 28+, jangan tampilkan widget
  if (!period) return null;
  

  return (
    <>
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full px-5 pt-5 pb-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FileBarChart2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-700">Laporan Bulanan</p>
            <p className="text-[11px] text-slate-400">
              {period.labelStart} – {period.labelEnd}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
            Baru Tersedia
          </span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <>
          <div className="h-px bg-slate-50 mx-5" />

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : !report ? (
            <p className="text-center text-sm text-slate-400 py-8">Gagal memuat laporan.</p>
          ) : (
            <div className="p-5 space-y-5">

              {/* Ringkasan Total */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{report.totalVisits}</p>
                  <p className="text-[11px] text-indigo-500 mt-0.5">Total Kunjungan</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-4 h-4 text-slate-500" />
                    <p className="text-2xl font-bold text-slate-700">{report.totalUniquePatients}</p>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pasien Ditangani</p>
                </div>
              </div>

              {/* Per Tipe Pasien */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Jumlah per Tipe Pasien
                </p>
                <div className="space-y-2">
                  {report.typeBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Tidak ada data tipe pasien.</p>
                  ) : (
                    report.typeBreakdown.map(([type, count]) => {
                      const pct = report.totalVisits > 0 ? Math.round((count / report.totalVisits) * 100) : 0;
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-xs text-slate-600 truncate">{type}</span>
                              <span className="text-xs font-semibold text-slate-700 ml-2 shrink-0">
                                {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Status SOAP */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Status SOAP
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn(
                    "rounded-xl p-3 flex items-center gap-3",
                    report.filledSoap > 0 ? "bg-emerald-50" : "bg-slate-50"
                  )}>
                    <ClipboardCheck className={cn(
                      "w-5 h-5 shrink-0",
                      report.filledSoap > 0 ? "text-emerald-500" : "text-slate-300"
                    )} />
                    <div>
                      <p className={cn(
                        "text-xl font-bold",
                        report.filledSoap > 0 ? "text-emerald-700" : "text-slate-500"
                      )}>{report.filledSoap}</p>
                      <p className="text-[11px] text-slate-400">SOAP Terisi</p>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenSoapModal}
                    disabled={report.unfilledSoap === 0}
                    className={cn(
                      "rounded-xl p-3 flex items-center gap-3 w-full text-left transition-all",
                      report.unfilledSoap > 0
                        ? "bg-red-50 hover:bg-red-100 cursor-pointer active:scale-95"
                        : "bg-slate-50 cursor-default opacity-60"
                    )}
                  >
                    <ClipboardX className={cn(
                      "w-5 h-5 shrink-0",
                      report.unfilledSoap > 0 ? "text-red-500" : "text-slate-300"
                    )} />
                    <div>
                      <p className={cn(
                        "text-xl font-bold",
                        report.unfilledSoap > 0 ? "text-red-700" : "text-slate-500"
                      )}>{report.unfilledSoap}</p>
                      <p className="text-[11px] text-slate-400">
                        SOAP Belum Diisi
                        {report.unfilledSoap > 0 && (
                          <span className="ml-1 text-red-400 font-medium">→ Isi Sekarang</span>
                        )}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>

    {/* ── Modal SOAP Belum Diisi ── */}
    {soapModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header Modal */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Isi SOAP yang Belum Diisi</h3>
              <p className="text-xs text-slate-400 mt-0.5">{period.labelStart} – {period.labelEnd}</p>
            </div>
            <button
              onClick={() => { setSoapModalOpen(false); setSelectedRecap(null); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">

            {/* Panel Kiri: Daftar Pasien Belum Diisi */}
            <div className="w-52 shrink-0 border-r border-slate-100 overflow-y-auto bg-slate-50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-2">
                {unfilledRecaps.length} Kunjungan
              </p>
              {unfilledRecaps.map(recap => (
                <button
                  key={recap.id}
                  onClick={() => handleSelectRecap(recap)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-slate-100 transition-colors",
                    selectedRecap?.id === recap.id
                      ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                      : "hover:bg-white"
                  )}
                >
                  <p className="text-xs font-semibold text-slate-700 truncate">{recap.patient_name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] text-slate-400">
                      {format(new Date(recap.recap_date), 'dd MMM yyyy', { locale: idLocale })}
                    </span>
                  </div>
                  {recap.medical_record_number && recap.medical_record_number !== '-' && (
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{recap.medical_record_number}</p>
                  )}
                </button>
              ))}
            </div>

            {/* Panel Kanan: Form SOAP */}
            <div className="flex-1 overflow-y-auto">
              {!selectedRecap ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                  <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-400">Pilih kunjungan di sebelah kiri</p>
                  <p className="text-xs text-slate-300 mt-1">untuk mengisi SOAP-nya</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* Info Pasien */}
                  <div className="bg-indigo-50 rounded-xl p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-indigo-700">{selectedRecap.patient_name}</p>
                      <p className="text-[10px] text-indigo-400">
                        {format(new Date(selectedRecap.recap_date), 'dd MMMM yyyy', { locale: idLocale })}
                        {selectedRecap.service_type && ` • ${selectedRecap.service_type}`}
                      </p>
                    </div>
                  </div>

                  {/* SOAP Fields */}
                  {[
                    { key: 'subjective',  label: 'Subjective',  short: 'S', placeholder: 'Keluhan pasien, riwayat penyakit...', accent: 'border-l-blue-400',   badge: 'bg-blue-500',   labelColor: 'text-blue-700'   },
                    { key: 'objective',   label: 'Objective',   short: 'O', placeholder: 'Hasil observasi, pemeriksaan fisik...', accent: 'border-l-teal-400',   badge: 'bg-teal-500',   labelColor: 'text-teal-700'   },
                    { key: 'assessment',  label: 'Assessment',  short: 'A', placeholder: 'Analisis, diagnosis fisioterapi...',   accent: 'border-l-violet-400', badge: 'bg-violet-500', labelColor: 'text-violet-700' },
                    { key: 'plan',        label: 'Plan',        short: 'P', placeholder: 'Rencana terapi, edukasi...',           accent: 'border-l-rose-400',   badge: 'bg-rose-500',   labelColor: 'text-rose-700'   },
                  ].map(field => (
                    <div key={field.key} className={`bg-white rounded-xl border-l-4 ${field.accent} border border-slate-100 px-3 py-2.5`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-5 h-5 rounded-md ${field.badge} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                          {field.short}
                        </span>
                        <label className={`text-xs font-semibold ${field.labelColor}`}>{field.label}</label>
                      </div>
                      <textarea
                        className="w-full bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 min-h-[72px] placeholder:text-slate-300"
                        placeholder={field.placeholder}
                        value={soapForm[field.key]}
                        onChange={e => setSoapForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    </div>
                  ))}

                  {/* Tombol Simpan */}
                  <button
                    onClick={handleSaveSOAP}
                    disabled={savingSOAP}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {savingSOAP ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Simpan SOAP
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default MonthlyReportWidget;