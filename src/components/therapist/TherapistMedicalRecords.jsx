import React, { useState, useEffect, useRef } from 'react';
import { getMedicalRecords, getPatients, createBulkMedicalRecords } from '@/lib/api';
import { getTherapistVisits } from '@/lib/therapistDataUtils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Plus, Loader2, AlertCircle, CheckCircle2, ArrowRight, ClipboardList, Upload, Download, FileDown, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PatientSOAPStatusModal from './PatientSOAPStatusModal';
import { format } from 'date-fns';
import { downloadCSV, parseCSVText, findPatientMatch, isValidUUID } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { validatePatientId } from '@/lib/validationHelpers';

const TherapistMedicalRecords = ({ therapist, isOwnerView = false }) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patientVisits, setPatientVisits] = useState({});
  const [patientRecords, setPatientRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const statusFilter = searchParams.get('status') || 'all';
  const [searchTerm, setSearchTerm] = useState('');

  // Sort State
  const [sortConfig, setSortConfig] = useState(() => {
    const key = isOwnerView ? "medicalRecordsSortOwner" : "medicalRecordsSortTherapist";
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { sortBy: 'full_name', sortOrder: 'asc' };
  });

  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Import CSV States
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (therapist?.id) { fetchData(); }
    else {
        setPatients([]);
        setLoading(false);
    }
    
    const handleUpdate = () => { if (therapist?.id) fetchData(true); };
    window.addEventListener('medical-record-updated', handleUpdate);
    return () => window.removeEventListener('medical-record-updated', handleUpdate);
  }, [therapist?.id]); 

  useEffect(() => {
      const key = isOwnerView ? "medicalRecordsSortOwner" : "medicalRecordsSortTherapist";
      localStorage.setItem(key, JSON.stringify(sortConfig));
  }, [sortConfig, isOwnerView]);

  const fetchData = async (isSilent = false) => {
    if (!therapist?.id) {
        console.warn("fetchData: Missing therapist ID");
        setPatients([]);
        return;
    }

    if (!isSilent) setLoading(true);
    
    try {
      console.log("Fetching recaps for therapist:", therapist.id);
      
      const { data: visits, error: visitsError } = await getTherapistVisits(therapist.id);
      
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
      
      const recordsMap = {};
      const results = await Promise.allSettled(patientList.map(async (p) => {
          // Check VALIDATION using helper
          const validation = validatePatientId(p.id, 'fetchDataLoop');
          if (!validation.valid) return { id: p.id, records: [] };

          const { data: records } = await getMedicalRecords(p.id); 
          return { id: p.id, records: records || [] };
      }));
      
      results.forEach((result) => { if (result.status === 'fulfilled') { recordsMap[result.value.id] = result.value.records; } });
      
      setPatientVisits(visitsByPatient);
      setPatientRecords(recordsMap);
      setPatients(patientList);
      
    } catch (err) { 
        console.error("Error fetching data:", err);
        setPatients([]); // Fallback
        toast({ variant: "destructive", title: "Gagal Memuat Data", description: "Terjadi kesalahan saat memuat daftar pasien." }); 
    } finally { 
        setLoading(false); 
    }
  };

  const getPatientStatus = (patientId) => {
      const visits = patientVisits[patientId] || [];
      const records = patientRecords[patientId] || [];
      if (visits.length === 0) return { status: 'empty', missingCount: 0 };
      let missingCount = 0; let filledCount = 0;
      visits.forEach(visit => {
         const visitDate = visit.recap_date;
         const hasRecord = records.some(r => { const recordDate = format(new Date(r.created_at), 'yyyy-MM-dd'); return recordDate === visitDate; });
         if (hasRecord) filledCount++; else missingCount++;
      });
      if (filledCount === 0) return { status: 'empty', missingCount: visits.length };
      if (missingCount > 0) return { status: 'incomplete', missingCount };
      return { status: 'complete', missingCount: 0 };
  };

  const handlePatientClick = (patient) => { setSelectedPatient(patient); setIsModalOpen(true); };
  const handleFilterChange = (val) => { setSearchParams(prev => { const newParams = new URLSearchParams(prev); newParams.set('status', val); return newParams; }); };
  const downloadTemplate = () => { const sample = [{ patient_name: 'John Doe', date: '2023-01-01', therapist_name: therapist.name, evaluation: 'Pasien mengalami nyeri punggung bawah', notes: 'Latihan stretching 15 menit' }]; downloadCSV(sample, 'template_evaluasi_pasien.csv'); };
  const handleExportCSV = () => {
     const exportRows = [];
     patients.forEach(p => {
        const records = patientRecords[p.id] || [];
        records.forEach(r => { exportRows.push({ patient_name: p.full_name, date: format(new Date(r.created_at), 'yyyy-MM-dd'), therapist_name: therapist.name, evaluation: r.assessment || '', notes: r.plan || '' }); });
     });
     if (exportRows.length === 0) { toast({ title: "No records to export" }); return; }
     downloadCSV(exportRows, `evaluasi_pasien_${therapist.name}_${format(new Date(), 'yyyyMMdd')}.csv`);
  };

  const processImport = async () => {
      if (!importFile) return;
      setImporting(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const rawData = parseCSVText(text);
          if (rawData.length === 0) throw new Error("No valid data found");
          const validRecords = [];
          const errors = [];
          const { data: allPatients } = await getPatients();

          rawData.forEach((row, idx) => {
             const pName = row.patient_name || row['nama pasien'];
             const date = row.date || row['tanggal'];

             if (!pName || !date) { errors.push(`Row ${idx + 1}: Missing name or date`); return; }
             
             const matchResult = findPatientMatch(pName, allPatients);
             if (matchResult.status !== 'exact') {
                 errors.push(`Row ${idx + 1}: Patient '${pName}' not found or name ambiguous. Requires exact match.`);
                 return;
             }

             validRecords.push({
                 patient_id: matchResult.patient.id,
                 created_by: user.id, 
                 record_type: 'soap', 
                 assessment: row.evaluation || row['evaluation'] || '',
                 plan: row.notes || row['notes'] || '',
                 subjective: '', objective: '',
                 created_at: new Date(date).toISOString() 
             });
          });

          if (validRecords.length > 0) {
              const { error } = await createBulkMedicalRecords(validRecords);
              if (error) throw error;
          }

          setImportStats({ total: rawData.length, success: validRecords.length, failed: errors.length, errors: errors });
          if (validRecords.length > 0) fetchData(true);
        } catch (err) { console.error(err); toast({ variant: "destructive", title: "Import Failed", description: err.message }); } finally { setImporting(false); setImportFile(null); }
      };
      reader.readAsText(importFile);
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
      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter; 
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
           comparison = dateA.localeCompare(dateB);
      }

      return sortConfig.sortOrder === 'asc' ? comparison : -comparison;
  });

  const renderSortIcon = (field) => {
    if (sortConfig.sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 ml-1" /> 
      : <ArrowDown className="w-3 h-3 text-blue-600 ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900">{isOwnerView ? 'Evaluasi Pasien' : 'Manajemen Rekam Medis'}</h2><p className="text-slate-500">Monitoring kelengkapan SOAP berdasarkan kunjungan pasien.</p></div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="border-blue-200 text-blue-700 hover:bg-blue-50"><Upload className="w-4 h-4 mr-2" /> Import</Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-green-200 text-green-700 hover:bg-green-50"><Download className="w-4 h-4 mr-2" /> Export</Button>
            {!isOwnerView && (<Button onClick={() => navigate('/therapist/records/new/select')} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Catatan Baru</Button>)}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 items-end">
         <div className="w-full md:w-48 space-y-1"><label className="text-xs font-semibold text-slate-500">Status Kelengkapan</label><Select value={statusFilter} onValueChange={handleFilterChange}><SelectTrigger><SelectValue placeholder="Filter Status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Pasien</SelectItem><SelectItem value="empty">Belum Diisi</SelectItem><SelectItem value="incomplete">Belum Lengkap</SelectItem><SelectItem value="complete">Sudah Lengkap</SelectItem></SelectContent></Select></div>
         <div className="flex-1 w-full space-y-1"><label className="text-xs font-semibold text-slate-500">Cari Pasien</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><Input placeholder="Nama pasien atau No. RM..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
      </div>

      <Card className="border shadow-sm overflow-hidden">
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
                {loading ? ( <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-600" /></TableCell></TableRow> ) : sortedList.length === 0 ? ( <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">{patients.length === 0 ? "Belum ada riwayat kunjungan (Daily Recaps)." : "Tidak ada pasien yang cocok."}</TableCell></TableRow> ) : (
                sortedList.map((item) => {
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
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">Detail <ArrowRight className="w-4 h-4 ml-1" /></Button></TableCell>
                    </TableRow>
                )})
                )}
            </TableBody>
            </Table>
        </div>
      </Card>

      <PatientSOAPStatusModal patient={selectedPatient} visits={selectedPatient ? (patientVisits[selectedPatient.id] || []) : []} records={selectedPatient ? (patientRecords[selectedPatient.id] || []) : []} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Import Evaluasi Pasien (CSV)</DialogTitle><DialogDescription>Upload file CSV untuk import data evaluasi massal.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between"><div className="text-sm text-slate-600"><p className="font-medium">Belum punya format?</p><p className="text-xs">Download template CSV</p></div><Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 h-8"><FileDown className="w-4 h-4" /> Download</Button></div>
             {!importStats ? (
               <div className="grid w-full items-center gap-1.5"><div className="flex items-center justify-center w-full"><label htmlFor="eval-dropzone" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100"><div className="flex flex-col items-center justify-center pt-5 pb-6"><Upload className="w-8 h-8 mb-2 text-slate-400" /><p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Klik upload</span> atau drag and drop</p><p className="text-xs text-slate-500">Hanya file CSV</p></div><input id="eval-dropzone" type="file" className="hidden" accept=".csv" onChange={(e) => { if(e.target.files && e.target.files[0]) { setImportFile(e.target.files[0]); setImportStats(null); } }} ref={fileInputRef} /></label></div>{importFile && (<div className="text-sm text-blue-600 font-medium flex items-center gap-2 mt-2"><FileDown className="w-4 h-4" />{importFile.name}</div>)}</div>
             ) : (
                <div className="space-y-3"><div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-md border border-emerald-100"><CheckCircle className="w-5 h-5" /><div className="text-sm"><span className="font-bold">{importStats.success}</span> data berhasil diimport.</div></div>{importStats.failed > 0 && (<div className="bg-rose-50 p-3 rounded-md border border-rose-100"><div className="flex items-center gap-2 text-rose-600 mb-2"><AlertCircle className="w-5 h-5" /><div className="text-sm font-bold">{importStats.failed} data gagal</div></div><ul className="text-xs text-rose-600 list-disc pl-5 max-h-32 overflow-y-auto space-y-1">{importStats.errors.map((err, idx) => (<li key={idx}>{err}</li>))}</ul></div>)}</div>
             )}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportStats(null); setImportFile(null); }}>{importStats ? 'Tutup' : 'Batal'}</Button>{!importStats && (<Button onClick={processImport} disabled={!importFile || importing} className="bg-blue-600 hover:bg-blue-700">{importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Import Data</Button>)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistMedicalRecords;