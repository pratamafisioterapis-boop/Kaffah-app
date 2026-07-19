import React, { useState, useEffect } from 'react';
import { getServiceRates } from '@/lib/api';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, Calculator, AlertCircle, DollarSign, Calendar, User, 
  TrendingUp, Wallet, ShieldCheck, Briefcase 
} from 'lucide-react';
import { 
  getAllPhysiotherapists, getActivePhysiotherapists, getDailyRecaps, getTherapistSchedules, 
  getTherapistTimeOff, getOperationalOptions 
} from '@/lib/api';
import {
  calculateAttendanceDays, calculateFullSalary, calculateCustomSalary,
  calculateTotalSalary, formatCurrency, cn, getTherapistPeriodRange
} from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const SalaryCalculator = ({ dateRange, setDateRange }) => {
  useEffect(() => {
  console.log('DATE RANGE UPDATED:', dateRange);
}, [dateRange]);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  const { toast } = useToast();
  
  // Data State
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [patientTypeRates, setPatientTypeRates] = useState({}); // { 'Type': Price }
  
 

  // Calculation State
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [calculatingAll, setCalculatingAll] = useState(false);
  const [selectedTherapistDetail, setSelectedTherapistDetail] = useState(null); // detail view
  const [selectedPatientType, setSelectedPatientType] = useState(null); // drill-down tipe pasien
  
  // Custom Rates Input (for manual override or config)
  const [customRates, setCustomRates] = useState({});

  // Periode diatur sekali di kartu terapis (Manajemen Terapis) dan dipakai otomatis
  // di sini per terapis. Matikan untuk query manual pakai rentang tanggal bebas.
  const [useAutoPeriod, setUseAutoPeriod] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
  try {
    const [therapistRes, ratesRes] = await Promise.all([
      getActivePhysiotherapists(),
      getServiceRates()
    ]);

    if (therapistRes.data) setTherapists(therapistRes.data);

    // 🔥 mapping rate dari DB
    const rateMap = {};
    (ratesRes.data || []).forEach(r => {
      rateMap[r.service_name] = r.rate;
    });

    setCustomRates(rateMap);

  } catch (err) {
    console.error(err);
  }
};

  const handleCalculate = async () => {
    if (!selectedTherapistId) {
      toast({ variant: "destructive", title: "Pilih Terapis", description: "Silakan pilih terapis terlebih dahulu." });
      return;
    }

    setCalculating(true);
    setResult(null);

    try {
      const therapist = therapists.find(t => t.id === selectedTherapistId);
      if (!therapist) throw new Error("Therapist not found");

      // Calculate Dates
      const { startDateStr, endDateStr } = getEffectiveRange(therapist);

      // Fetch Data
      const [recapsRes, scheduleRes, timeOffRes] = await Promise.all([
  getDailyRecaps({
    startDate: startDateStr,
    endDate: endDateStr,
    therapistId: selectedTherapistId,
    limit: 'all'
  }),
  getTherapistSchedules(selectedTherapistId),
  getTherapistTimeOff(selectedTherapistId)
]);

      // Filter recaps for this therapist specifically
      // Note: getDailyRecaps might return all, so we filter client side if API doesn't support specific therapist filter in one go
      // API update in Task 5 requested ensure getDailyRecaps supports filters. We'll filter here to be safe.
      const therapistRecaps = recapsRes.data || [];
      console.log("RECAPS DATA:", therapistRecaps);
      
      // 1. Calculate Attendance
      const attendanceDays = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr);
      
      // 2. Base Salary & Transport
      const baseSalary = parseFloat(therapist.base_salary) || 0; // Monthly

      // 3. Commission / Service Fee
      let commission = 0;
      let breakdown = {};
      let transportAllowance = 0;

      const salaryType = therapist.salary_scheme || 'full_salary'; // 'full_salary' | 'custom_salary' | 'probation'

      if (salaryType === 'probation') {
         // Probation: take-home pay only — no jasa/commission, no transport.
      } else {
        transportAllowance = (parseFloat(therapist.transport_per_day) || 0) * attendanceDays;

        if (salaryType === 'full_salary') {
           // "Full Salary" logic: Sum of nominal_per_sesi (amount)
           commission = calculateFullSalary(therapistRecaps);
        } else {
           // "Custom Salary" logic: Session Count * Rate
           commission = calculateCustomSalary(therapistRecaps, customRates);

           // Generate breakdown for custom
           therapistRecaps.forEach(r => {
               const type = r.patient_type || 'General';
               breakdown[type] = (breakdown[type] || 0) + 1;
           });
        }
      }

      const total = baseSalary + transportAllowance + commission;

      const salaryTypeLabel = salaryType === 'full_salary'
        ? 'Full Salary (Omzet)'
        : salaryType === 'probation'
          ? 'Probation (Take Home Pay)'
          : 'Custom Salary (Jasa)';

      setResult({
        therapistName: therapist.name,
        period: `${startDateStr} s/d ${endDateStr}`,
        salaryType: salaryTypeLabel,
        attendanceDays,
        baseSalary,
        transportAllowance,
        commission,
        total,
        breakdown,
        sessionCount: therapistRecaps.length
      });

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Calculation Error", description: error.message });
    } finally {
      setCalculating(false);
    }
  };

  const handleRateChange = (type, value) => {
      setCustomRates(prev => ({ ...prev, [type]: value }));
  };

  // Rentang efektif untuk satu terapis: mengikuti Periode yang diatur di kartu
  // terapis (default), atau rentang tanggal manual jika useAutoPeriod dimatikan.
  const getEffectiveRange = (therapist) => {
    if (useAutoPeriod) {
      const { startDate, endDate } = getTherapistPeriodRange(therapist);
      return { startDateStr: format(startDate, 'yyyy-MM-dd'), endDateStr: format(endDate, 'yyyy-MM-dd') };
    }
    return { startDateStr: dateRange?.startDate, endDateStr: dateRange?.endDate };
  };

  const handlePeriodeIni = () => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), 27);
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 28);
    setDateRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') });
  };

  const calcOneTherapist = async (therapist) => {
    const salaryScheme = therapist.salary_scheme || 'full_salary';

    const { startDateStr, endDateStr } = getEffectiveRange(therapist);

    // Fetch recaps dengan data pasien & package tracking
    const { data: rawRecaps } = await supabase
      .from('daily_recaps')
      .select(`
        id, recap_date, amount, amount_package, patient_type, package_type, discount_type, discount_value,
        patient:patients!patient_id (id, full_name),
        actual_patient:patients!actual_patient_id (id, full_name),
        package_tracking:package_tracking_id (id, nominal, total_sessions, package_name)
      `)
      .eq('therapist_id', therapist.id)
      .gte('recap_date', startDateStr)
      .lte('recap_date', endDateStr)
      .order('recap_date', { ascending: true });

    const [scheduleRes, timeOffRes, optionsRes] = await Promise.all([
      getTherapistSchedules(therapist.id),
      getTherapistTimeOff(therapist.id),
      supabase.from('operational_options').select('id, label').eq('is_active', true)
    ]);

    const optionsMap = (optionsRes.data || []).reduce((acc, o) => { acc[o.id] = o.label; return acc; }, {});
    const therapistRecaps = rawRecaps || [];
    console.log('SAMPLE RECAP patient_type:', therapistRecaps[0]?.patient_type, 'customRates keys:', Object.keys(customRates));

    const attendanceDays = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr);
    const baseSalary = parseFloat(therapist.base_salary) || 0;
    const transportPerDay = parseFloat(therapist.transport_per_day) || 0;
    const salaryType = therapist.salary_scheme || 'full_salary';
    const isProbation = salaryType === 'probation';
    const transportAllowance = isProbation ? 0 : transportPerDay * attendanceDays;

    let commission = 0;
    const breakdownByType = {}; // { patientTypeLabel: { count, totalAmount, sessions: [] } }

    // Probation: take-home pay only — no jasa/commission is computed from recaps.
    (isProbation ? [] : therapistRecaps).forEach(r => {
      const typeLabel = optionsMap[r.patient_type] || r.patient_type || 'Umum';
      const pkgTracking = r.package_tracking;
      const totalSessions = pkgTracking?.total_sessions || 1;
      const pkgNominal = pkgTracking?.nominal || 0;
      const pkgName = optionsMap[r.package_type] || r.package_type || 'Visit';

      let sessionAmount = 0;
      if (salaryType === 'full_salary') {
        if (totalSessions > 1 && pkgNominal > 0) {
          // Paket multi-sesi: rata-rata dari harga paket dibagi total sesi
          sessionAmount = Math.floor(pkgNominal / totalSessions);
        } else {
          // Sesi tunggal / visit: pakai amount langsung (sudah setelah diskon)
          sessionAmount = Number(r.amount || 0);
        }
      } else {
        // custom salary: patient_type di DB adalah text label langsung (misal "DUA KELUHAN")
        // customRates key bisa berupa label atau UUID, coba exact match dulu lalu fuzzy
        const ptLabel = (r.patient_type || '').toUpperCase();
        const matchedKey = Object.keys(customRates).find(k =>
          k.toUpperCase() === ptLabel ||
          k.toUpperCase().includes(ptLabel) ||
          ptLabel.includes(k.toUpperCase())
        );
        sessionAmount = parseFloat(customRates[matchedKey] || 0);
        // Fallback: kalau rate tidak ketemu, set 0 (tidak diketahui)
        // jangan fallback ke amount karena amount = yang dibayar pasien bukan rate terapis
      }

      commission += sessionAmount;

      if (!breakdownByType[typeLabel]) {
        breakdownByType[typeLabel] = { count: 0, totalAmount: 0, sessions: [] };
      }
      breakdownByType[typeLabel].count += 1;
      breakdownByType[typeLabel].totalAmount += sessionAmount;
      const originalAmount = Number(r.amount || 0);
      // Nominal paket = yang dibayar pasien (selalu dari r.amount)
      // Untuk paket multi-sesi: nominal paket = pkgNominal (harga total paket)
      // Untuk visit/sesi tunggal: nominal paket = r.amount
      const displayNominal = totalSessions > 1 ? pkgNominal : originalAmount;

      breakdownByType[typeLabel].sessions.push({
        date: r.recap_date,
        patientName: r.actual_patient?.full_name || r.patient?.full_name || '-',
        packageName: pkgName,
        totalSessions,
        pkgNominal: displayNominal,  // yang dibayar pasien
        amount: sessionAmount,        // insentif terapis
        isPackage: totalSessions > 1,
        discountType: r.discount_type || 'none',
        discountValue: r.discount_value || 0,
        rawAmount: originalAmount
      });
    });

    const total = baseSalary + transportAllowance + commission;

    return {
      id: therapist.id,
      name: therapist.name,
      period: `${format(new Date(startDateStr), 'dd/MM/yyyy')} s/d ${format(new Date(endDateStr), 'dd/MM/yyyy')}`,
      salaryType: salaryType === 'full_salary' ? 'Full Salary' : salaryType === 'probation' ? 'Probation' : 'Custom Salary',
      attendanceDays,
      transportPerDay,
      baseSalary,
      transportAllowance,
      commission,
      total,
      breakdownByType,
      sessionCount: therapistRecaps.length
    };
  };

  const handleCalculateAll = async () => {
    if (!therapists.length) return;
    setCalculatingAll(true);
    setAllResults([]);
    try {
      const results = await Promise.all(therapists.map(t => calcOneTherapist(t)));
      setAllResults(results.sort((a, b) => b.total - a.total));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setCalculatingAll(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
  const fmtShort = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}jt`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}rb`;
    return String(n);
  };
  const fmtDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy', { locale: idLocale }); } catch { return d; } };

  const salaryBadgeStyle = (salaryType) => {
    if (salaryType === 'Full Salary') return { background: '#ecfdf5', color: '#059669', border: '1px solid #bbf7d0' };
    if (salaryType === 'Probation') return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
    return { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' };
  };

  // ── Detail panel saat klik nama terapis ──
  if (selectedTherapistDetail) {
    const d = selectedTherapistDetail;
    return (
      <div className="space-y-4">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedTherapistDetail(null); setSelectedPatientType(null); }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
            ← Kembali
          </button>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{d.name}</h3>
            <p className="text-xs text-slate-400">{d.period} · {d.salaryType}</p>
          </div>
        </div>

        {/* Summary komponen gaji */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Gaji Pokok', value: fmt(d.baseSalary), color: '#4f46e5', bg: '#eef2ff' },
            { label: `Transport (${d.attendanceDays} hari × ${fmtShort(d.transportPerDay)})`, value: fmt(d.transportAllowance), color: '#0891b2', bg: '#ecfeff' },
            { label: d.salaryType === 'Full Salary' ? 'Total Omzet' : d.salaryType === 'Probation' ? 'Jasa (Tidak Berlaku)' : 'Total Insentif', value: fmt(d.commission), color: '#7c3aed', bg: '#ede9fe' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-xl p-4 min-w-0" style={{ background: bg }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</div>
              <div className="text-base font-bold break-words" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Total Estimasi Gaji</span>
          <span className="text-lg font-bold" style={{ color: '#4ade80' }}>{fmt(d.total)}</span>
        </div>

        {/* Breakdown per tipe pasien */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
          <div className="px-4 py-3" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Insentif / Omzet per Tipe Pasien</span>
            <span className="ml-2 text-xs text-slate-400">— klik untuk lihat detail</span>
          </div>
          {Object.entries(d.breakdownByType).map(([type, info], idx) => (
            <div key={type}>
              <button
                onClick={() => setSelectedPatientType(selectedPatientType === type ? null : type)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
                style={{ background: selectedPatientType === type ? '#eef2ff' : idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: '#ede9fe', color: '#7c3aed' }}>
                    {info.count}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{type}</div>
                    <div className="text-[10px] text-slate-400">{info.count} sesi</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: '#7c3aed' }}>{fmt(info.totalAmount)}</div>
                  <div className="text-[10px] text-slate-400">{selectedPatientType === type ? '▲ tutup' : '▼ detail'}</div>
                </div>
              </button>

              {/* Drill-down: list sesi per tipe pasien */}
              {selectedPatientType === type && (
                <>
                  <div className="sm:hidden" style={{ background: '#faf9ff', borderBottom: '1px solid #e2e8f0' }}>
                    {info.sessions.map((s, i) => (
                      <div key={i} className="px-4 py-3" style={{ borderBottom: '1px solid #f1f0ff', background: i % 2 === 0 ? 'white' : '#faf9ff' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-700">{s.patientName}</span>
                          <span className="text-sm font-bold shrink-0" style={{ color: '#059669' }}>{fmt(s.amount)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                            {fmtDate(s.date)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                            {s.packageName}
                          </span>
                          {s.isPackage && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                              {s.totalSessions} sesi
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            Nominal paket: {fmt(s.pkgNominal)}
                          </span>
                        </div>
                        {s.discountType && s.discountType !== 'none' && s.discountValue > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="line-through text-slate-400 text-[10px]">
                              {s.discountType === 'percentage'
                                ? fmt(Math.round(s.rawAmount / (1 - s.discountValue / 100)))
                                : fmt(s.rawAmount + s.discountValue)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                              {s.discountType === 'percentage' ? `-${s.discountValue}%` : `-${fmtShort(s.discountValue)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                      <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>Subtotal:</span>
                      <span className="font-bold text-sm" style={{ color: '#059669' }}>{fmt(info.totalAmount)}</span>
                    </div>
                  </div>
                <div className="hidden sm:block overflow-x-auto" style={{ background: '#faf9ff', borderBottom: '1px solid #e2e8f0' }}>
                  <table className="w-full" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f5f3ff', borderBottom: '1px solid #ede9fe' }}>
                        {['Tanggal', 'Nama Pasien', 'Paket', 'Total Sesi', 'Nominal Paket', 'Diskon', 'Insentif/Sesi'].map(h => (
                          <th key={h} className="px-4 py-2 text-left"
                            style={{ color: '#7c3aed', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {info.sessions.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f0ff', background: i % 2 === 0 ? 'white' : '#faf9ff' }}>
                          <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmtDate(s.date)}</td>
                          <td className="px-4 py-2 font-semibold text-slate-700">{s.patientName}</td>
                          <td className="px-4 py-2 text-slate-500">{s.packageName}</td>
                          <td className="px-4 py-2 text-center">
                            {s.isPackage
                              ? <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: '#ede9fe', color: '#7c3aed' }}>{s.totalSessions} sesi</span>
                              : <span className="text-slate-400">Visit</span>}
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {fmt(s.pkgNominal)}
                          </td>
                          <td className="px-4 py-2">
                            {s.discountType && s.discountType !== 'none' && s.discountValue > 0 ? (
                              <div>
                                <span className="line-through text-slate-400 text-[10px] mr-1">
                                  {s.discountType === 'percentage'
                                    ? fmt(Math.round(s.rawAmount / (1 - s.discountValue / 100)))
                                    : fmt(s.rawAmount + s.discountValue)}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                                  {s.discountType === 'percentage' ? `-${s.discountValue}%` : `-${fmtShort(s.discountValue)}`}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 font-bold" style={{ color: '#059669' }}>{fmt(s.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                        <td colSpan={6} className="px-4 py-2 text-right text-xs font-bold" style={{ color: '#7c3aed' }}>Subtotal:</td>
                        <td className="px-4 py-2 font-bold text-sm" style={{ color: '#059669' }}>{fmt(info.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <Calculator className="w-4 h-4" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Salary Calculator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Estimasi gaji semua terapis aktif dalam periode</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full w-fit" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
          Estimasi — Frontend Only
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2.5 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5" />
            Periode:
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer select-none" style={{ color: '#7c3aed' }}>
            <input
              type="checkbox"
              checked={useAutoPeriod}
              onChange={e => setUseAutoPeriod(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Otomatis (dari kartu terapis)
          </label>
        </div>

        {useAutoPeriod ? (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            Setiap terapis dihitung memakai Periode masing-masing (diatur di kartu terapis, tab Data Terapis). Matikan toggle di atas untuk memakai rentang tanggal manual.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 w-full">
              <input
                type="date"
                value={dateRange?.startDate || ''}
                onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white flex-1 min-w-0"
                style={{ colorScheme: 'light' }}
              />
              <span className="text-slate-300 text-sm shrink-0">–</span>
              <input
                type="date"
                value={dateRange?.endDate || ''}
                onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white flex-1 min-w-0"
                style={{ colorScheme: 'light' }}
              />
            </div>
            <button
              onClick={handlePeriodeIni}
              className="text-xs px-3 py-2 rounded-lg font-semibold transition-all w-full"
              style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}
            >
              Periode Ini (28 - 27)
            </button>
          </>
        )}

        <button
          onClick={handleCalculateAll}
          disabled={calculatingAll || !therapists.length}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all w-full"
          style={{ background: calculatingAll ? '#a78bfa' : '#7c3aed' }}
        >
          {calculatingAll
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung...</>
            : <><Calculator className="w-3.5 h-3.5" /> Hitung Semua</>
          }
        </button>
      </div>

      {/* Table */}
      {allResults.length > 0 ? (
        <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #ede9fe', boxShadow: '0 1px 6px #7c3aed12' }}>
          <>
            <div className="sm:hidden">
              {allResults.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedTherapistDetail(r); setSelectedPatientType(null); }}
                  className="w-full text-left px-4 py-3"
                  style={{ background: idx % 2 === 0 ? 'white' : '#faf9ff', borderBottom: '1px solid #f1f0ff' }}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: idx === 0 ? '#fef3c7' : '#f1f5f9', color: idx === 0 ? '#92400e' : '#64748b' }}>
                      {idx + 1}
                    </span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ background: '#ede9fe', color: '#7c3aed' }}>
                      {r.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-semibold flex-1 truncate" style={{ color: '#7c3aed' }}>{r.name}</span>
                    <div className="font-bold text-sm shrink-0" style={{ color: '#059669' }}>{fmt(r.total)}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={salaryBadgeStyle(r.salaryType)}>
                      {r.salaryType}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      {r.sessionCount} sesi
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      {r.attendanceDays} hari kerja
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      Pokok: {fmtShort(r.baseSalary)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                      Transport: {fmtShort(r.transportAllowance)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                      Komisi: {fmtShort(r.commission)}
                    </span>
                  </div>
                </button>
              ))}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                <span className="font-bold text-xs" style={{ color: '#7c3aed' }}>Total Seluruh Gaji:</span>
                <span className="font-bold text-sm" style={{ color: '#059669' }}>
                  {fmt(allResults.reduce((s, r) => s + r.total, 0))}
                </span>
              </div>
            </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#f5f3ff', borderBottom: '2px solid #ede9fe' }}>
                  {['#', 'Fisioterapis', 'Tipe Gaji', 'Periode', 'Sesi', 'Hari Kerja', 'Gaji Pokok', 'Transport', 'Komisi/Omzet', 'Total Estimasi'].map((h, i) => (
                    <th key={i} className="px-4 py-3 whitespace-nowrap text-left"
                      style={{ color: '#7c3aed', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allResults.map((r, idx) => (
                  <tr key={r.id}
                    style={{ background: idx % 2 === 0 ? 'white' : '#faf9ff', borderBottom: '1px solid #f1f0ff', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#faf9ff'}>
                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: idx === 0 ? '#fef3c7' : '#f1f5f9', color: idx === 0 ? '#92400e' : '#64748b' }}>
                        {idx + 1}
                      </span>
                    </td>
                    {/* Name — klik untuk detail */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedTherapistDetail(r); setSelectedPatientType(null); }}
                        className="flex items-center gap-2.5 hover:underline text-left">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          {r.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-semibold truncate max-w-[130px]" style={{ color: '#7c3aed' }}>{r.name}</span>
                      </button>
                    </td>
                    {/* Salary type badge */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                        style={{
                          background: r.salaryType === 'Full Salary' ? '#ecfdf5' : '#eff6ff',
                          color: r.salaryType === 'Full Salary' ? '#059669' : '#2563eb',
                          border: `1px solid ${r.salaryType === 'Full Salary' ? '#bbf7d0' : '#bfdbfe'}`
                        }}>
                        {r.salaryType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[10px] whitespace-nowrap">{r.period}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{r.sessionCount}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{r.attendanceDays} hari</td>
                    <td className="px-4 py-3 text-slate-500">{fmtShort(r.baseSalary)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtShort(r.transportAllowance)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#7c3aed' }}>{fmtShort(r.commission)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-sm" style={{ color: '#059669' }}>{fmt(r.total)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                  <td colSpan={9} className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#7c3aed' }}>
                    Total Seluruh Gaji:
                  </td>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: '#059669' }}>
                    {fmt(allResults.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>

          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ borderTop: '1px solid #ede9fe', background: '#faf9ff' }}>
            {[
              { label: 'Total Terapis', value: `${allResults.length} orang`, icon: User },
              { label: 'Total Sesi', value: `${allResults.reduce((s, r) => s + r.sessionCount, 0)} sesi`, icon: TrendingUp },
              { label: 'Total Payroll', value: fmt(allResults.reduce((s, r) => s + r.total, 0)), icon: Wallet },
            ].map(({ label, value, icon: Icon }, i) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3 min-w-0"
                style={{ borderRight: !isPWA && i < 2 ? '1px solid #ede9fe' : 'none', borderBottom: isPWA && i < 2 ? '1px solid #ede9fe' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#ede9fe' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>{label}</div>
                  <div className="text-sm font-bold text-slate-700 break-words">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: '#faf9ff', border: '1px dashed #ddd6fe' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#ede9fe' }}>
            <Calculator className="w-7 h-7" style={{ color: '#7c3aed' }} />
          </div>
          <p className="text-sm font-semibold text-slate-600">Belum ada data kalkulasi</p>
          <p className="text-xs text-slate-400 mt-1">Pilih periode lalu tekan <strong>Hitung Semua</strong></p>
        </div>
      )}
    </div>
  );
};

export default SalaryCalculator;