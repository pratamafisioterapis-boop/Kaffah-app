import React, { useState, useEffect } from 'react';
import { getMedicalRecords } from '@/lib/api';
import { getTherapistVisits } from '@/lib/therapistDataUtils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, Loader2, AlertCircle, CheckCircle2, ArrowRight, ClipboardList, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import PatientSOAPStatusModal from './PatientSOAPStatusModal';
import { format, subMonths } from 'date-fns';
import { downloadCSV, isValidUUID, cn, getTherapistPeriodRange, formatTherapistPeriodLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { validatePatientId } from '@/lib/validationHelpers';

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const TherapistMedicalRecords = ({ therapist, isOwnerView = false, basePath = '/therapist/records' }) => {
  const { clinicName } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patientVisits, setPatientVisits] = useState({});
  const [patientRecords, setPatientRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const statusFilter = searchParams.get('status') || 'unfilled';
  const [searchTerm, setSearchTerm] = useState('');
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 20;
  // Sort State
  const [sortConfig, setSortConfig] = useState({ sortBy: 'date', sortOrder: 'asc' });

  // Period Navigation State (0 = periode berjalan, 1 = satu periode lalu, dst.)
  const [periodOffset, setPeriodOffset] = useState(0);
  const [periodRange, setPeriodRange] = useState(null);
  const [selectedDate, setSelectedDate] = useState(''); // yyyy-MM-dd, kosong = pakai periodOffset

  // Mode pencarian: jika ada kata kunci nama, cari pasien di SEMUA periode (bukan hanya periode aktif)
  const isSearchMode = searchTerm.trim().length >= 2;

  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


useEffect(() => {
  setCurrentPage(1);
}, [searchTerm, statusFilter, periodOffset, selectedDate]);
  useEffect(() => {
    if (therapist?.id) { fetchData(); }
    else {
        setPatients([]);
        setLoading(false);
    }
    
    const handleUpdate = () => { if (therapist?.id) fetchData(true); };
    window.addEventListener('medical-record-updated', handleUpdate);
    return () => window.removeEventListener('medical-record-updated', handleUpdate);
  }, [therapist?.id, periodOffset, selectedDate, isSearchMode]);

  

  const fetchData = async (isSilent = false) => {
    if (!therapist?.id) {
        console.warn("fetchData: Missing therapist ID");
        setPatients([]);
        return;
    }

    if (!isSilent) setLoading(true);
    
    try {

      let startDate = null;
      let endDate = null;

      if (isSearchMode) {
        // Mode pencarian nama: ambil kunjungan di semua periode, filter nama dilakukan di client-side.
        setPeriodRange(null);
      } else {
        const referenceDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : subMonths(new Date(), periodOffset);
        ({ startDate, endDate } = getTherapistPeriodRange(therapist, referenceDate));
        setPeriodRange({ startDate, endDate });
      }

      const { data: visits, error: visitsError } = await getTherapistVisits(
        therapist.id,
        startDate ? formatLocalDate(startDate) : null,
        endDate ? formatLocalDate(endDate) : null
      );
      
      if (visitsError) throw visitsError;
      
      const uniquePatientsMap = new Map();
      const visitsByPatient = {};
      
      visits.forEach(visit => {
        if (visit.patient && visit.patient.id) {
          if (!uniquePatientsMap.has(visit.patient.id)) { uniquePatientsMap.set(visit.patient.id, visit.patient); }
          if (!visitsByPatient[visit.patient.id]) { visitsByPatient[visit.patient.id] = []; }
          visitsByPatient[visit.patient.id].push(visit);
        }
      });
      
      const patientList = Array.from(uniquePatientsMap.values());
      
      if (patientList.length === 0) { 
          setPatients([]); 
          setLoading(false); 
          return; 
      }
      
      const { data: allRecords } = await getMedicalRecords({
  patientIds: patientList.map(p => p.id),
  limit: 9999
});

const recordsMap = {};

(allRecords || []).forEach(record => {
    if (!record.patient_id) return;

    if (!recordsMap[record.patient_id]) {
        recordsMap[record.patient_id] = [];
    }

    recordsMap[record.patient_id].push(record);
});
setPatientVisits(visitsByPatient);
setPatientRecords(recordsMap);
setPatients(patientList);

} catch (err) { 
    console.error("Error fetching data:", err);
    setPatients([]);
    toast({
      variant: "destructive",
      title: "Gagal Memuat Data",
      description: "Terjadi kesalahan saat memuat daftar pasien."
    });

} finally { 
    setLoading(false);
}
};
  const getPatientStatus = (patientId) => {

  const visits = patientVisits[patientId] || [];
  const records = patientRecords[patientId] || [];

  if (visits.length === 0) {
    return {
      status: 'empty',
      missingCount: 0
    };
  }

  // 🔥 ambil semua daily_recap_id yg sudah punya SOAP
  const filledRecapIds = new Set(
    records
      .map(r => r.daily_recap_id)
      .filter(Boolean)
  );

  let filledCount = 0;
  let missingCount = 0;

  visits.forEach(visit => {

    const hasRecord = filledRecapIds.has(visit.id);

    if (hasRecord) {
      filledCount++;
    } else {
      missingCount++;
    }

  });

  // 🔥 semua kosong
  if (filledCount === 0) {
    return {
      status: 'empty',
      missingCount: visits.length
    };
  }

  // 🔥 sebagian belum
  if (missingCount > 0) {
    return {
      status: 'incomplete',
      missingCount
    };
  }

  // 🔥 semua lengkap
  return {
    status: 'complete',
    missingCount: 0
  };
};
      

  const handlePatientClick = (patient) => { setSelectedPatient(patient); setIsModalOpen(true); };
  const handleFilterChange = (val) => { setSearchParams(prev => { const newParams = new URLSearchParams(prev); newParams.set('status', val); return newParams; }); };
  const handleExportCSV = () => {
     const exportRows = [];
     patients.forEach(p => {
        const records = patientRecords[p.id] || [];
        records.forEach(r => { exportRows.push({ patient_name: p.full_name, date: format(new Date(r.created_at), 'yyyy-MM-dd'), therapist_name: therapist.name, evaluation: r.assessment || '', notes: r.plan || '' }); });
     });
     if (exportRows.length === 0) { toast({ title: "No records to export" }); return; }
     downloadCSV(exportRows, `evaluasi_pasien_${therapist.name}_${format(new Date(), 'yyyyMMdd')}.csv`);
  };

  const handleSort = (field) => {
    setSortConfig(prev => {
      if (prev.sortBy === field) {
        return { ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: field, sortOrder: 'asc' };
    });
  };

  const processedList = patients.map(p => { const { status, missingCount } = getPatientStatus(p.id); return { ...p, missingCount, status }; });
  
  const filteredList = processedList.filter(item => { 
      if (!item) return false; 
      const searchLower = searchTerm.toLowerCase(); 
      const matchesSearch = (item.full_name || '').toLowerCase().includes(searchLower) || (item.medical_record_number || '').toLowerCase().includes(searchLower); 
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'unfilled'
          ? (item.status === 'empty' || item.status === 'incomplete')
          : item.status === statusFilter;
      return matchesSearch && matchesStatus; 
  });
  
  const sortedList = filteredList.sort((a, b) => {
      let comparison = 0;
      
      if (sortConfig.sortBy === 'full_name') {
          comparison = (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortConfig.sortBy === 'status') {
          const getScore = (status) => status === 'empty' ? 3 : status === 'incomplete' ? 2 : 1;
          const scoreA = getScore(a.status);
          const scoreB = getScore(b.status);
          comparison = scoreA - scoreB;
      }
      else if (sortConfig.sortBy === 'date') {
           const getLastVisit = (pid) => {
               const visits = patientVisits[pid] || [];
               if (visits.length === 0) return '';
               return visits.reduce((latest, current) => current.recap_date > latest ? current.recap_date : latest, '');
           };
           const dateA = getLastVisit(a.id);
           const dateB = getLastVisit(b.id);
           if (!dateA && dateB) return 1;
           if (dateA && !dateB) return -1;
           comparison = dateA.localeCompare(dateB);
      }

      return sortConfig.sortOrder === 'asc' ? comparison : -comparison;
  });
const totalPages = Math.ceil(sortedList.length / itemsPerPage);

const paginatedList = sortedList.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
  const renderSortIcon = (field) => {
    if (sortConfig.sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-app-accent ml-1" /> 
      : <ArrowDown className="w-3 h-3 text-app-accent ml-1" />;
  };

  return (
    <div className={isOwnerView ? "space-y-3" : "space-y-6"}>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size={isOwnerView ? 'sm' : 'default'} onClick={handleExportCSV} className="border-green-200 text-green-700 hover:bg-green-50"><Download className="w-4 h-4 mr-2" /> Export</Button>
            {!isOwnerView && (<Button onClick={() => navigate(`${basePath}/new/select`)} className="bg-app-accent hover:bg-app-accent-hover"><Plus className="w-4 h-4 mr-2" /> Catatan Baru</Button>)}
        </div>
      </div>

      <div className={cn("flex flex-col md:flex-row md:items-center gap-2 bg-white rounded-app border border-slate-200 shadow-sm text-xs text-slate-500", isOwnerView ? "p-2" : "p-3")}>
        <span className={isOwnerView ? "hidden sm:inline" : undefined}>
          {isSearchMode
            ? 'Mode pencarian: menampilkan hasil dari semua periode.'
            : `Menampilkan kunjungan ${periodRange ? `${format(periodRange.startDate, 'dd MMM yyyy')} - ${format(periodRange.endDate, 'dd MMM yyyy')}` : '...'}.`}
        </span>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500 md:ml-auto" />}
        <div className={cn("flex items-center gap-1 shrink-0 flex-wrap", !loading && "md:ml-auto")}>
          <Input
            type="date"
            className="h-7 w-[140px] text-xs"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPeriodOffset(0); }}
            disabled={loading || isSearchMode}
            title="Lihat periode yang berisi tanggal ini"
          />
          {selectedDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedDate('')}
              disabled={loading}
            >
              Reset Tanggal
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setSelectedDate(''); setPeriodOffset(p => p + 1); }}
            disabled={loading || isSearchMode}
            title="Periode sebelumnya"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="min-w-[110px] text-center font-semibold text-slate-600">
            {selectedDate ? 'Periode Kustom' : periodOffset === 0 ? 'Periode Berjalan' : `${periodOffset} Periode Lalu`}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setSelectedDate(''); setPeriodOffset(p => Math.max(0, p - 1)); }}
            disabled={loading || isSearchMode || (periodOffset === 0 && !selectedDate)}
            title="Periode berikutnya"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className={cn("bg-white rounded-app-sm border shadow-sm flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-end", isOwnerView ? "p-2" : "p-4")}>
         <div className="w-full sm:w-48 space-y-1"><label className="text-xs font-semibold text-slate-500">Status Kelengkapan</label><Select value={statusFilter} onValueChange={handleFilterChange}><SelectTrigger><SelectValue placeholder="Filter Status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Pasien</SelectItem><SelectItem value="unfilled">Belum Diisi + Belum Lengkap</SelectItem><SelectItem value="empty">Belum Diisi</SelectItem><SelectItem value="incomplete">Belum Lengkap</SelectItem><SelectItem value="complete">Sudah Lengkap</SelectItem></SelectContent></Select></div>
         <div className="flex-1 w-full space-y-1"><label className="text-xs font-semibold text-slate-500">Cari Pasien</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" /><Input placeholder="Ketik nama pasien untuk cari di semua periode..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
      </div>

      {/* ── Tampilan Mobile (narrow) ── */}
      <div className="sm:hidden space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin w-6 h-6 text-app-accent" />
            </div>
          ) : paginatedList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {patients.length === 0 ? "Belum ada riwayat kunjungan." : "Tidak ada pasien yang cocok."}
            </div>
          ) : paginatedList.map((item) => {
            const visits = patientVisits[item.id] || [];
            const latestVisit = visits.length > 0
              ? visits.reduce((latest, current) => current.recap_date > latest ? current.recap_date : latest, '')
              : null;

            return (
              <div
                key={item.id}
                onClick={() => handlePatientClick(item)}
                className={cn(
                  "bg-white rounded-app-lg border p-4 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,transform,opacity] shadow-sm",
                  item.status === 'empty' ? "border-rose-200 bg-rose-50/40" :
                  item.status === 'incomplete' ? "border-amber-200 bg-amber-50/40" :
                  "border-slate-100"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.full_name || 'Tanpa Nama'}</p>
                    {item.status === 'empty' && (
                      <span className="shrink-0 text-xs font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                        {item.missingCount} belum diisi
                      </span>
                    )}
                    {item.status === 'incomplete' && (
                      <span className="shrink-0 text-xs font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                        {item.missingCount} belum lengkap
                      </span>
                    )}
                    {item.status === 'complete' && (
                      <span className="shrink-0 text-xs font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                        Lengkap ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{item.medical_record_number || '-'}</p>
                  {latestVisit && (
                    <p className="text-xs text-slate-500 mt-1">
                      Kunjungan terakhir: <span className="font-medium">{format(new Date(latestVisit), 'dd MMM yyyy')}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-center gap-1">
                  {item.status === 'empty' ? (
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                  ) : item.status === 'incomplete' ? (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>

      {/* ── Tampilan Desktop (Table) ── */}
      <Card className="hidden sm:block border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[300px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('full_name')}>
                    <div className="flex items-center gap-1">Nama Pasien {renderSortIcon('full_name')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">Tanggal Kunjungan Terakhir {renderSortIcon('date')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status SOAP {renderSortIcon('status')}</div>
                  </TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin w-6 h-6 mx-auto text-app-accent" /></TableCell></TableRow>
                ) : sortedList.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">{patients.length === 0 ? "Belum ada riwayat kunjungan (Daily Recaps)." : "Tidak ada pasien yang cocok."}</TableCell></TableRow>
                ) : paginatedList.map((item) => {
                  const visits = patientVisits[item.id] || [];
                  const latestVisit = visits.length > 0 ? visits.reduce((latest, current) => current.recap_date > latest ? current.recap_date : latest, '') : '-';
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => handlePatientClick(item)}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{item.full_name || "Tanpa Nama"}</span>
                          <span className="text-xs text-slate-500">{item.medical_record_number || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-slate-600 font-medium text-sm">{latestVisit !== '-' ? format(new Date(latestVisit), 'dd MMM yyyy') : '-'}</span></TableCell>
                      <TableCell>
                        {item.status === 'complete' && (<div className="flex items-center gap-2"><Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium shadow-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Lengkap</Badge><span className="text-xs text-slate-500">Semua kunjungan tercatat</span></div>)}
                        {item.status === 'incomplete' && (<div className="flex items-center gap-2"><Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium shadow-none"><AlertCircle className="w-3 h-3 mr-1" /> Belum Lengkap</Badge><span className="text-xs font-medium text-amber-600">{item.missingCount} kunjungan belum di-SOAP</span></div>)}
                        {item.status === 'empty' && (<div className="flex items-center gap-2"><Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-medium shadow-none"><ClipboardList className="w-3 h-3 mr-1" /> Kosong</Badge><span className="text-xs font-medium text-red-600">Belum ada SOAP sama sekali</span></div>)}
                      </TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-app-accent hover:text-app-accent-hover hover:bg-app-soft">Detail <ArrowRight className="w-4 h-4 ml-1" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-2">
    
    <Button
      variant="outline"
      size="sm"
      disabled={currentPage === 1}
      onClick={() => setCurrentPage(prev => prev - 1)}
    >
      Previous
    </Button>

    <div className="text-sm text-slate-600 px-2">
      Halaman {currentPage} / {totalPages}
    </div>

    <Button
      variant="outline"
      size="sm"
      disabled={currentPage === totalPages}
      onClick={() => setCurrentPage(prev => prev + 1)}
    >
      Next
    </Button>

  </div>
)}
      <PatientSOAPStatusModal patient={selectedPatient} visits={selectedPatient ? (patientVisits[selectedPatient.id] || []) : []} records={selectedPatient ? (patientRecords[selectedPatient.id] || []) : []} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} basePath={basePath} />
    </div>
  );
};

export default TherapistMedicalRecords;