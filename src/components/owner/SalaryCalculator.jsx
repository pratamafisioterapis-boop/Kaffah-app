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
  calculateTotalSalary, formatCurrency, cn 
} from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const SalaryCalculator = ({ dateRange, setDateRange }) => {
  useEffect(() => {
  console.log('DATE RANGE UPDATED:', dateRange);
}, [dateRange]);
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
  
  // Custom Rates Input (for manual override or config)
  const [customRates, setCustomRates] = useState({});

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
      const startDateStr = dateRange?.startDate;
const endDateStr = dateRange?.endDate;

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
      const transportAllowance = (parseFloat(therapist.transport_per_day) || 0) * attendanceDays;

      // 3. Commission / Service Fee
      let commission = 0;
      let breakdown = {};
      
      const salaryType = therapist.salary_scheme || 'full_salary'; // 'full_salary' or 'custom_salary'

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

      const total = baseSalary + transportAllowance + commission;

      setResult({
        therapistName: therapist.name,
        period: `${startDateStr} s/d ${endDateStr}`,
        salaryType: salaryType === 'full_salary' ? 'Full Salary (Omzet)' : 'Custom Salary (Jasa)',
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

  const handlePeriodeIni = () => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), 27);
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 28);
    setDateRange({ startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') });
  };

  const calcOneTherapist = async (therapist) => {
    const salaryScheme = therapist.salary_scheme || 'full_salary';

    let startDateStr, endDateStr;
    if (salaryScheme === 'full_salary') {
      const now = new Date();
      startDateStr = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
      endDateStr = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
    } else {
      startDateStr = dateRange?.startDate;
      endDateStr = dateRange?.endDate;
    }

    const [recapsRes, scheduleRes, timeOffRes] = await Promise.all([
      getDailyRecaps({ startDate: startDateStr, endDate: endDateStr, therapistId: therapist.id, limit: 'all' }),
      getTherapistSchedules(therapist.id),
      getTherapistTimeOff(therapist.id)
    ]);
    const therapistRecaps = recapsRes.data || [];
    const attendanceDays = calculateAttendanceDays(scheduleRes.data || [], timeOffRes.data || [], startDateStr, endDateStr);
    const baseSalary = parseFloat(therapist.base_salary) || 0;
    const transportAllowance = (parseFloat(therapist.transport_per_day) || 0) * attendanceDays;
    const salaryType = therapist.salary_scheme || 'full_salary';
    let commission = 0;
    let breakdown = {};
    if (salaryType === 'full_salary') {
      commission = calculateFullSalary(therapistRecaps);
    } else {
      commission = calculateCustomSalary(therapistRecaps, customRates);
      therapistRecaps.forEach(r => {
        const type = r.patient_type || 'General';
        breakdown[type] = (breakdown[type] || 0) + 1;
      });
    }
    const total = baseSalary + transportAllowance + commission;
    return {
      id: therapist.id,
      name: therapist.name,
      period: `${format(new Date(startDateStr), 'dd/MM/yyyy')} s/d ${format(new Date(endDateStr), 'dd/MM/yyyy')}`,
      salaryType: salaryType === 'full_salary' ? 'Full Salary' : 'Custom Salary',
      attendanceDays,
      baseSalary,
      transportAllowance,
      commission,
      total,
      breakdown,
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
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Calendar className="w-3.5 h-3.5" />
          Periode:
        </div>
        <input
          type="date"
          value={dateRange?.startDate || ''}
          onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          style={{ colorScheme: 'light' }}
        />
        <span className="text-slate-300 text-sm">–</span>
        <input
          type="date"
          value={dateRange?.endDate || ''}
          onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          style={{ colorScheme: 'light' }}
        />
        <button
          onClick={handlePeriodeIni}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
          style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}
        >
          Periode Ini
        </button>
        <button
          onClick={handleCalculateAll}
          disabled={calculatingAll || !therapists.length}
          className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
          style={{ background: calculatingAll ? '#a78bfa' : '#7c3aed', minWidth: '130px', justifyContent: 'center' }}
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
          <div className="overflow-x-auto">
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
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          {r.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-700 truncate max-w-[130px]">{r.name}</span>
                      </div>
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
                    {/* Periode */}
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

          {/* Summary strip */}
          <div className="grid grid-cols-3" style={{ borderTop: '1px solid #ede9fe', background: '#faf9ff' }}>
            {[
              { label: 'Total Terapis', value: `${allResults.length} orang`, icon: User },
              { label: 'Total Sesi', value: `${allResults.reduce((s, r) => s + r.sessionCount, 0)} sesi`, icon: TrendingUp },
              { label: 'Total Payroll', value: fmt(allResults.reduce((s, r) => s + r.total, 0)), icon: Wallet },
            ].map(({ label, value, icon: Icon }, i) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3"
                style={{ borderRight: i < 2 ? '1px solid #ede9fe' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#ede9fe' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                </div>
                <div>
                  <div className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>{label}</div>
                  <div className="text-sm font-bold text-slate-700">{value}</div>
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