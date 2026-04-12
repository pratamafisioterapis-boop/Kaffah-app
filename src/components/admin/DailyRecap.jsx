import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Loader2, Plus, Search, X, Clock, Play, Square, 
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, RefreshCcw, BarChart3
} from 'lucide-react';
import { getDailyRecaps } from '@/lib/api';
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
import InvoiceModal from '@/components/admin/InvoiceModal';
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
        <span className="text-sm text-slate-500 font-medium mt-0.5">
          (Paket: {ownerName})
        </span>
      )}
    </div>
  );
};

const DailyRecap = ({ hideControls = false }) => {
  const { toast } = useToast();
  const isMounted = useRef(true);
  const { lastSyncTime } = useAppointmentState(); 
  
  const [recaps, setRecaps] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  // Cache for options (diagnosa, service_type, etc.)
  const [optionsMap, setOptionsMap] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();

    // Pakai timezone Makassar (WITA = UTC+8)
    const todayMakassar = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      .toISOString()
      .split('T')[0];

    const defaultRange = {
      start: todayMakassar,
      end: todayMakassar
    };

    try {
      const saved = localStorage.getItem("global_date_range");
      if (saved) {
        const parsed = JSON.parse(saved);

        // Ambil hari ini lagi (biar auto reset jam 00:01)
      return {
  start: parsed.startDate,
  end: parsed.endDate
};
      }
    } catch (e) { }

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
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
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

  useEffect(() => { setCurrentPage(1); if (queryDateRange?.start && queryDateRange?.end) { localStorage.setItem(
  "global_date_range",
  JSON.stringify({
    startDate: queryDateRange.start,
    endDate: queryDateRange.end
  })
); } }, [queryDateRange]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(timer); }, [searchTerm]);
  
  useEffect(() => {
    if (dateRange.start && dateRange.end && !dateErrors.start && !dateErrors.end) {
      setQueryDateRange(dateRange);
      setCurrentPage(1);
    }
  }, [dateRange, dateErrors]);

  useEffect(() => { fetchRecaps(); }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig, lastSyncTime]);
  useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();

    const todayMakassar = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      .toISOString()
      .split('T')[0];

    // 🔥 HANYA RESET kalau filter = today
    if (activeFilter === 'today' && !localStorage.getItem("global_date_range")) {
      if (
        dateRange.start !== todayMakassar ||
        dateRange.end !== todayMakassar
      ) {
        setDateRange({
          start: todayMakassar,
          end: todayMakassar
        });
      }
    }
  }, 60000);

  return () => clearInterval(interval);
}, [activeFilter, dateRange]);
  const fetchRecaps = useCallback(async () => {
    if (!queryDateRange.start || !queryDateRange.end) return;
    setLoadingRecaps(true);

    try {
      const { data, count, error } = await getDailyRecaps({
        startDate: queryDateRange.start,
        endDate: queryDateRange.end,
        search: debouncedSearch,
        limit,
        offset: (currentPage - 1) * limit,
        sort: sortConfig
      });
      if (error) throw error;

      if (isMounted.current) {
        const safeData = data || [];
        const formatted = safeData.map(r => ({
          ...r,
          date: r.recap_date,
          display_therapist_name: getTherapistName(r),
        package_type: r.package_type,
        amount_original: r.amount_original ?? (
    r.discount_type === 'percentage'
      ? Math.round(r.amount / (1 - (r.discount_value || 0) / 100))
      : r.discount_type === 'nominal'
      ? r.amount + (r.discount_value || 0)
      : r.amount
  )
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

// 🔥 UPDATE STATE LANGSUNG (INI KUNCI)
setRecaps(prev =>
  prev.map(item =>
    item.id === recapId
      ? { ...item, start_time: new Date().toISOString() }
      : item
  )
);


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
    if (!diagnosis || diagnosis.length === 0) return '-';

    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {diagnosis.slice(0, 3).map((d, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-sm font-medium px-2.5 py-1 rounded-md border-slate-200"
          >
            {d}
          </Badge>
        ))}
        {diagnosis.length > 3 && (
          <span className="text-sm text-slate-400">
            +{diagnosis.length - 3}
          </span>
        )}
      </div>
    );
  };


  return (
    <div className="space-y-6">
      {!hideControls && (
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div><h1 className="text-2xl font-bold text-slate-900">Rekap Harian</h1><p className="text-slate-500 text-sm mt-1">Kelola data kunjungan dan pendapatan</p></div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button
  variant={activeFilter === 'today' ? 'default' : 'outline'}
  className={activeFilter === 'today' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const today = new Date(now.getTime() + (8 * 60 * 60 * 1000))
                      .toISOString()
                      .split('T')[0];

                    setActiveFilter('today');

                    setDateRange({ start: today, end: today });
                    setDateRangeDisplay({
                      start: displayDateID(today),
                      end: displayDateID(today)
                    });
                  }}
                >
                  Hari Ini
                </Button>

                <Button
  variant={activeFilter === 'week' ? 'default' : 'outline'}
  className={activeFilter === 'week' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
  size="sm"
                  onClick={() => {
  const now = new Date();

  // 🔥 pakai waktu lokal langsung (jangan shift lagi)
  const base = new Date(now);

  const day = base.getDay(); // 0 (Minggu) - 6 (Sabtu)

  // 🔥 hitung offset ke Senin (ISO)
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(base);
  monday.setDate(base.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const start = monday.toISOString().split('T')[0];
  const end = sunday.toISOString().split('T')[0];

  setActiveFilter('week');

  setDateRange({ start, end });
  setDateRangeDisplay({
    start: displayDateID(start),
    end: displayDateID(end)
  });
}}
                >
                  Minggu Ini
                </Button>

                <Button
  variant={activeFilter === 'month' ? 'default' : 'outline'}
  className={activeFilter === 'month' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const base = new Date(now.getTime() + (8 * 60 * 60 * 1000));

                    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);

// 🔥 format manual (bukan toISOString)
const formatLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const start = formatLocal(firstDay);
const end = formatLocal(lastDay);

                    setActiveFilter('month');

                    setDateRange({ start, end });
                    setDateRangeDisplay({
                      start: displayDateID(start),
                      end: displayDateID(end)
                    });
                  }}
                >
                  Bulan Ini
                </Button>
              </div>
              <Input 
  value={dateRangeDisplay.start} 
  onChange={(e) => {
    setActiveFilter(null);
    setDateRangeDisplay(p => ({ ...p, start: e.target.value }));
  }} 
  className="w-32 text-xs" 
  onClick={() => setShowStartCalendar(true)}
/>

{showStartCalendar && (
  <div className="absolute z-50 mt-10">
    <DatePicker
      value={parseDateFromDisplay(dateRangeDisplay.start)}
      onChange={(d) => {
        setActiveFilter(null);
        setDateRange(p => ({ ...p, start: d }));
        setDateRangeDisplay(p => ({ ...p, start: displayDateID(d) }));
        setShowStartCalendar(false);
      }}
      onClose={() => setShowStartCalendar(false)}
    />
  </div>
)}

<span>-</span>

<Input 
  value={dateRangeDisplay.end} 
  onChange={(e) => {
    setActiveFilter(null);
    setDateRangeDisplay(p => ({ ...p, end: e.target.value }));
  }} 
  className="w-32 text-xs"
  onClick={() => setShowEndCalendar(true)}
/>

{showEndCalendar && (
  <div className="absolute z-50 mt-10 ml-36">
    <DatePicker
      value={parseDateFromDisplay(dateRangeDisplay.end)}
      onChange={(d) => {
        setActiveFilter(null);
        setDateRange(p => ({ ...p, end: d }));
        setDateRangeDisplay(p => ({ ...p, end: displayDateID(d) }));
        setShowEndCalendar(false);
      }}
      onClose={() => setShowEndCalendar(false)}
    />
  </div>
)}

<Button variant="outline" size="icon" onClick={fetchRecaps}>
  <RefreshCcw className="w-4 h-4"/>
</Button>
            </div>
            <Input placeholder="Cari Pasien..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px]" />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-hidden">
          <table className="w-full text-xs text-left table-fixed">
            <thead className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-300">
              <tr>
                <th className="px-2 py-3 text-center text-slate-700 font-semibold w-[110px]">Tanggal</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[140px]">Nama Pasien</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[130px]">Diagnosa</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[120px]">Layanan</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[100px]">Tipe</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[80px]">Paket</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[120px]">Terapis</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[90px]">Nominal</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[80px]">Status</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[100px]">Sesi</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[90px]">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
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
                     <td className="px-5 py-4 text-center text-black font-normal whitespace-nowrap">
  {formatDateIndonesian(recap.date)}
</td>
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
                     <td className="px-5 py-4 text-center font-semibold text-slate-800 whitespace-nowrap">Rp {parseFloat(recap.amount || 0).toLocaleString('id-ID')}</td>
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
                                 <Button size="sm" className="h-7 w-full text-sm bg-blue-600 hover:bg-blue-700" onClick={(e) => handleStartRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                          {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mulai"}
                        </Button>
                      ) : !recap.end_time ? (
                        <div className="flex flex-col gap-1">
                                         <span className="text-sm font-mono text-blue-600 bg-blue-50 rounded px-1">{formatTime(new Date(recap.start_time))}</span>
                                         <Button size="sm" className="h-6 w-full text-sm bg-green-600 hover:bg-green-700" onClick={(e) => handleEndRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                            {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selesai"}
                          </Button>
                        </div>
                      ) : (
                                         <div className="text-sm font-mono text-slate-500 flex flex-col items-center leading-tight">
                          <span>{formatTime(new Date(recap.start_time))}</span>
                                             <span className="text-sm opacity-50">↓</span>
                          <span>{formatTime(new Date(recap.end_time))}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
  <Button
  size="sm"
  variant="outline"
  disabled={parseFloat(recap.amount || 0) === 0}
  className="text-blue-600 border-blue-200 hover:bg-blue-50"
  onClick={() => {
    setSelectedInvoiceData(recap);
    setInvoiceModalOpen(true);
  }}
>
  Invoice
</Button>
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
      <InvoiceModal
  isOpen={invoiceModalOpen}
  onClose={() => setInvoiceModalOpen(false)}
  data={selectedInvoiceData}
/>
    </div>
  );
};

export default DailyRecap;