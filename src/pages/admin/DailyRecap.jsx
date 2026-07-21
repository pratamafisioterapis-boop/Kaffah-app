import { useAuth } from '@/contexts/SupabaseAuthContext';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Loader2, Plus, Search, X, Clock, Play, Square, 
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, RefreshCcw, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  getPatients,
  setDailyRecapStartTime,
  setDailyRecapEndTime,
  getAllRecapOptions
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { 
  formatDateIndonesian, 
  formatTime, 
  getCurrentTimeWithSeconds, 
  displayDateID, 
  parseDateFromDisplay,
  isValidDateFormat
} from '@/lib/dateFormatHelpers';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAppointmentState } from '@/contexts/AppointmentStateContext'; 
import { supabase } from '@/lib/customSupabaseClient';
import DatePicker from '@/components/DatePicker';
import DailyRecapModal from '@/components/shared/DailyRecapModal';
import DailyRecapDetailModal from '@/components/shared/DailyRecapDetailModal';

const getTherapistName = (recap) => {
  if (recap.therapist_name && recap.therapist_name !== '-') {
    return recap.therapist_name;
  }
  if (recap.therapist?.name) {
    return recap.therapist.name;
  }
  return '-';
};

const renderPatientName = (recap) => {
  const ownerName = recap.patients?.full_name;
  const actualName = recap.actual_patients?.full_name;
  const guestName = recap.guest_name;

  const mainName = actualName || ownerName || guestName || 'Nama tidak tersedia';
  
  const isDifferent = recap.actual_patient_id && recap.patient_id && recap.actual_patient_id !== recap.patient_id;
  
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="font-bold text-slate-900">{mainName}</span>
      {isDifferent && ownerName && (
        <span className="text-[10px] text-slate-500 font-medium mt-0.5">
          (Paket: {ownerName})
        </span>
      )}
    </div>
  );
};

