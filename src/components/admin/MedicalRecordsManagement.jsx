import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, FileText, Search, Upload, FileDown, CheckCircle, 
  AlertCircle, Download, ArrowUpDown, ArrowUp, ArrowDown, 
  RefreshCw, MoreHorizontal, Pencil, Trash2, Loader2, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  getPatients, 
  getMedicalRecordsWithPatients,
  createBulkMedicalRecordsDetailed,
  getDiagnosisOptions
} from '@/lib/api';
import { cn, downloadCSV, parseCSVText } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";
import MedicalRecordsModal from './MedicalRecordsModal';
import MedicalRecordViewSheet from './MedicalRecordViewSheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

const MedicalRecordsManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State variables initialization
  const [patients, setPatients] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [records, setRecords] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
const [isViewOpen, setIsViewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // Sort State
  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("medicalRecordsSortAdmin");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse sortConfig from localStorage", e);
    }
    return { sortBy: 'record_date', sortOrder: 'desc' };
  });

  // Import CSV States
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    localStorage.setItem("medicalRecordsSortAdmin", JSON.stringify(sortConfig));
  }, [sortConfig]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [patientsRes, recordsRes, diagnosesRes] = await Promise.all([
        getPatients(),
        getMedicalRecordsWithPatients(),
        getDiagnosisOptions()
      ]);

      setPatients(patientsRes.data || []);
      setRecords(recordsRes.data || []);
      setDiagnoses((diagnosesRes.data || []).map(d => ({ value: d.id, label: d.label })));
      
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Gagal memuat data rekam medis. Silakan coba lagi.");
      toast({
        variant: "destructive",
        title: "Gagal memuat data",
        description: err.message || "Terjadi kesalahan saat mengambil data awal."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedRecord(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record) => {

  // 🔥 ambil data terbaru dari records state
  const freshRecord = records.find(r => r.id === record.id);

  setSelectedRecord(
    freshRecord
      ? JSON.parse(JSON.stringify(freshRecord))
      : JSON.parse(JSON.stringify(record))
  );

  setIsModalOpen(true);
};

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleSaveSuccess = async (updatedRecord = null) => {

  if (updatedRecord?.id) {
    // Cek apakah record ini sudah ada di list (edit) atau baru (create)
    const isExisting = records.some(item => item.id === updatedRecord.id);

    if (isExisting) {
      // Edit: merge data yang ada
      setRecords(prev =>
        prev.map(item => {
          if (item.id !== updatedRecord.id) return item;
          return { ...item, ...updatedRecord };
        })
      );
      setSelectedRecord(null);
      setViewRecord(null);
    } else {
      // Create baru: fetch ulang agar dapat relasi patient
      await fetchInitialData();
    }

  } else {
    await fetchInitialData();
  }
};
const handleViewRecord = (record) => {

  const freshRecord = records.find(r => r.id === record.id);

  setViewRecord(
    freshRecord
      ? JSON.parse(JSON.stringify(freshRecord))
      : JSON.parse(JSON.stringify(record))
  );

  setIsViewOpen(true);
};
  const handleDelete = (id) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { deleteMedicalRecord } = await import('@/lib/api');
      const { error } = await deleteMedicalRecord(deleteTargetId);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Rekam medis berhasil dihapus." });
      fetchInitialData();
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal menghapus", description: err.message || "Terjadi kesalahan." });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  };
  
  const handleSort = (field) => {
    setSortConfig(prev => {
      if (prev.sortBy === field) {
        return { ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: field, sortOrder: 'asc' };
    });
  };

  // --- CSV Import/Export ---
  const downloadTemplate = () => {
    const headers = ['patient_name', 'date', 'therapist_name', 'complaint', 'therapy', 'result'];
    downloadCSV([{
        patient_name: 'John Doe',
        date: '2023-01-01',
        therapist_name: 'Dr. Adi',
        complaint: 'Nyeri Punggung',
        therapy: 'TENS, Massage',
        result: 'Nyeri berkurang'
      }], 'template_import_medical_records.csv');
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
       toast({ title: "No data to export" });
       return;
    }
    const exportData = records.map(r => ({
       no_rm: r.patient?.medical_record_number || '-',
       patient_name: r.patient?.full_name || 'Unknown',
       date: r.record_date,
       therapist_name: r.therapist_name,
       complaint: r.history_main_problem,
       diagnosis: r.medical_diagnosis,
       status: r.status || r.patient?.status || 'Active'
    }));
    downloadCSV(exportData, `medical_records_export_${format(new Date(), 'yyyyMMdd')}.csv`);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
      setImportStats(null);
    }
  };

  const processImport = async () => {
    if (!importFile) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rawData = parseCSVText(text); 
        
        if (rawData.length === 0) throw new Error("No valid data found in CSV");

        const validRecords = [];
        const errors = [];

        rawData.forEach((row, index) => {
          const patientName = row.patient_name || row['nama pasien'];
          const date = row.date || row['tanggal'];
          
          if (!patientName || !date) {
             errors.push(`Row ${index + 1}: Missing Patient Name or Date`);
             return;
          }

          const patient = patients.find(p => p.label.toLowerCase().includes(patientName.toLowerCase()));
          if (!patient) {
             errors.push(`Row ${index + 1}: Patient '${patientName}' not found in DB`);
             return;
          }

          validRecords.push({
            record_date: date,
            patient_id: patient.id,
            therapist_name: row.therapist_name || row['nama terapis'] || '',
            history_main_problem: row.complaint || row['complaint'] || '',
            treatment_goal: row.therapy || row['therapy'] || '',
            specific_test: row.result || row['result'] || '',
            created_by: user?.id
          });
        });

        if (validRecords.length > 0) {
          const { error: bulkInsertError } = await createBulkMedicalRecordsDetailed(validRecords);
          if (bulkInsertError) throw bulkInsertError;
        }

        setImportStats({
          total: rawData.length,
          success: validRecords.length,
          failed: errors.length,
          errors: errors
        });

        if (validRecords.length > 0) {
           handleSaveSuccess();
        }

      } catch (err) {
        console.error("Import error:", err);
        toast({ variant: "destructive", title: "Import Failed", description: err.message });
      } finally {
        setImporting(false);
        setImportFile(null);
      }
    };

    reader.readAsText(importFile);
  };

  // Filter & Sort
  const filteredRecords = records.filter(r => 
    (r.patient?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (r.patient?.medical_record_number?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );
  
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let comparison = 0;
    
    if (sortConfig.sortBy === 'record_date') {
      comparison = new Date(a.record_date) - new Date(b.record_date);
    } else if (sortConfig.sortBy === 'full_name') {
      comparison = (a.patient?.full_name || '').localeCompare(b.patient?.full_name || '');
    } else if (sortConfig.sortBy === 'rm_number') {
      comparison = (a.patient?.medical_record_number || '').localeCompare(b.patient?.medical_record_number || '');
    } else if (sortConfig.sortBy === 'status') {
      const statusA = a.status || 'Active';
      const statusB = b.status || 'Active';
      comparison = statusA.localeCompare(statusB);
    }

    return sortConfig.sortOrder === 'asc' ? comparison : -comparison;
  });

  const renderSortIcon = (field) => {
    if (sortConfig.sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 ml-1" /> 
      : <ArrowDown className="w-3 h-3 text-blue-600 ml-1" />;
  };

  const getStatusColor = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'completed' || s === 'selesai' || s === 'terisi') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s === 'pending' || s === 'draft') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusLabel = (record) => {
    return record.status || 'Completed';
  };

  if (loading) {
    return (
      <div className="space-y-4">
         <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
         </div>
         <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl"
        style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#eef2ff' }}>
            <FileText className="w-4 h-4" style={{ color: '#4f46e5' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Medical Records</h2>
            <p className="text-xs text-slate-400">Kelola data rekam medis pasien secara terpusat</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Cari nama atau RM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 h-8 text-xs rounded-xl outline-none w-52"
              style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}
            />
          </div>
          <button onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold text-white"
            style={{ background: '#4f46e5' }}>
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
          <button onClick={() => setImportDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold"
            style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold"
            style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button variant="outline" onClick={fetchInitialData} size="sm" className="border-red-300 text-red-700 hover:bg-red-100">
            <RefreshCw className="w-4 h-4 mr-2" /> Reload
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th className="px-5 py-3 cursor-pointer whitespace-nowrap"
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  onClick={() => handleSort('rm_number')}>
                  <div className="flex items-center gap-1">No RM {renderSortIcon('rm_number')}</div>
                </th>
                <th className="px-5 py-3 cursor-pointer whitespace-nowrap"
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  onClick={() => handleSort('full_name')}>
                  <div className="flex items-center gap-1">Nama Pasien {renderSortIcon('full_name')}</div>
                </th>
                <th className="px-5 py-3 cursor-pointer whitespace-nowrap"
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  onClick={() => handleSort('record_date')}>
                  <div className="flex items-center gap-1">Tanggal {renderSortIcon('record_date')}</div>
                </th>
                <th className="px-5 py-3 cursor-pointer whitespace-nowrap"
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">Status {renderSortIcon('status')}</div>
                </th>
                <th className="px-5 py-3 whitespace-nowrap"
                  style={{ color: '#94a3b8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Fisioterapis
                </th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                        <FileText className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-400">Belum ada data rekam medis</p>
                      <button onClick={handleOpenCreateModal}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: '#eef2ff', color: '#4f46e5' }}>
                        Buat sekarang
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record, idx) => {
                  const statusLabel = getStatusLabel(record);
                  const isCompleted = statusLabel?.toLowerCase() === 'completed' || statusLabel?.toLowerCase() === 'selesai';
                  return (
                    <tr key={record.id}
                      className="group cursor-pointer transition-colors"
                      style={{ background: idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafafa'}
                      onClick={() => handleViewRecord(record)}>
                      <td className="px-5 py-3 font-mono font-semibold whitespace-nowrap" style={{ color: '#4f46e5', fontSize: '11px' }}>
                        {record.patient?.medical_record_number || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                            style={{ background: '#eef2ff', color: '#4f46e5' }}>
                            {(record.patient?.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-700">{record.patient?.full_name || 'Unknown Patient'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {format(new Date(record.record_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{
                          background: isCompleted ? '#f0fdf4' : '#fffbeb',
                          color: isCompleted ? '#059669' : '#d97706',
                          border: `1px solid ${isCompleted ? '#bbf7d0' : '#fde68a'}`
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {record.therapist_name
                          ? <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
                                style={{ background: '#f0fdf4', color: '#059669' }}>
                                {record.therapist_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-600 truncate max-w-[120px]">
                                {record.therapist_name.split(',')[0]}
                              </span>
                            </div>
                          : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>
                        }
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 transition-all w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: '#f1f5f9', color: '#64748b' }}>
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => handleOpenEditModal(record)}>
                              <Pencil className="mr-2 h-3.5 w-3.5 text-slate-500" /> Edit Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(record.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Data
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MedicalRecordsModal
  key={selectedRecord?.id || 'create'}
  isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveSuccess}
        recordData={selectedRecord}
      />
<MedicalRecordViewSheet
  isOpen={isViewOpen}
  onClose={() => {
    setIsViewOpen(false);
    setViewRecord(null);
  }}
  record={viewRecord}
  diagnoses={diagnoses}
  onEdit={(record) => {
    setIsViewOpen(false);
    setViewRecord(null);
    handleOpenEditModal(record);
  }}
/>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl border-0"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div className="p-5 pb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fff1f2' }}>
                <Trash2 className="w-5 h-5" style={{ color: '#e11d48' }} />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-800 mb-1">Hapus Rekam Medis</DialogTitle>
                <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                  Data rekam medis ini akan dihapus permanen dan tidak bisa dikembalikan. Yakin ingin melanjutkan?
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <button onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 h-9 rounded-xl text-xs font-semibold transition-all"
              style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
              Batal
            </button>
            <button onClick={confirmDelete}
              className="flex-1 h-9 rounded-xl text-xs font-bold text-white transition-all"
              style={{ background: '#e11d48' }}>
              Hapus Permanen
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Data Rekam Medis (CSV)</DialogTitle>
            <DialogDescription>
              Upload file CSV. Gunakan template untuk format yang benar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                   <p className="font-medium">Belum punya format?</p>
                   <p className="text-xs">Download template CSV</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 h-8">
                   <FileDown className="w-4 h-4" /> Download Template
                </Button>
             </div>
             {!importStats ? (
               <div className="grid w-full items-center gap-1.5">
                  <div className="flex items-center justify-center w-full">
                      <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-2 text-slate-400" />
                              <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Klik upload</span> atau drag and drop</p>
                              <p className="text-xs text-slate-500">Hanya file CSV</p>
                          </div>
                          <input 
                            id="dropzone-file" 
                            type="file" 
                            className="hidden" 
                            accept=".csv"
                            onChange={handleFileChange} 
                            ref={fileInputRef}
                          />
                      </label>
                  </div> 
                  {importFile && (
                    <div className="text-sm text-blue-600 font-medium flex items-center gap-2 mt-2">
                       <FileDown className="w-4 h-4" />
                       {importFile.name}
                    </div>
                  )}
               </div>
             ) : (
                <div className="space-y-3">
                   <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-md border border-emerald-100">
                      <CheckCircle className="w-5 h-5" />
                      <div className="text-sm">
                         <span className="font-bold">{importStats.success}</span> data berhasil diimport.
                      </div>
                   </div>
                   {importStats.failed > 0 && (
                     <div className="bg-rose-50 p-3 rounded-md border border-rose-100">
                        <div className="flex items-center gap-2 text-rose-600 mb-2">
                           <AlertCircle className="w-5 h-5" />
                           <div className="text-sm font-bold">
                              {importStats.failed} data gagal
                           </div>
                        </div>
                        <ul className="text-xs text-rose-600 list-disc pl-5 max-h-32 overflow-y-auto space-y-1">
                           {importStats.errors.map((err, idx) => (
                             <li key={idx}>{err}</li>
                           ))}
                        </ul>
                     </div>
                   )}
                </div>
             )}
          </div>
          <div className="flex justify-end gap-2">
             <Button variant="outline" onClick={() => {
                setImportDialogOpen(false);
                setImportStats(null);
                setImportFile(null);
             }}>
                {importStats ? 'Tutup' : 'Batal'}
             </Button>
             {!importStats && (
               <Button onClick={processImport} disabled={!importFile || importing} className="bg-blue-600 hover:bg-blue-700">
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Import Data
               </Button>
             )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MedicalRecordsManagement;