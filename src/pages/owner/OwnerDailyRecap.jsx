import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Search, Loader2, Plus, RefreshCcw, X, Play, Square, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, BarChart3, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  setDailyRecapStartTime,
  setDailyRecapEndTime,
  getAllRecapOptions
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { 
  formatDateIndonesian, 
  formatTime, 
  displayDateID, 
  parseDateFromDisplay,
} from '@/lib/dateFormatHelpers';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAppointmentState } from '@/contexts/AppointmentStateContext'; 
import { supabase } from '@/lib/customSupabaseClient';
import DatePicker from '@/components/DatePicker';
import DailyRecapModal from '@/components/shared/DailyRecapModal';
import DailyRecapDetailModal from '@/components/shared/DailyRecapDetailModal';
import InvoiceModal from '@/components/admin/InvoiceModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';

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

const OwnerDailyRecap = () => {
  const { toast } = useToast();
  const isMounted = useRef(true);
  const { lastSyncTime } = useAppointmentState(); 
  
  // Data States
  const [recaps, setRecaps] = useState([]);

  // Cache for options (diagnosa, service_type, etc.)
  const [optionsMap, setOptionsMap] = useState({});
  
  // Modal States
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);

  // Search & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);

  // Date Pickers
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Filters & Pagination
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const oneYearAgoDate = new Date();
    oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
    const defaultRange = { start: oneYearAgoDate.toISOString().split('T')[0], end: today };
    try {
        const saved = localStorage.getItem("dailyRecapDateFilter");
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return defaultRange;
  });

  const [dateRangeDisplay, setDateRangeDisplay] = useState({
      start: displayDateID(dateRange.start),
      end: displayDateID(dateRange.end)
  });

  const [dateErrors, setDateErrors] = useState({ start: '', end: '' });
  const [queryDateRange, setQueryDateRange] = useState(dateRange);
  const [activeFilter, setActiveFilter] = useState('');

  const [limit, setLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading
  const [loadingRecaps, setLoadingRecaps] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

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

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      const { data } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'payment_method')
        .eq('is_active', true);
      setPaymentMethodOptions(data || []);
    };
    fetchPaymentMethods();
  }, []);

  useEffect(() => { setCurrentPage(1); if (queryDateRange?.start) localStorage.setItem("dailyRecapDateFilter", JSON.stringify(queryDateRange)); }, [queryDateRange]);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(timer); }, [searchTerm]);
  
  useEffect(() => {
    if (dateRange.start && dateRange.end && !dateErrors.start && !dateErrors.end) {
        setQueryDateRange(dateRange);
        setCurrentPage(1);
    }
  }, [dateRange, dateErrors]);

  useEffect(() => { fetchRecaps(); }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig, lastSyncTime, selectedPaymentMethod]);

  const fetchRecaps = useCallback(async () => {
    if (!queryDateRange.start || !queryDateRange.end) return;
    setLoadingRecaps(true);
    try {
        let query = supabase
            .from('daily_recaps')
            .select(`
                *,
                patients:patients!daily_recap_patient_id_fkey(id, full_name, medical_record_number, phone),
                actual_patients:patients!daily_recap_actual_patient_id_fkey(id, full_name, medical_record_number, phone),
                therapist:physiotherapists!daily_recaps_therapist_id_fkey(id, name)
            `, { count: 'exact' })
            .gte('recap_date', queryDateRange.start)
            .lte('recap_date', queryDateRange.end);

      if (selectedPaymentMethod) {
        query = query.eq('payment_method', selectedPaymentMethod);
      }

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
        query = query.order('recap_date', { ascending: false });
      }

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      if (isMounted.current) {
          const formatted = data.map(r => ({
              ...r,
              date: r.recap_date,
              display_therapist_name: getTherapistName(r),
          package_type: r.package_type
}));
          
          setRecaps(formatted || []);
          setTotalRecords(count || 0);
          setTotalPages(Math.ceil((count || 0) / limit) || 1);
      }
    } catch (err) { 
        console.error("❌ Error fetching owner recaps", err);
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat data." });
    } finally { 
        if (isMounted.current) setLoadingRecaps(false); 
    }
  }, [queryDateRange, currentPage, limit, debouncedSearch, sortConfig, selectedPaymentMethod]);

  const fetchTotalAmount = useCallback(async () => {
    if (!queryDateRange.start || !queryDateRange.end) return;
    try {
      let query = supabase
        .from('daily_recaps')
        .select('amount')
        .gte('recap_date', queryDateRange.start)
        .lte('recap_date', queryDateRange.end);

      if (selectedPaymentMethod) {
        query = query.eq('payment_method', selectedPaymentMethod);
      }

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

      const { data, error } = await query;
      if (error) throw error;
      const sum = (data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (isMounted.current) setTotalAmount(sum);
    } catch (err) {
      console.error("❌ Error fetching total amount", err);
    }
  }, [queryDateRange, debouncedSearch, selectedPaymentMethod]);

  useEffect(() => { fetchTotalAmount(); }, [fetchTotalAmount]);

  const handleStartTime = async (e, recapId) => {
      e.stopPropagation();
      setActionLoadingId(recapId);
      try {
          const { error } = await setDailyRecapStartTime(recapId);
          if (error) throw error;
          fetchRecaps();
          toast({ title: "Started", description: "Waktu mulai sesi berhasil disimpan." });
      } catch (error) {
          toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan waktu mulai." });
      } finally { setActionLoadingId(null); }
  };

  const handleEndTime = async (e, recapId) => {
      e.stopPropagation();
      setActionLoadingId(recapId);
      try {
          const { error } = await setDailyRecapEndTime(recapId);
          if (error) throw error;
          fetchRecaps();
          toast({ title: "Ended", description: "Waktu selesai sesi berhasil disimpan." });
      } catch (error) {
          toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan waktu selesai." });
      } finally { setActionLoadingId(null); }
  };

  const handleRowClick = (recap) => {
      setSelectedRecap(recap);
      setIsDetailModalOpen(true);
  };

  const handleAddClick = () => {
      console.log("Adding new owner recap - opening modal");
      setSelectedRecap(null);
      setModalMode('add');
      setIsAddModalOpen(true);
  };

  const handleEditFromDetail = (recap) => {
      setSelectedRecap(recap);
      setModalMode('edit');
      setIsAddModalOpen(true);
  };

  const renderDiagnoses = (diagnosis) => {
      let diagnosesList = [];
      try {
          if (typeof diagnosis === 'string') diagnosesList = JSON.parse(diagnosis);
          else if (Array.isArray(diagnosis)) diagnosesList = diagnosis;
      } catch (e) { diagnosesList = []; }
      const flat = diagnosesList.flat();
      if (flat.length === 0) return '-';

      // Map IDs to Labels using optionsMap
      const mappedDiagnoses = flat.map(d => optionsMap[d] || d);

      return (
          <div className="flex flex-wrap gap-1 justify-center">
              {mappedDiagnoses.slice(0, 3).map((d, i) => <Badge key={i} variant="outline" className="text-[10px] font-normal">{d}</Badge>)}
              {mappedDiagnoses.length > 3 && <span className="text-[10px] text-slate-400">+{mappedDiagnoses.length - 3}</span>}
          </div>
      );
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      {!isPWA && <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">{useAuth().clinicName || 'Kaffah Physiotherapy'}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Rekap Harian</h2>
            <p className="text-sm text-slate-400 mt-0.5">Kelola data kunjungan dan pendapatan harian klinik</p>
          </div>
        </div>
      </div>}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="hidden"><h1 className="text-2xl font-bold text-slate-900">Rekap Harian (Owner)</h1><p className="text-slate-500 text-sm mt-1">Kelola data kunjungan dan pendapatan harian klinik</p></div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
             <div className="flex gap-1.5">
                <Button variant={activeFilter === 'today' ? 'default' : 'outline'} className={activeFilter === 'today' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''} size="sm" onClick={() => { const now = new Date(); const today = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0]; setActiveFilter('today'); setDateRange({ start: today, end: today }); setDateRangeDisplay({ start: displayDateID(today), end: displayDateID(today) }); }}>Hari Ini</Button>
                <Button variant={activeFilter === 'week' ? 'default' : 'outline'} className={activeFilter === 'week' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''} size="sm" onClick={() => { const now = new Date(); const day = now.getDay(); const diffToMonday = (day + 6) % 7; const monday = new Date(now); monday.setDate(now.getDate() - diffToMonday); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); const start = monday.toISOString().split('T')[0]; const end = sunday.toISOString().split('T')[0]; setActiveFilter('week'); setDateRange({ start, end }); setDateRangeDisplay({ start: displayDateID(start), end: displayDateID(end) }); }}>Minggu Ini</Button>
                <Button variant={activeFilter === 'month' ? 'default' : 'outline'} className={activeFilter === 'month' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''} size="sm" onClick={() => { const now = new Date(); const base = new Date(now.getTime() + (8 * 60 * 60 * 1000)); const formatLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const start = formatLocal(new Date(base.getFullYear(), base.getMonth(), 1)); const end = formatLocal(new Date(base.getFullYear(), base.getMonth()+1, 0)); setActiveFilter('month'); setDateRange({ start, end }); setDateRangeDisplay({ start: displayDateID(start), end: displayDateID(end) }); }}>Bulan Ini</Button>
                <Button variant={activeFilter === 'period' ? 'default' : 'outline'} className={activeFilter === 'period' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''} size="sm" onClick={() => { const now = new Date(); const formatLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; let start, end; if (now.getDate() >= 28) { start = formatLocal(new Date(now.getFullYear(), now.getMonth(), 28)); end = formatLocal(new Date(now.getFullYear(), now.getMonth()+1, 27)); } else { start = formatLocal(new Date(now.getFullYear(), now.getMonth()-1, 28)); end = formatLocal(new Date(now.getFullYear(), now.getMonth(), 27)); } setActiveFilter('period'); setDateRange({ start, end }); setDateRangeDisplay({ start: displayDateID(start), end: displayDateID(end) }); }}>Periode Ini</Button>
             </div>
             <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <div className="flex items-center px-2 text-xs font-medium text-slate-500"><Calendar className="w-3.5 h-3.5 mr-1.5" />Periode:</div>
                <div className="relative">
                    <Input value={dateRangeDisplay.start} onChange={(e) => setDateRangeDisplay(p=>({...p, start: e.target.value}))} onClick={() => setShowStartCalendar(true)} className="w-32 text-xs h-8 bg-white border-slate-200" placeholder="dd/MM/yyyy" />
                    {showStartCalendar && (<div className="absolute top-full left-0 z-50 mt-1"><DatePicker value={parseDateFromDisplay(dateRangeDisplay.start)} onChange={(val) => { setDateRange(p => ({...p, start: val})); setDateRangeDisplay(p => ({...p, start: displayDateID(val)})); setShowStartCalendar(false); }} onClose={() => setShowStartCalendar(false)} /></div>)}
                </div>
                <span className="text-slate-400">-</span>
                <div className="relative">
                    <Input value={dateRangeDisplay.end} onChange={(e) => setDateRangeDisplay(p=>({...p, end: e.target.value}))} onClick={() => setShowEndCalendar(true)} className="w-32 text-xs h-8 bg-white border-slate-200" placeholder="dd/MM/yyyy" />
                    {showEndCalendar && (<div className="absolute top-full left-0 z-50 mt-1"><DatePicker value={parseDateFromDisplay(dateRangeDisplay.end)} onChange={(val) => { setDateRange(p => ({...p, end: val})); setDateRangeDisplay(p => ({...p, end: displayDateID(val)})); setShowEndCalendar(false); }} onClose={() => setShowEndCalendar(false)} /></div>)}
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchRecaps()} className="h-8"><RefreshCcw className="w-3.5 h-3.5" /></Button>
                <div className="flex items-center px-3 h-8 rounded-md bg-emerald-50 border border-emerald-200">
                    <span className="text-xs font-bold text-emerald-700">Total: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalAmount)}</span>
                </div>
            </div>
            <div className="relative">
                <CreditCard className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                <select
                    value={selectedPaymentMethod}
                    onChange={(e) => { setSelectedPaymentMethod(e.target.value); setCurrentPage(1); }}
                    className={`h-9 rounded-md pl-9 pr-8 text-xs appearance-none cursor-pointer border ${selectedPaymentMethod ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                    <option value="">Semua Metode Pembayaran</option>
                    {paymentMethodOptions.map((pm) => (
                        <option key={pm.id} value={pm.label}>{pm.label}</option>
                    ))}
                </select>
            </div>
            <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Cari Pasien..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[200px] h-9 pl-9 text-xs" /></div>
            <Button onClick={handleAddClick} className="gap-2 bg-blue-600 hover:bg-blue-700 h-9"><Plus className="w-4 h-4" /> Tambah Daily Recap</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-center">Tanggal</th>
                <th className="px-4 py-3 text-center">Nama Pasien</th>
                <th className="px-4 py-3 text-center">Diagnosa</th>
                <th className="px-4 py-3 text-center">Layanan</th>
                <th className="px-4 py-3 text-center">Tipe Pasien</th>
                <th className="px-4 py-3 text-center">Paket</th>
                <th className="px-4 py-3 text-center">Terapis</th>
                <th className="px-4 py-3 text-center">Nominal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center min-w-[140px]">Waktu Sesi</th>
                <th className="px-4 py-3 text-center">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRecaps ? ( <tr><td colSpan={11} className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-blue-500" /></td></tr> ) : recaps.length === 0 ? ( <tr><td colSpan={11} className="p-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center py-6">
                       <Search className="w-8 h-8 text-slate-300 mb-2" />
                       <p>Tidak ada data rekap harian.</p>
                   </div>
              </td></tr> ) : (
                recaps.map((recap, index) => {
                   // Map single fields using optionsMap
                   const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
                   const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
                   const packageLabel = recap.package_type || '-';

                   return (
                      <motion.tr 
                        key={recap.id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className={cn(index % 2 === 0 ? 'bg-white' : 'bg-slate-50', "hover:bg-blue-50 cursor-pointer transition-colors")}
                        onClick={() => handleRowClick(recap)}
                      >
                        <td className="px-4 py-3 text-center">{recap.date ? formatDateIndonesian(recap.date) : '-'}</td>
                        
                        <td className="px-4 py-3 text-center">
                            {renderPatientName(recap)}
                        </td>

                        <td className="px-4 py-3 text-center max-w-[200px] whitespace-normal">{renderDiagnoses(recap.diagnosis)}</td>
                        <td className="px-4 py-3 text-center"><Badge variant="outline" className="font-normal text-[10px]">{serviceLabel}</Badge></td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-[10px] font-normal">{patientTypeLabel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-blue-600">{packageLabel}</td>
                        
                        <td className="px-4 py-3 text-center">
                            {recap.display_therapist_name}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="font-medium text-slate-800">Rp {parseFloat(recap.amount || 0).toLocaleString('id-ID')}</div>
                          {recap.payment_method && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5 capitalize">{recap.payment_method}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                            {recap.end_time ? <Badge className="bg-green-100 text-green-800 border-0">Selesai</Badge> : 
                             recap.start_time ? <Badge className="bg-blue-100 text-blue-800 border-0">Berlangsung</Badge> : 
                             <Badge variant="outline" className="text-slate-500 border-slate-200">Belum</Badge>}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {!recap.start_time ? (
                                <Button size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 w-full" onClick={(e) => handleStartTime(e, recap.id)} disabled={loadingRecaps}>
                                    {loadingRecaps ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mulai"}
                                </Button>
                            ) : !recap.end_time ? (
                                <div className="flex flex-col w-full gap-1">
                                    <div className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-100 w-full text-center">
                                        {formatTime(new Date(recap.start_time))}
                                    </div>
                                    <Button size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white w-full" onClick={(e) => handleEndTime(e, recap.id)} disabled={loadingRecaps}>
                                        {loadingRecaps ? <Loader2 className="w-3 h-3 animate-spin" /> : "Selesai"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center bg-slate-100 px-2 py-1 rounded border border-slate-200 w-full">
                                    <span className="font-mono text-slate-700 text-[10px] font-medium">{formatTime(new Date(recap.start_time))}</span>
                                    <span className="text-slate-400 text-[8px] leading-none">↓</span>
                                    <span className="font-mono text-slate-700 text-[10px] font-medium">{formatTime(new Date(recap.end_time))}</span>
                                </div>
                            )}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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
                            {recap.invoice_wa_status && (
                              <span
                                title={
                                  recap.invoice_wa_status === 'gagal'
                                    ? 'Gagal dikirim'
                                    : 'Status berdasarkan respons API — bukan konfirmasi pasien menerima. Jika pasien 24 jam terakhir tidak WA klinik, pesan bisa gagal masuk walau status ini hijau.'
                                }
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                  recap.invoice_wa_status === 'gagal'
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {recap.invoice_wa_status === 'gagal' ? '✕ Gagal' : '✓ Terkirim'}
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                   );
                })
              )}
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
          mode={modalMode}
          initialData={selectedRecap}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchRecaps}
      />

      <DailyRecapDetailModal
          isOpen={isDetailModalOpen}
          recap={selectedRecap}
          onClose={() => setIsDetailModalOpen(false)}
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

export default OwnerDailyRecap;