const DailyRecap = ({ hideControls = false }) => {
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const isMounted = useRef(true);
  const { lastSyncTime } = useAppointmentState(); 
  
  const [recaps, setRecaps] = useState([]);
  
  // Cache for options (diagnosa, service_type, etc.)
  const [optionsMap, setOptionsMap] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const oneYearAgoDate = new Date();
    oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
    const defaultRange = { start: oneYearAgoDate.toISOString().split('T')[0], end: today };
    try {
      const saved = localStorage.getItem("dailyRecapDateFilter");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.start && parsed.end) return parsed;
      }
    } catch (e) {}
    return defaultRange;
  });

  const [dateRangeDisplay, setDateRangeDisplay] = useState({
    start: displayDateID(dateRange.start),
    end: displayDateID(dateRange.end)
  });

  const [dateErrors, setDateErrors] = useState({ start: '', end: '' });
  const [queryDateRange, setQueryDateRange] = useState(dateRange);

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loadingRecaps, setLoadingRecaps] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [modalMode, setModalMode] = useState('add');

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  
  // 1. Fetch Options on Mount
  useEffect(() => {
    const fetchOptions = async () => {
      const { data, error } = await getAllRecapOptions();
      if (data && !error) {
        const mapping = {};
        data.forEach(opt => {
          mapping[opt.id] = opt.label;
        });
        setOptionsMap(mapping);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => { setCurrentPage(1); if (queryDateRange?.start && queryDateRange?.end) { localStorage.setItem("dailyRecapDateFilter", JSON.stringify(queryDateRange)); } }, [queryDateRange]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(timer); }, [searchTerm]);
  
  useEffect(() => {
    if (dateRange.start && dateRange.end && !dateErrors.start && !dateErrors.end) {
      setQueryDateRange(dateRange);
      setCurrentPage(1);
    }
  }, [dateRange, dateErrors]);

  useEffect(() => { fetchRecaps(); }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig, lastSyncTime]);

  const fetchRecaps = useCallback(async () => {
    if (!queryDateRange.start || !queryDateRange.end) return;
    setLoadingRecaps(true);

    try {
      let query = supabase
        .from('daily_recaps')
        .select(`
          *,
          patients:patients!patient_id(
            id,
            full_name,
            medical_record_number,
            birth_date,
            address,
            phone
          ),
          actual_patients:patients!actual_patient_id(
            id,
            full_name,
            medical_record_number,
            birth_date,
            address,
            phone
          ),
          therapist:physiotherapists!daily_recaps_therapist_id_fkey(
            id,
            name
          )
        `, { count: 'exact' })
        .gte('recap_date', queryDateRange.start)
        .lte('recap_date', queryDateRange.end);

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        const { data: foundPatients } = await supabase.from('patients').select('id').ilike('full_name', `%${q}%`);
        const foundIds = foundPatients?.map(p => p.id) || [];
        
        if (foundIds.length > 0) {
          query = query.or(`patient_id.in.(${foundIds.join(',')}),actual_patient_id.in.(${foundIds.join(',')}),guest_name.ilike.%${q}%`);
        } else {
          query = query.ilike('guest_name', `%${q}%`);
        }
      }

      if (sortConfig.key) {
        if (['recap_date', 'amount', 'created_at'].includes(sortConfig.key)) {
          query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
        }
      } else {
        query = query
          .order('recap_date', { ascending: false })
          .order('created_at', { ascending: false });
      }
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      if (isMounted.current) {
        const safeData = data || [];
        const formatted = safeData.map(r => ({
          ...r,
          date: r.recap_date,
          display_therapist_name: getTherapistName(r),
        package_type: r.package_type
}));
        
        setRecaps(formatted);
        setTotalRecords(count || 0);
        setTotalPages(Math.ceil((count || 0) / limit) || 1);
      }
    } catch (err) { 
      console.error("❌ Error fetching recaps:", err);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data." });
    } finally { 
      if (isMounted.current) setLoadingRecaps(false); 
    }
  }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig]);

  const handleRowClick = (recap) => {
    setSelectedRecap(recap);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = (recap) => {
    setSelectedRecap(recap);
    setModalMode('edit');
    setIsAddModalOpen(true);
  };

  const handleAddRecap = () => {
    setSelectedRecap(null);
    setModalMode('add');
    setIsAddModalOpen(true);
  };

  const handleStartRecap = async (e, recapId) => {
    e.stopPropagation();
    if (!recapId) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    console.log(`[UI] Starting recap ${recapId} at ${timeString}`);

    setActionLoadingId(recapId);
    try {
      const { data, error } = await setDailyRecapStartTime(recapId, timeString);
      
      if (error) {
        console.error("[UI] Error starting recap:", error);
        toast({ 
          variant: "destructive", 
          title: "Gagal Memulai Sesi", 
          description: error.message || "Terjadi kesalahan saat memulai sesi." 
        });
      } else {
        toast({ 
          title: "Sesi Dimulai", 
          description: `Waktu mulai tercatat: ${timeString}`,
          className: "bg-blue-600 text-white border-none"
        });
        await fetchRecaps();
      }
    } catch (e) {
      console.error("[UI] Exception in handleStartRecap:", e);
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally { 
      setActionLoadingId(null); 
    }
  };

  const handleEndRecap = async (e, recapId) => {
  e.stopPropagation();
  if (!recapId) return;

  setActionLoadingId(recapId);

  try {
    const { data, error } = await setDailyRecapEndTime(recapId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal Mengakhiri Sesi",
        description: error.message || "Terjadi kesalahan."
      });
    } else {
      const nowISO = new Date().toISOString(); // 🔥 PENTING

      toast({
        title: "Sesi Selesai",
        description: "Waktu selesai tercatat",
        className: "bg-green-600 text-white border-none"
      });

      // 🔥 UPDATE STATE YANG BENAR
      setRecaps(prev =>
        prev.map(item =>
          item.id === recapId
            ? { ...item, end_time: nowISO }
            : item
        )
      );
    }
  } catch (e) {
    toast({
      variant: "destructive",
      title: "Error",
      description: e.message
    });
  } finally {
    setActionLoadingId(null);
  }
};

