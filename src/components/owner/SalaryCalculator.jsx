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
  getAllPhysiotherapists, getDailyRecaps, getTherapistSchedules, 
  getTherapistTimeOff, getOperationalOptions 
} from '@/lib/api';
import { 
  calculateAttendanceDays, calculateFullSalary, calculateCustomSalary, 
  calculateTotalSalary, formatCurrency, cn 
} from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const SalaryCalculator = () => {
  const { toast } = useToast();
  
  // Data State
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [patientTypeRates, setPatientTypeRates] = useState({}); // { 'Type': Price }
  
  // Filter State
  const [dateRange, setDateRange] = useState({
  start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
});

  // Calculation State
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  
  // Custom Rates Input (for manual override or config)
  const [customRates, setCustomRates] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
  try {
    const [therapistRes, ratesRes] = await Promise.all([
      getAllPhysiotherapists(),
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
      const startDateStr = dateRange.start;
const endDateStr = dateRange.end;

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
      const therapistRecaps = (recapsRes.data || []).filter(
  r => r.therapist_id === selectedTherapistId
);
      
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

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const years = [2024, 2025, 2026, 2027];
const handlePeriodeIni = () => {
  const today = new Date();

  // tanggal 27 bulan ini
  const end = new Date(today.getFullYear(), today.getMonth(), 27);

  // tanggal 28 bulan sebelumnya
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 28);

  setDateRange({
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd')
  });
};
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" /> Salary Calculator
          </h2>
          <p className="text-slate-500">Estimasi gaji terapis berdasarkan performa dan kehadiran.</p>
        </div>
        <div className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
           Estimasi Gaji — Frontend Only
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Pilih Terapis</Label>
              <Select value={selectedTherapistId} onValueChange={setSelectedTherapistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Terapis..." />
                </SelectTrigger>
                <SelectContent>
                  {therapists.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
  <Label>Tanggal Mulai</Label>
  <Input
    type="date"
    value={dateRange.start}
    onChange={(e) =>
      setDateRange((prev) => ({
        ...prev,
        start: e.target.value,
      }))
    }
  />
</div>

<div className="space-y-2">
  <Label>Tanggal Selesai</Label>
  <Input
    type="date"
    value={dateRange.end}
    onChange={(e) =>
      setDateRange((prev) => ({
        ...prev,
        end: e.target.value,
      }))
    }
  />
</div>
<Button 
   onClick={handlePeriodeIni}
   className={`w-full ${
     dateRange.start.endsWith('-28') && dateRange.end.endsWith('-27')
       ? 'bg-blue-600 text-white hover:bg-blue-700'
       : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
   }`}
>
   Periode Ini
</Button>
            <Button 
               onClick={handleCalculate} 
               disabled={calculating || !selectedTherapistId}
               className="bg-blue-600 hover:bg-blue-700 w-full"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
              Hitung Gaji
            </Button>
          </div>
          
          {/* Custom Rates Config (Visible only if Custom Salary might be used or always visible for override) */}
          <div className="mt-4 pt-4 border-t border-slate-100">
             <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => document.getElementById('rates-config').classList.toggle('hidden')}>
                <TrendingUp className="w-3 h-3" /> Konfigurasi Tarif Jasa (Klik untuk buka/tutup)
             </div>
             <div id="rates-config" className="hidden grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg">
                {Object.keys(customRates).map((type) => (
                   <div key={type} className="space-y-1">
                      <Label className="text-xs">{type}</Label>
                      <div className="relative">
                         <span className="absolute left-2 top-1.5 text-xs text-slate-400">Rp</span>
                         <Input 
                            className="h-8 pl-6 text-xs" 
                            type="number" 
                            value={customRates[type]} 
                            onChange={(e) => handleRateChange(type, e.target.value)} 
                         />
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-6"
        >
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ResultCard 
                 title="Total Gaji (Estimasi)" 
                 value={formatCurrency(result.total)} 
                 icon={Wallet}
                 color="text-emerald-600"
                 bgColor="bg-emerald-50"
                 borderColor="border-emerald-200"
              />
              <ResultCard 
                 title="Gaji Pokok" 
                 value={formatCurrency(result.baseSalary)} 
                 icon={Briefcase}
                 subtext="Fixed Monthly"
              />
              <ResultCard 
                 title="Uang Transport" 
                 value={formatCurrency(result.transportAllowance)} 
                 icon={User}
                 subtext={`${result.attendanceDays} hari kerja`}
              />
              <ResultCard 
                 title="Komisi / Jasa" 
                 value={formatCurrency(result.commission)} 
                 icon={TrendingUp}
                 subtext={`${result.sessionCount} sesi total`}
              />
              <ResultCard 
                 title="Tipe Gaji" 
                 value={result.salaryType} 
                 icon={ShieldCheck}
                 subtext="Berdasarkan setting terapis"
              />
           </div>

           {/* Breakdown Table */}
           <Card>
              <CardHeader className="pb-2">
                 <CardTitle className="text-lg">Rincian Perhitungan</CardTitle>
                 <CardDescription>Detail sesi dan komponen gaji untuk periode {result.period}</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="rounded-md border">
                    <table className="w-full text-sm">
                       <thead className="bg-slate-50 text-slate-500">
                          <tr>
                             <th className="px-4 py-3 text-left font-medium">Komponen</th>
                             <th className="px-4 py-3 text-right font-medium">Jumlah / Unit</th>
                             <th className="px-4 py-3 text-right font-medium">Total (IDR)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y">
                          <tr>
                             <td className="px-4 py-3">Gaji Pokok</td>
                             <td className="px-4 py-3 text-right">1 Bulan</td>
                             <td className="px-4 py-3 text-right">{formatCurrency(result.baseSalary)}</td>
                          </tr>
                          <tr>
                             <td className="px-4 py-3">Transport</td>
                             <td className="px-4 py-3 text-right">{result.attendanceDays} Hari</td>
                             <td className="px-4 py-3 text-right">{formatCurrency(result.transportAllowance)}</td>
                          </tr>
                          {result.salaryType.includes('Custom') ? (
                             Object.entries(result.breakdown || {}).map(([type, count]) => (
                                <tr key={type} className="bg-blue-50/30">
                                   <td className="px-4 py-3 pl-8 text-slate-600">• Jasa {type}</td>
                                   <td className="px-4 py-3 text-right">{count} Sesi</td>
                                   <td className="px-4 py-3 text-right">
                                      {formatCurrency(count * (customRates[type] || 0))}
                                   </td>
                                </tr>
                             ))
                          ) : (
                             <tr>
                                <td className="px-4 py-3">Full Salary (Omzet)</td>
                                <td className="px-4 py-3 text-right">{result.sessionCount} Sesi</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(result.commission)}</td>
                             </tr>
                          )}
                          <tr className="bg-slate-50 font-bold">
                             <td className="px-4 py-3">Total Estimasi</td>
                             <td className="px-4 py-3 text-right">-</td>
                             <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(result.total)}</td>
                          </tr>
                       </tbody>
                    </table>
                 </div>
              </CardContent>
           </Card>
        </motion.div>
      )}
    </div>
  );
};

const ResultCard = ({ title, value, icon: Icon, subtext, color = "text-slate-900", bgColor = "bg-white", borderColor = "border-slate-200" }) => (
  <Card className={cn("shadow-sm", bgColor, borderColor)}>
    <CardContent className="p-6 flex items-center justify-between">
       <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className={cn("text-2xl font-bold", color)}>{value}</h3>
          {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
       </div>
       <div className={cn("p-3 rounded-full bg-white/50 border shadow-sm", borderColor)}>
          <Icon className={cn("w-6 h-6", color)} />
       </div>
    </CardContent>
  </Card>
);

export default SalaryCalculator;