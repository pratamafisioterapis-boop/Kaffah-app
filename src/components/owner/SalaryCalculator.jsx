import React, { useState, useEffect } from 'react';
import { getServiceRates } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Calculator, Calendar, User, TrendingUp, Wallet, Users, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { 
  getAllPhysiotherapists, getActivePhysiotherapists, getDailyRecaps, getTherapistSchedules, 
  getTherapistTimeOff, getTherapistExtraShifts, getOperationalOptions 
} from '@/lib/api';
import {
  calculateAttendanceDays, calculateFullSalary, calculateCustomSalary,
  calculateTotalSalary, formatCurrency, cn, getTherapistPeriodRange,
  resolvePatientTypeRate, buildPatientTypeRateIndex
} from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import FinanceTile from '@/components/owner/finance/FinanceTile';
import { Pill } from '@/components/owner/finance/TxList';
import { fmtShort, fmtRp } from '@/components/owner/finance/financeTheme';

const SalaryCalculator = ({ dateRange, setDateRange }) => {
  useEffect(() => {
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
  
  // Baris mentah service_rates (tarif umum + override per terapis) — index
  // per Tipe Pasien dibangun ulang per terapis lewat buildPatientTypeRateIndex
  // supaya override khusus terapis tsb ikut dipakai.
  const [serviceRateRows, setServiceRateRows] = useState([]);

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

    // Baris mentah disimpan; index-nya dibangun ulang per terapis saat
    // dipakai (buildPatientTypeRateIndex(serviceRateRows, therapistId)) supaya
    // tarif custom per terapis tertentu ikut didahulukan atas tarif umum.
    setServiceRateRows(ratesRes.data || []);

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
      const [recapsRes, scheduleRes, timeOffRes, extraShiftRes] = await Promise.all([
  getDailyRecaps({
    startDate: startDateStr,
    endDate: endDateStr,
    therapistId: selectedTherapistId,
    limit: 'all'
  }),
  getTherapistSchedules(selectedTherapistId),
  getTherapistTimeOff(selectedTherapistId),
  getTherapistExtraShifts(selectedTherapistId)
]);

      // Filter recaps for this therapist specifically
      // Note: getDailyRecaps might return all, so we filter client side if API doesn't support specific therapist filter in one go
      // API update in Task 5 requested ensure getDailyRecaps supports filters. We'll filter here to be safe.
      const therapistRecaps = recapsRes.data || [];
      
      // 1. Calculate Attendance
      const attendanceDays = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr, extraShiftRes.data || []);
      
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
           commission = calculateCustomSalary(therapistRecaps, buildPatientTypeRateIndex(serviceRateRows, therapist.id));

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
        id, recap_date, amount, amount_package, patient_type, patient_type_ids, package_type, discount_type, discount_value,
        patient:patients!patient_id (id, full_name),
        actual_patient:patients!actual_patient_id (id, full_name),
        package_tracking:package_tracking_id (id, nominal, total_sessions, package_name)
      `)
      .eq('therapist_id', therapist.id)
      .gte('recap_date', startDateStr)
      .lte('recap_date', endDateStr)
      .order('recap_date', { ascending: true });

    const [scheduleRes, timeOffRes, extraShiftRes, optionsRes] = await Promise.all([
      getTherapistSchedules(therapist.id),
      getTherapistTimeOff(therapist.id),
      getTherapistExtraShifts(therapist.id),
      supabase.from('operational_options').select('id, label').eq('is_active', true)
    ]);

    const optionsMap = (optionsRes.data || []).reduce((acc, o) => { acc[o.id] = o.label; return acc; }, {});
    const therapistRecaps = rawRecaps || [];
    const therapistRates = buildPatientTypeRateIndex(serviceRateRows, therapist.id);

    const attendanceDays = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr, extraShiftRes.data || []);
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
        // custom salary: dicocokkan lewat patient_type_ids (ID operational_options)
        // dulu — tidak pernah salah tangkap lewat teks. Fallback ke teks (exact lalu
        // pecah-kombinasi) untuk recap lama yang belum punya patient_type_ids.
        // Kalau rate tidak ketemu sama sekali, hasilnya 0 (tidak diketahui) — jangan
        // fallback ke amount karena amount = yang dibayar pasien bukan rate terapis.
        sessionAmount = resolvePatientTypeRate(r.patient_type, therapistRates, { typeIds: r.patient_type_ids });
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

  const fmtDate = (d) => { try { return format(new Date(d), 'dd MMM yyyy', { locale: idLocale }); } catch { return d; } };
  const schemeTone = (salaryType) => (salaryType === 'Full Salary' ? 'pos' : salaryType === 'Probation' ? 'warn' : 'sky');

  // ── Detail panel saat klik nama terapis ──
  if (selectedTherapistDetail) {
    const d = selectedTherapistDetail;
    const parts = [
      { label: 'Gaji Pokok', value: d.baseSalary, cls: 'bg-blue-50 text-blue-600' },
      { label: `Transport (${d.attendanceDays} hari × ${fmtShort(d.transportPerDay)})`, value: d.transportAllowance, cls: 'bg-teal-50 text-teal-600' },
      { label: d.salaryType === 'Full Salary' ? 'Total Omzet' : d.salaryType === 'Probation' ? 'Jasa (Tidak Berlaku)' : 'Total Insentif', value: d.commission, cls: 'bg-violet-50 text-violet-600' },
    ];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSelectedTherapistDetail(null); setSelectedPatientType(null); }}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[10px] bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali
          </button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 break-words">{d.name}</h3>
            <p className="text-xs text-slate-500">{d.period} · {d.salaryType}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {parts.map(({ label, value, cls }) => (
            <div key={label} className={cn('rounded-2xl p-4 min-w-0', cls)}>
              <p className="text-xs font-semibold opacity-85 break-words">{label}</p>
              <p className="text-lg font-black tabular-nums mt-1 break-words" title={fmtRp(value)}>{fmtRp(value)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 bg-slate-900">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Total Estimasi Gaji</span>
          <span className="text-xl font-black tabular-nums text-emerald-300">{fmtRp(d.total)}</span>
        </div>

        <FinanceTile tone="vio" icon={Users} title="Per Tipe Pasien" action={<span className="text-xs text-slate-500">Ketuk untuk detail</span>}>
          {Object.keys(d.breakdownByType).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Tidak ada jasa untuk skema ini.</p>
          ) : (
            <div className="grid gap-0.5">
              {Object.entries(d.breakdownByType).map(([type, info]) => {
                const open = selectedPatientType === type;
                return (
                  <div key={type}>
                    <button
                      type="button"
                      onClick={() => setSelectedPatientType(open ? null : type)}
                      aria-expanded={open}
                      className={cn('w-full grid grid-cols-[32px_1fr_auto_16px] items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-colors', open ? 'bg-slate-100' : 'hover:bg-slate-50')}
                    >
                      <span className="w-8 h-8 rounded-[10px] bg-violet-50 text-violet-600 flex items-center justify-center text-[13px] font-bold">{info.count}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 break-words">{type}</span>
                        <small className="text-xs text-slate-500">{info.count} sesi</small>
                      </span>
                      <span className="font-bold tabular-nums text-violet-600">{fmtRp(info.totalAmount)}</span>
                      <ChevronRight className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-90')} />
                    </button>

                    {open && (
                      <div className="pl-3 sm:pl-11 pr-1 pb-2">
                        {info.sessions.map((s, i) => (
                          <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2.5 border-t border-dashed border-slate-200 text-[12.5px]">
                            <span className="min-w-0 break-words">
                              <b className="font-semibold text-slate-800">{s.patientName}</b>
                              <span className="text-slate-500"> · {s.packageName}</span>
                            </span>
                            <b className="font-bold tabular-nums text-emerald-600">{fmtRp(s.amount)}</b>
                            <span className="col-span-2 flex flex-wrap items-center gap-1.5 text-slate-500">
                              <span>{fmtDate(s.date)}</span>
                              {s.isPackage && <Pill tone="vio">{s.totalSessions} sesi</Pill>}
                              <span>Nominal {fmtRp(s.pkgNominal)}</span>
                              {s.discountType && s.discountType !== 'none' && s.discountValue > 0 && (
                                <>
                                  <span className="line-through">
                                    {s.discountType === 'percentage'
                                      ? fmtRp(Math.round(s.rawAmount / (1 - s.discountValue / 100)))
                                      : fmtRp(s.rawAmount + s.discountValue)}
                                  </span>
                                  <Pill tone="warn">{s.discountType === 'percentage' ? `-${s.discountValue}%` : `-${fmtShort(s.discountValue)}`}</Pill>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 text-xs font-bold">
                          <span className="text-violet-600">Subtotal</span>
                          <span className="text-emerald-600 tabular-nums text-sm">{fmtRp(info.totalAmount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </FinanceTile>
      </div>
    );
  }

  const totalPayroll = allResults.reduce((s, r) => s + r.total, 0);
  const totalSessions = allResults.reduce((s, r) => s + r.sessionCount, 0);
  const topTotal = allResults[0]?.total || 1;

  return (
    <div className="space-y-4">
      {/* Periode + hitung */}
      <FinanceTile tone="vio" icon={Calendar} title="Periode">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <Switch checked={useAutoPeriod} onCheckedChange={setUseAutoPeriod} aria-label="Periode otomatis" />
            <span className="text-[13px] font-semibold text-slate-700">Otomatis dari kartu terapis</span>
          </label>
          <button
            type="button"
            onClick={handleCalculateAll}
            disabled={calculatingAll || !therapists.length}
            className="ml-auto inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 text-white text-[13px] font-semibold disabled:opacity-60 active:scale-[0.96] transition-transform"
          >
            {calculatingAll
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menghitung</>
              : <><Calculator className="w-4 h-4" /> Hitung Semua</>}
          </button>
        </div>

        {!useAutoPeriod && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              type="date"
              value={dateRange?.startDate || ''}
              onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="h-10 text-sm border border-slate-200 rounded-[10px] px-3 outline-none bg-slate-50 flex-1 min-w-[130px]"
              style={{ colorScheme: 'light' }}
              aria-label="Tanggal mulai"
            />
            <span className="text-slate-300">–</span>
            <input
              type="date"
              value={dateRange?.endDate || ''}
              onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="h-10 text-sm border border-slate-200 rounded-[10px] px-3 outline-none bg-slate-50 flex-1 min-w-[130px]"
              style={{ colorScheme: 'light' }}
              aria-label="Tanggal selesai"
            />
            <button
              type="button"
              onClick={handlePeriodeIni}
              className="h-10 px-3 rounded-[10px] bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
            >
              Periode 28 – 27
            </button>
          </div>
        )}
      </FinanceTile>

      {allResults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 rounded-[22px] border border-dashed border-violet-200 bg-violet-50/40 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
            <Calculator className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Belum ada hitungan</p>
          <p className="text-xs text-slate-500 mt-1">Tekan Hitung Semua</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {[
              { label: 'Terapis', value: `${allResults.length} orang`, icon: User, tone: 'vio' },
              { label: 'Sesi', value: `${totalSessions} sesi`, icon: TrendingUp, tone: 'sky' },
              { label: 'Payroll', value: fmtShort(totalPayroll), full: fmtRp(totalPayroll), icon: Wallet, tone: 'pos' },
            ].map(({ label, value, full, icon, tone }) => (
              <FinanceTile key={label} tone={tone} icon={icon} title={label} tinted>
                <p className="text-base sm:text-2xl font-black tabular-nums leading-none text-app-ink break-words">{value}</p>
                {full && <p className="hidden sm:block text-xs text-slate-500 mt-1.5 break-words">{full}</p>}
              </FinanceTile>
            ))}
          </div>

          <FinanceTile tone="vio" icon={Users} title="Ranking Gaji" action={<span className="text-xs text-slate-500">Ketuk nama untuk detail</span>}>
            <div className="grid gap-0.5">
              {allResults.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedTherapistDetail(r); setSelectedPatientType(null); }}
                  className="grid grid-cols-[26px_1fr_auto] items-center gap-3 px-1.5 py-2.5 rounded-2xl text-left hover:bg-slate-50 transition-colors"
                >
                  <span className={cn('w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-bold', idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>{idx + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 break-words">{r.name}</span>
                    <span className="flex flex-wrap gap-1.5 mt-1.5">
                      <Pill tone={schemeTone(r.salaryType)}>{r.salaryType}</Pill>
                      <Pill>{r.sessionCount} sesi</Pill>
                      <Pill>{r.attendanceDays} hari</Pill>
                    </span>
                    <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
                      <span className="block h-full rounded-full bg-violet-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(r.total / topTotal) * 100}%` }} />
                    </span>
                  </span>
                  <span className="text-right">
                    <b className="block text-base font-black tabular-nums text-emerald-600" title={fmtRp(r.total)}>{fmtShort(r.total)}</b>
                    <small className="text-[11px] text-slate-500">{fmtShort(r.baseSalary)} + {fmtShort(r.transportAllowance)} + {fmtShort(r.commission)}</small>
                  </span>
                </button>
              ))}
            </div>
          </FinanceTile>
        </>
      )}
    </div>
  );
};

export default SalaryCalculator;
