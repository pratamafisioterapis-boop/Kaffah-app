import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, Loader2, Plus, Search, X, Clock, Play, Square,
  ChevronLeft, ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, BarChart3, CreditCard, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getDailyRecaps, getDailyRecapsTotalAmount, getPhysiotherapists } from '@/lib/api';
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
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Tanggal WITA (UTC+8) untuk offset hari tertentu dari hari ini, dipakai
// oleh navigasi panah kiri/kanan pada tombol "Hari Ini".
const getMakassarDateForOffset = (offsetDays) => {
  const now = new Date();
  const wita = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  wita.setUTCDate(wita.getUTCDate() + offsetDays);
  return wita;
};

const getMakassarDateStringForOffset = (offsetDays) => {
  const wita = getMakassarDateForOffset(offsetDays);
  return wita.toISOString().split('T')[0];
};

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

const DailyRecap = ({ hideControls = false, showPaymentFilter = false }) => {
  const location = useLocation();
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const isMounted = useRef(true);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const { lastSyncTime } = useAppointmentState(); 
  
  const [recaps, setRecaps] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [todayOffset, setTodayOffset] = useState(0);
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const therapistOptions = useMemo(() => {
  const map = new Map();

  recaps.forEach(r => {
    if (r.therapist_id && r.display_therapist_name) {
      map.set(r.therapist_id, r.display_therapist_name);
    }
  });

  return Array.from(map.entries()).map(([id, name]) => ({
    id,
    name
  }));
}, [recaps]);
  const [therapists, setTherapists] = useState([]);
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
      const saved = localStorage.getItem("admin_daily_recap_date_range");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.startDate && parsed.endDate) {
          return {
            start: parsed.startDate,
            end: parsed.endDate
          };
        }
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
useEffect(() => {
  fetchRecaps();
}, [location.pathname]);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  useEffect(() => {
    const channel = supabase
      .channel('admin_daily_recaps_invoice_status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'daily_recaps' },
        (payload) => {
          setRecaps(prev =>
            prev.map(r =>
              r.id === payload.new.id
                ? { ...r, invoice_wa_status: payload.new.invoice_wa_status, invoice_wa_sent_at: payload.new.invoice_wa_sent_at }
                : r
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  useEffect(() => {
  const fetchTherapists = async () => {
    const { data, error } = await getPhysiotherapists();
    if (data && !error) {
      setTherapists(data);
    }
  };

  fetchTherapists();
}, []);
  
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
    // Re-fetch whenever data syncs (e.g. a new diagnosis/service option was
    // added elsewhere after this page mounted) so labels never fall back to
    // showing the raw option UUID.
    fetchOptions();
  }, [lastSyncTime]);

  useEffect(() => {
    if (!showPaymentFilter) return;
    const fetchPaymentMethods = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

      const { data } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'payment_method')
        .eq('clinic_id', userRow?.clinic_id)
        .eq('is_active', true);
      setPaymentMethodOptions(data || []);
    };
    fetchPaymentMethods();
  }, [showPaymentFilter]);

  useEffect(() => {
    if (!showPaymentFilter) return;
    const fetchTotal = async () => {
      if (!queryDateRange.start || !queryDateRange.end) return;
      const { data } = await getDailyRecapsTotalAmount({
        startDate: queryDateRange.start,
        endDate: queryDateRange.end,
        search: debouncedSearch,
        therapistId: selectedTherapist || null,
        paymentMethod: selectedPaymentMethod || null,
      });
      if (isMounted.current) setTotalAmount(data || 0);
    };
    fetchTotal();
  }, [showPaymentFilter, queryDateRange, debouncedSearch, selectedTherapist, selectedPaymentMethod]);

  useEffect(() => { setCurrentPage(1); if (queryDateRange?.start && queryDateRange?.end) { localStorage.setItem(
  "admin_daily_recap_date_range",
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

  useEffect(() => { 
  fetchRecaps(); 
}, [
  queryDateRange, 
  currentPage, 
  limit, 
  debouncedSearch, 
  sortConfig, 
  lastSyncTime, 
  selectedTherapist,
  selectedPaymentMethod
]);
  useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();

    const todayMakassar = new Date(now.getTime() + (8 * 60 * 60 * 1000))
      .toISOString()
      .split('T')[0];

    // 🔥 HANYA RESET kalau filter = today DAN tidak sedang geser hari (offset 0),
    // terlepas dari localStorage
    if (activeFilter === 'today' && todayOffset === 0) {
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
}, [activeFilter, dateRange, todayOffset]);
  const fetchRecaps = useCallback(async () => {
    if (!queryDateRange.start || !queryDateRange.end) return;
    setLoadingRecaps(true);

    try {
      const { data, count, error } = await getDailyRecaps({
  startDate: queryDateRange.start,
  endDate: queryDateRange.end,
  search: debouncedSearch,
  therapistId: selectedTherapist || null, // 🔥 TAMBAH INI
  paymentMethod: showPaymentFilter ? (selectedPaymentMethod || null) : null,
  limit,
  offset: (currentPage - 1) * limit,
  sort: sortConfig
});
      if (error) throw error;

      if (isMounted.current) {
        const safeData = data || [];
        const formatted = safeData.map(r => ({
          ...r,
           start_time: r.start_time,
end_time: r.end_time,
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
  }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig, toast, selectedTherapist, selectedPaymentMethod]);

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

    const mappedDiagnoses = diagnosis.map(d => optionsMap[d] || d);

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
          <span className="text-sm text-slate-400">
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
        <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
          <img
            src="/hero/clinara-recap-hero.webp"
            alt="Kaffah Physiotherapy"
            className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
            <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
              <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
              <h1
                style={{ fontFamily: "'Caveat', cursive" }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
              >
                Rekap<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                  Harian
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                Kelola data kunjungan dan pendapatan harian klinik.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-4 rounded-[22px] border border-slate-100 shadow-sm">
          {!isPWA && <div className="hidden"><h1 className="text-2xl font-bold text-slate-900">Rekap Harian</h1><p className="text-slate-500 text-sm mt-1">Kelola data kunjungan dan pendapatan</p></div>}

          {/* Filter Tombol Periode */}
          <div className="grid grid-cols-4 gap-2">
            <div
              className={cn(
                'relative flex items-center justify-center h-[68px] sm:h-[76px] rounded-2xl border transition-all',
                activeFilter === 'today'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-[#EEF5FC] border-[#DCE8F5] text-[#0F2A4A] hover:bg-[#E3EFFB]'
              )}
            >
              <button
                type="button"
                aria-label="Hari sebelumnya"
                onClick={(e) => {
                  e.stopPropagation();
                  const newOffset = todayOffset - 1;
                  const target = getMakassarDateStringForOffset(newOffset);

                  setTodayOffset(newOffset);
                  setActiveFilter('today');
                  setDateRange({ start: target, end: target });
                  setDateRangeDisplay({
                    start: displayDateID(target),
                    end: displayDateID(target)
                  });
                }}
                className={cn(
                  'hidden sm:block absolute left-0.5 sm:left-1 p-1 rounded-full',
                  activeFilter === 'today' ? 'hover:bg-white/20' : 'hover:bg-[#DCE8F5]'
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTodayOffset(0);
                  setActiveFilter('today');

                  const today = getMakassarDateStringForOffset(0);
                  setDateRange({ start: today, end: today });
                  setDateRangeDisplay({
                    start: displayDateID(today),
                    end: displayDateID(today)
                  });
                }}
                className="flex flex-col items-center justify-center gap-1 h-full px-1 sm:px-5 min-w-0"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={2} />
                <span
                  className={cn(
                    'font-semibold leading-tight text-center whitespace-nowrap',
                    todayOffset === 0 ? 'text-[11px] sm:text-sm' : 'text-[9px] sm:text-[11px]'
                  )}
                >
                  {todayOffset === 0
                    ? 'Hari Ini'
                    : format(getMakassarDateForOffset(todayOffset), 'EEE, dd MMM', { locale: idLocale })}
                </span>
              </button>

              <button
                type="button"
                aria-label="Hari berikutnya"
                onClick={(e) => {
                  e.stopPropagation();
                  const newOffset = todayOffset + 1;
                  const target = getMakassarDateStringForOffset(newOffset);

                  setTodayOffset(newOffset);
                  setActiveFilter('today');
                  setDateRange({ start: target, end: target });
                  setDateRangeDisplay({
                    start: displayDateID(target),
                    end: displayDateID(target)
                  });
                }}
                className={cn(
                  'hidden sm:block absolute right-0.5 sm:right-1 p-1 rounded-full',
                  activeFilter === 'today' ? 'hover:bg-white/20' : 'hover:bg-[#DCE8F5]'
                )}
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const now = new Date();

                // 🔥 shift ke WITA (+8) dulu, baru pakai getter UTC - biar hasilnya
                // konsisten & tidak tergantung timezone perangkat admin (sama seperti
                // filter "Hari Ini"/"Bulan Ini")
                const base = new Date(now.getTime() + (8 * 60 * 60 * 1000));

                const day = base.getUTCDay(); // 0 (Minggu) - 6 (Sabtu)

                // 🔥 hitung offset ke Senin (ISO)
                const diffToMonday = (day + 6) % 7;

                const monday = new Date(base);
                monday.setUTCDate(base.getUTCDate() - diffToMonday);

                const sunday = new Date(monday);
                sunday.setUTCDate(monday.getUTCDate() + 6);

                const start = monday.toISOString().split('T')[0];
                const end = sunday.toISOString().split('T')[0];

                setActiveFilter('week');

                setDateRange({ start, end });
                setDateRangeDisplay({
                  start: displayDateID(start),
                  end: displayDateID(end)
                });
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-[68px] sm:h-[76px] rounded-2xl border transition-all px-1',
                activeFilter === 'week'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-[#EEF5FC] border-[#DCE8F5] text-[#0F2A4A] hover:bg-[#E3EFFB]'
              )}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
              <span className="text-[11px] sm:text-sm font-semibold leading-tight text-center">Minggu Ini</span>
            </button>

            <button
              type="button"
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
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-[68px] sm:h-[76px] rounded-2xl border transition-all px-1',
                activeFilter === 'month'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-[#EEF5FC] border-[#DCE8F5] text-[#0F2A4A] hover:bg-[#E3EFFB]'
              )}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
              <span className="text-[11px] sm:text-sm font-semibold leading-tight text-center">Bulan Ini</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const formatLocal = (date) => {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  return `${y}-${m}-${d}`;
                };
                let start, end;
                if (now.getDate() >= 28) {
                  start = formatLocal(new Date(now.getFullYear(), now.getMonth(), 28));
                  end = formatLocal(new Date(now.getFullYear(), now.getMonth() + 1, 27));
                } else {
                  start = formatLocal(new Date(now.getFullYear(), now.getMonth() - 1, 28));
                  end = formatLocal(new Date(now.getFullYear(), now.getMonth(), 27));
                }
                setActiveFilter('period');
                setDateRange({ start, end });
                setDateRangeDisplay({
                  start: displayDateID(start),
                  end: displayDateID(end)
                });
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-[68px] sm:h-[76px] rounded-2xl border transition-all px-1',
                activeFilter === 'period'
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-[#EEF5FC] border-[#DCE8F5] text-[#0F2A4A] hover:bg-[#E3EFFB]'
              )}
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
              <span className="text-[11px] sm:text-sm font-semibold leading-tight text-center">Periode Ini</span>
            </button>
          </div>

          {/* Filter Tanggal */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                value={dateRangeDisplay.start}
                onChange={(e) => {
                  setActiveFilter(null);
                  setDateRangeDisplay(p => ({ ...p, start: e.target.value }));
                }}
                className="h-11 sm:h-12 w-full pl-7 pr-1 text-[11px] sm:text-xs rounded-xl border border-[#D8E2EB]"
                onClick={() => setShowStartCalendar(true)}
              />

              {showStartCalendar && (
                <div className="absolute z-50 mt-2">
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
            </div>

            <span className="text-slate-400 font-medium shrink-0 -mx-0.5">-</span>

            <div className="relative flex-1 min-w-0">
              <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                value={dateRangeDisplay.end}
                onChange={(e) => {
                  setActiveFilter(null);
                  setDateRangeDisplay(p => ({ ...p, end: e.target.value }));
                }}
                className="h-11 sm:h-12 w-full pl-7 pr-1 text-[11px] sm:text-xs rounded-xl border border-[#D8E2EB]"
                onClick={() => setShowEndCalendar(true)}
              />

              {showEndCalendar && (
                <div className="absolute z-50 mt-2 right-0">
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
            </div>
          </div>

          {/* Terapis + Cari Pasien (satu baris di tablet/desktop), atau Terapis + Metode Pembayaran (satu baris di semua ukuran) */}
          <div className={cn('flex gap-2.5', showPaymentFilter ? 'flex-row' : 'flex-col sm:flex-row')}>
            <div className={cn('relative', showPaymentFilter ? 'flex-1 min-w-0' : 'sm:flex-1')}>
              <Users className={cn('w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10', showPaymentFilter ? 'left-2 sm:left-3' : 'left-3')} />
              <select
                value={selectedTherapist}
                onChange={(e) => {
                  setSelectedTherapist(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn('w-full h-11 sm:h-12 rounded-xl transition-all appearance-none cursor-pointer bg-white text-slate-700 border border-[#D8E2EB] hover:bg-slate-50', showPaymentFilter ? 'pl-7 pr-6 sm:pl-9 sm:pr-9 text-[11px] sm:text-sm' : 'pl-9 pr-9 text-sm')}
              >
                <option value="">Semua Terapis</option>

                {therapistOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <ChevronDown className={cn('w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none', showPaymentFilter ? 'right-1.5 sm:right-3' : 'right-3')} />
            </div>

            {!showPaymentFilter && (
              <div className="relative sm:flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Cari Pasien..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 sm:h-12 w-full pl-9 text-sm rounded-xl border border-[#D8E2EB]"
                />
              </div>
            )}

            {showPaymentFilter && (
              <div className="relative flex-1 min-w-0">
                <CreditCard className="w-4 h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => { setSelectedPaymentMethod(e.target.value); setCurrentPage(1); }}
                  className="w-full h-11 sm:h-12 rounded-xl pl-7 pr-6 sm:pl-9 sm:pr-9 text-[11px] sm:text-sm appearance-none cursor-pointer border bg-white text-slate-700 border-[#D8E2EB] hover:bg-slate-50"
                >
                  <option value="">Semua Metode</option>
                  {paymentMethodOptions.map((pm) => (
                    <option key={pm.id} value={pm.label}>{pm.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            )}
          </div>

          {showPaymentFilter && (
            <>
              {/* Total Revenue */}
              <div className="w-full flex items-center gap-1.5 px-3 h-10 rounded-xl bg-emerald-50 border border-emerald-100">
                <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-emerald-700 whitespace-nowrap">
                  Total: <span className="font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalAmount)}</span>
                </span>
              </div>
            </>
          )}

          {showPaymentFilter && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Cari Pasien..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 sm:h-12 w-full pl-9 text-sm rounded-xl border border-[#D8E2EB]"
              />
            </div>
          )}
        </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <>
          {/* ── CARD LAYOUT (mobile/narrow) ── */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loadingRecaps ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto w-6 h-6 text-blue-500"/></div>
            ) : recaps.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <Search className="w-8 h-8 text-slate-300"/>
                <p>Tidak ada data rekap harian.</p>
              </div>
            ) : recaps.map((recap, idx) => {
              const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
              const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
              const packageLabel = recap.package_type || '-';
              const mainName = recap.actual_patients?.full_name || recap.patients?.full_name || recap.guest_name || 'Nama tidak tersedia';
              const isDifferent = recap.actual_patient_id && recap.patient_id && recap.actual_patient_id !== recap.patient_id;

              return (
                <div
                  key={recap.id}
                  onClick={() => handleRowClick(recap)}
                  className={cn("px-4 py-3 cursor-pointer active:bg-blue-50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                >
                  {/* Baris 1: Tanggal + Status */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 font-medium">{recap.date ? formatDateIndonesian(recap.date) : '-'}</span>
                    {recap.end_time
                      ? <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">Selesai</Badge>
                      : recap.start_time
                      ? <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px]">Berlangsung</Badge>
                      : <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px]">Belum</Badge>}
                  </div>

                  {/* Baris 2: Nama Pasien + Nominal */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm leading-tight">{mainName}</span>
                      {isDifferent && recap.patients?.full_name && (
                        <span className="text-[10px] text-slate-400">(Paket: {recap.patients.full_name})</span>
                      )}
                    </div>
                    <span className="font-bold text-blue-600 text-sm ml-2 shrink-0">Rp {parseFloat(recap.amount || 0).toLocaleString('id-ID')}</span>
                  </div>

                  {/* Baris 3: Terapis + Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className="text-xs text-slate-500 font-medium">{recap.display_therapist_name}</span>
                    <span className="text-slate-300 text-xs">·</span>
                    <Badge className={cn("text-[10px] font-normal py-0 px-1.5", getPremiumPastelBadge(patientTypeLabel))}>{patientTypeLabel}</Badge>
                    <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5">{serviceLabel}</Badge>
                    {packageLabel !== '-' && <Badge className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-600 border-blue-100">{packageLabel}</Badge>}
                  </div>

                  {/* Baris 4: Tombol Sesi */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {recap.start_time == null ? (
                      <Button size="sm" className="h-8 w-full text-xs bg-blue-600 hover:bg-blue-700 rounded-lg" onClick={(e) => handleStartRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                        {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Play className="w-3 h-3 mr-1.5"/>Mulai Sesi</>}
                      </Button>
                    ) : !recap.end_time ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 shrink-0">{formatTime(new Date(recap.start_time))}</span>
                        <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white flex-1 rounded-lg" onClick={(e) => handleEndRecap(e, recap.id)} disabled={actionLoadingId === recap.id}>
                          {actionLoadingId === recap.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Square className="w-3 h-3 mr-1.5"/>Selesai</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 w-fit">
                          <span>{formatTime(new Date(recap.start_time))}</span>
                          <span className="text-slate-300">→</span>
                          <span>{formatTime(new Date(recap.end_time))}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {parseFloat(recap.amount || 0) > 0 && (
                            <span
                              title={
                                recap.invoice_wa_status === 'gagal'
                                  ? 'Gagal dikirim'
                                  : recap.invoice_wa_status
                                  ? 'Status berdasarkan respons API — bukan konfirmasi pasien menerima.'
                                  : 'Invoice belum pernah dikirim ke WhatsApp pasien'
                              }
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                recap.invoice_wa_status === 'gagal'
                                  ? 'bg-red-50 text-red-600'
                                  : recap.invoice_wa_status
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                              }`}
                            >
                              {recap.invoice_wa_status === 'gagal'
                                ? '✕ Gagal'
                                : recap.invoice_wa_status
                                ? '✓ Terkirim'
                                : '● Belum Dikirim'}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={parseFloat(recap.amount || 0) === 0}
                            className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg"
                            onClick={() => {
                              setSelectedInvoiceData(recap);
                              setInvoiceModalOpen(true);
                            }}
                          >
                            <CreditCard className="w-3 h-3 mr-1.5" />Invoice
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* ── TABLE LAYOUT (desktop/wide) ── */}
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs text-left table-fixed">
            <thead className="bg-slate-100 text-slate-900 font-semibold border-b border-slate-300">
              <tr>
                <th className="px-2 py-3 text-center text-slate-700 font-semibold w-[130px]">Tanggal</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[140px]">Nama Pasien</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[130px]">Diagnosa</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[120px]">Layanan</th>

<th className="px-2 py-3 text-center text-slate-700 font-semibold w-[120px]">Tipe</th>

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
                     <td className="px-5 py-4 text-center text-black font-normal whitespace-normal break-words">
  {formatDateIndonesian(recap.date)}
</td>
                     <td className="px-5 py-4 text-center">{renderPatientName(recap)}</td>
                     <td className="px-5 py-4 text-center max-w-[220px] whitespace-normal text-slate-600">{renderDiagnoses(recap.diagnosis)}</td>
                     <td className="px-5 py-4 text-center text-slate-600">{serviceLabel}</td>
                     <td className="px-5 py-4 text-center">
                        <div className="max-w-full" onClick={(e) => e.stopPropagation()}>
                          <Badge className={cn("!inline-block max-w-full text-sm font-medium px-3 py-1 rounded-md border-0 transition-none whitespace-normal break-words [overflow-wrap:anywhere] text-center leading-tight", getPremiumPastelBadge(patientTypeLabel))}>
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
                      {recap.start_time == null ? (
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
  <div className="flex flex-col items-center gap-1">
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
    {parseFloat(recap.amount || 0) > 0 && (
    <span
      title={
        recap.invoice_wa_status === 'gagal'
          ? 'Gagal dikirim'
          : recap.invoice_wa_status
          ? 'Status berdasarkan respons API — bukan konfirmasi pasien menerima. Jika pasien 24 jam terakhir tidak WA klinik, pesan bisa gagal masuk walau status ini hijau.'
          : 'Invoice belum pernah dikirim ke WhatsApp pasien'
      }
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        recap.invoice_wa_status === 'gagal'
          ? 'bg-red-50 text-red-600'
          : recap.invoice_wa_status
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-amber-50 text-amber-600'
      }`}
    >
      {recap.invoice_wa_status === 'gagal'
        ? '✕ Gagal'
        : recap.invoice_wa_status
        ? '✓ Terkirim'
        : '● Belum Dikirim'}
    </span>
    )}
  </div>
</td>
                  </motion.tr>
                 );
               })}
            </tbody>
          </table>
          </div>
        </>
        {/* ── end responsive card/table split ── */}
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
  onSent={fetchRecaps}
/>
    </div>
  );
};

export default DailyRecap;