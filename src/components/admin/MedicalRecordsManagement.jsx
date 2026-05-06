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
  createBulkMedicalRecordsDetailed
} from '@/lib/api';
import { cn, downloadCSV, parseCSVText } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";
import MedicalRecordsModal from './MedicalRecordsModal'; // Import the new modal component
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
  const [records, setRecords] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
const [isViewOpen, setIsViewOpen] = useState(false);

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
      const [patientsRes, recordsRes] = await Promise.all([
        getPatients(),
        getMedicalRecordsWithPatients()
      ]);

      setPatients(patientsRes.data || []);
      setRecords(recordsRes.data || []);
      
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
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleSaveSuccess = () => {
    fetchInitialData(); // Refresh data after save
  };
const handleViewRecord = (record) => {
  setViewRecord(record);
  setIsViewOpen(true);
};
  const handleDelete = (id) => {
    toast({ description: "Fitur Hapus akan segera tersedia!" });
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
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
         <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
         </div>
         <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Medical Records</h1>
          <p className="text-slate-600 mt-1">Kelola data rekam medis pasien secara terpusat.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari nama atau RM..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white w-full"
            />
          </div>
          <Button onClick={handleOpenCreateModal} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
             <Plus className="w-4 h-4 mr-2" />
             Tambah Rekam Medis
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
             <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50">
               <Upload className="w-4 h-4 mr-2" />
               Import
             </Button>
             <Button variant="outline" onClick={handleExportCSV} className="flex-1 sm:flex-none border-green-200 text-green-700 hover:bg-green-50">
               <Download className="w-4 h-4 mr-2" />
               Export
             </Button>
          </div>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-medium text-xs">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('rm_number')}>
                    <div className="flex items-center gap-1">NO RM {renderSortIcon('rm_number')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('full_name')}>
                    <div className="flex items-center gap-1">NAMA PASIEN {renderSortIcon('full_name')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('record_date')}>
                    <div className="flex items-center gap-1">TANGGAL {renderSortIcon('record_date')}</div>
                </th>
                 <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                     <div className="flex items-center gap-1">STATUS DATA {renderSortIcon('status')}</div>
                </th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                       <FileText className="w-8 h-8 text-slate-300" />
                       <p>Belum ada data rekam medis.</p>
                       <Button variant="link" onClick={handleOpenCreateModal}>Buat baru sekarang</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record) => {
                   const statusLabel = getStatusLabel(record);
                   return (
                    <tr 
  key={record.id}
  className="hover:bg-blue-50 transition-colors cursor-pointer"
  onClick={() => handleViewRecord(record)}
>
                      <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                        {record.patient?.medical_record_number || '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {record.patient?.full_name || 'Unknown Patient'}
                      </td>
                       <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {format(new Date(record.record_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            getStatusColor(statusLabel)
                         )}>
                            {statusLabel}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
  <div onClick={(e) => e.stopPropagation()}>
    <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditModal(record)}>
                              <Pencil className="mr-2 h-4 w-4 text-slate-500" /> Edit Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(record.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                              <Trash2 className="mr-2 h-4 w-4" /> Hapus Data
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
</div>
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
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveSuccess}
        recordData={selectedRecord}
      />
<MedicalRecordsModal
  isOpen={isViewOpen}
  onClose={() => {
    setIsViewOpen(false);
    setViewRecord(null);
  }}
  onSave={() => {}}
  recordData={viewRecord}
/>
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