const getPremiumPastelBadge = (text) => {
  if (!text) return 'bg-slate-100 text-slate-500 border-0';

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  const premiumColors = [
    'bg-blue-50 text-blue-700 border-0',
    'bg-emerald-50 text-emerald-700 border-0',
    'bg-indigo-50 text-indigo-700 border-0',
    'bg-rose-50 text-rose-700 border-0',
    'bg-amber-50 text-amber-700 border-0',
    'bg-teal-50 text-teal-700 border-0',
    'bg-violet-50 text-violet-700 border-0',
    'bg-cyan-50 text-cyan-700 border-0',
  ];

  const index = Math.abs(hash) % premiumColors.length;
  return premiumColors[index];
};

  const renderDiagnoses = (diagnosis) => {
  let diagnosesList = [];
  try {
    if (typeof diagnosis === 'string') diagnosesList = JSON.parse(diagnosis);
    else if (Array.isArray(diagnosis)) diagnosesList = diagnosis;
  } catch (e) { diagnosesList = []; }
  
  const flat = diagnosesList.flat();
  if (flat.length === 0) return '-';

  const mappedDiagnoses = flat.map(d => optionsMap[d] || d);

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {mappedDiagnoses.slice(0, 3).map((d, i) => (
        <Badge
  key={i}
  variant="outline"
  className="text-sm font-medium px-2.5 py-1 rounded-md border-slate-200"
>
  {d}
</Badge>

      ))}
      {mappedDiagnoses.length > 3 && (
        <span className="text-[10px] text-slate-400">
          +{mappedDiagnoses.length - 3}
        </span>
      )}
    </div>
  );
};


  return (
    <div className="space-y-6">
      {!hideControls && (
        <>
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-amber-300/80 text-xs font-semibold uppercase tracking-widest mb-1">{clinicName || ''}</p>
              <h1 className="text-lg md:text-2xl font-bold tracking-tight">Rekap Harian</h1>
              <p className="text-slate-400 text-xs mt-1">Kelola data kunjungan dan pendapatan.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="hidden"><h1 className="text-2xl font-bold text-slate-900">Rekap Harian</h1><p className="text-slate-500 text-sm mt-1">Kelola data kunjungan dan pendapatan</p></div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2">
              <Input 
                value={dateRangeDisplay.start} 
                onChange={(e) => setDateRangeDisplay(p => ({...p, start: e.target.value}))} 
                className="w-32 text-xs" 
                onClick={() => setShowStartCalendar(true)}
              />
              {showStartCalendar && <div className="absolute z-50 mt-10"><DatePicker value={parseDateFromDisplay(dateRangeDisplay.start)} onChange={(d) => { setDateRange(p=>({...p, start: d})); setDateRangeDisplay(p=>({...p, start: displayDateID(d)})); setShowStartCalendar(false);}} onClose={() => setShowStartCalendar(false)} /></div>}
              <span>-</span>
              <Input 
                value={dateRangeDisplay.end} 
                onChange={(e) => setDateRangeDisplay(p => ({...p, end: e.target.value}))} 
                className="w-32 text-xs"
                onClick={() => setShowEndCalendar(true)}
              />
              {showEndCalendar && <div className="absolute z-50 mt-10 ml-36"><DatePicker value={parseDateFromDisplay(dateRangeDisplay.end)} onChange={(d) => { setDateRange(p=>({...p, end: d})); setDateRangeDisplay(p=>({...p, end: displayDateID(d)})); setShowEndCalendar(false);}} onClose={() => setShowEndCalendar(false)} /></div>}
              
              <Button variant="outline" size="icon" onClick={fetchRecaps}><RefreshCcw className="w-4 h-4"/></Button>
            </div>
            <Input placeholder="Cari Pasien..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px]" />
            <Button onClick={handleAddRecap} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2"/> Tambah</Button>
          </div>
        </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Mobile / PWA: kartu, tanpa geser horizontal */}
        <div className="sm:hidden divide-y divide-slate-100">
          {loadingRecaps ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto w-6 h-6" /></div>
          ) : recaps.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <div className="flex flex-col items-center justify-center py-6">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <p>Tidak ada data rekap harian.</p>
              </div>
            </div>
          ) : (
            recaps.map((recap, idx) => {
              const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
              const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
              const packageLabel = recap.package_type || '-';

              return (
                <motion.div
                  key={recap.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(idx % 2 === 0 ? "bg-white" : "bg-slate-50", "p-4 space-y-3 cursor-pointer")}
                  onClick={() => handleRowClick(recap)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {renderPatientName(recap)}
                      <p className="text-[11px] text-slate-500 mt-0.5">{formatDateIndonesian(recap.date)}</p>
                    </div>
                    <div className="shrink-0">
                      {recap.end_time ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-0 px-3 py-1 rounded-lg">Selesai</Badge>
                      ) : recap.start_time ? (
                        <Badge className="bg-blue-50 text-blue-700 border-0 px-3 py-1 rounded-lg">Berlangsung</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-0 px-3 py-1 rounded-lg">Belum</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Diagnosa</p>
                    <div className="text-slate-600">{renderDiagnoses(recap.diagnosis)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Layanan</p>
                      <p className="text-slate-600">{serviceLabel}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Tipe Pasien</p>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Badge className={cn("text-xs font-medium px-2.5 py-0.5 rounded-md border-0 transition-none", getPremiumPastelBadge(patientTypeLabel))}>
                          {patientTypeLabel}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Paket</p>
                      <p className="text-blue-600 font-semibold">{packageLabel}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Terapis</p>
                      <p className="text-slate-600">{recap.display_therapist_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Nominal</p>
                      <p className="font-semibold text-slate-800">Rp {parseFloat(recap.amount || 0).toLocaleString('id-ID')}</p>
                      {recap.payment_method && (
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 capitalize">{recap.payment_method}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-1 mt-2">Waktu Sesi</p>
                    {!recap.start_time ? (
                      <Button size="sm" className="h-7 w-full text-[10px] bg-blue-600 hover:bg-blue-700" onClick={(e) => handleStartRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                        {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mulai"}
                      </Button>
                    ) : !recap.end_time ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 rounded px-1.5 py-1">{formatTime(new Date(recap.start_time))}</span>
                        <Button size="sm" className="h-7 flex-1 text-[10px] bg-green-600 hover:bg-green-700" onClick={(e) => handleEndRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                          {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selesai"}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                        <span>{formatTime(new Date(recap.start_time))}</span>
                        <span className="opacity-50">→</span>
                        <span>{formatTime(new Date(recap.end_time))}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Desktop: tabel */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left table-auto">
            <thead className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-300">
              <tr>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Tanggal</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Nama Pasien</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Diagnosa</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Layanan</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Tipe Pasien</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Paket</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Terapis</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Nominal</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide">Status</th>
                <th className="px-5 py-4 text-center text-slate-700 font-semibold tracking-wide w-[120px]">Waktu Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRecaps ? <tr><td colSpan={10} className="p-8 text-center"><Loader2 className="animate-spin mx-auto w-6 h-6"/></td></tr> : 
               recaps.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-slate-500">
                 <div className="flex flex-col items-center justify-center py-6">
                   <Search className="w-8 h-8 text-slate-300 mb-2" />
                   <p>Tidak ada data rekap harian.</p>
                 </div>
               </td></tr> :
               recaps.map((recap, idx) => {
                 const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
                 const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
                 const packageLabel = recap.package_type || '-';
                 
                 return (
                  <motion.tr
                    key={recap.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(idx % 2 === 0 ? "bg-white" : "bg-slate-50", "transition-all duration-200 cursor-pointer hover:bg-transparent")}
                    onClick={() => handleRowClick(recap)}
                  >
                     <td className="px-5 py-4 text-center font-medium text-slate-700 whitespace-nowrap">{formatDateIndonesian(recap.date)}</td>
                     <td className="px-5 py-4 text-center">{renderPatientName(recap)}</td>
                     <td className="px-5 py-4 text-center max-w-[220px] whitespace-normal text-slate-600">{renderDiagnoses(recap.diagnosis)}</td>
                     <td className="px-5 py-4 text-center text-slate-600">{serviceLabel}</td>
                     <td className="px-5 py-4 text-center">
                        <div className="inline-block" onClick={(e) => e.stopPropagation()}>
                          <Badge className={cn("text-sm font-medium px-3 py-1 rounded-md border-0 transition-none", getPremiumPastelBadge(patientTypeLabel))}>
                            {patientTypeLabel}
                          </Badge>
                        </div>
                     </td>
                     <td className="px-5 py-4 text-center text-blue-600 font-semibold">{packageLabel}</td>
                     <td className="px-5 py-4 text-center text-slate-600">{recap.display_therapist_name}</td>
                     <td className="px-5 py-4 text-center whitespace-nowrap">
                       <div className="font-semibold text-slate-800">Rp {parseFloat(recap.amount || 0).toLocaleString('id-ID')}</div>
                       {recap.payment_method && (
                         <div className="text-[11px] text-slate-400 font-medium mt-0.5 capitalize">{recap.payment_method}</div>
                       )}
                     </td>
                     <td className="px-5 py-4 text-center">
                       {recap.end_time ? (
                         <Badge className="bg-emerald-50 text-emerald-700 border-0 px-3 py-1 rounded-lg">Selesai</Badge>
                       ) : recap.start_time ? (
                         <Badge className="bg-blue-50 text-blue-700 border-0 px-3 py-1 rounded-lg">Berlangsung</Badge>
                       ) : (
                         <Badge className="bg-slate-100 text-slate-500 border-0 px-3 py-1 rounded-lg">Belum</Badge>
                       )}
                     </td>
                     <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {!recap.start_time ? (
                        <Button size="sm" className="h-7 w-full text-[10px] bg-blue-600 hover:bg-blue-700" onClick={(e) => handleStartRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                          {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mulai"}
                        </Button>
                      ) : !recap.end_time ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-blue-600 bg-blue-50 rounded px-1">{formatTime(new Date(recap.start_time))}</span>
                          <Button size="sm" className="h-6 w-full text-[10px] bg-green-600 hover:bg-green-700" onClick={(e) => handleEndRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                            {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selesai"}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-slate-500 flex flex-col items-center leading-tight">
                          <span>{formatTime(new Date(recap.start_time))}</span>
                          <span className="text-[8px] opacity-50">↓</span>
                          <span>{formatTime(new Date(recap.end_time))}</span>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                 );
               })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white text-xs text-slate-500">
          <span>Hal {currentPage} dari {totalPages} ({totalRecords} data)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)} className="h-7 px-2"><ChevronLeft className="w-3 h-3"/></Button>
            <Button variant="outline" size="sm" disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)} className="h-7 px-2"><ChevronRight className="w-3 h-3"/></Button>
          </div>
        </div>
      </div>

      <DailyRecapModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        mode={modalMode} 
        initialData={selectedRecap} 
        onSuccess={fetchRecaps} 
      />

      <DailyRecapDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        recap={selectedRecap}
        onEdit={handleEditFromDetail}
        onDelete={fetchRecaps}
      />
    </div>
  );
};

export default DailyRecap;