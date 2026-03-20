import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Calendar, ChevronRight, Search, ClipboardList, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import DailyEvaluationDetailModal from '@/components/admin/DailyEvaluationDetailModal';
import { useToast } from '@/components/ui/use-toast';
import { getPatients, createBulkMedicalRecords } from '@/lib/api';
import { exportDailyRecapsToCSV, parseDailyRecapsCSV, findPatientMatch, isValidUUID } from '@/lib/utils';
import ImportSummaryModal from '@/components/owner/ImportSummaryModal';
import { validatePatientId } from '@/lib/validationHelpers';

const DailyEvaluationReadOnly = () => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [patientGroups, setPatientGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientGroup, setSelectedPatientGroup] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [showImportSummary, setShowImportSummary] = useState(false);

  useEffect(() => { fetchSoapRecords(); }, []);

  const fetchSoapRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('medical_records').select(`*, patient:patients(id, full_name, medical_record_number), therapist:users!created_by(full_name)`).order('created_at', { ascending: false });
      if (error) throw error;
      const grouped = {};
      data.forEach(record => {
        // Robust check using validation helper
        if (!record.patient || !validatePatientId(record.patient.id, 'GroupSOAP').valid) return;
        
        const patientId = record.patient_id;
        if (!grouped[patientId]) { grouped[patientId] = { patient: record.patient, records: [], lastDate: record.created_at, count: 0 }; }
        grouped[patientId].records.push(record); grouped[patientId].count++;
        if (new Date(record.created_at) > new Date(grouped[patientId].lastDate)) { grouped[patientId].lastDate = record.created_at; }
      });
      const sortedGroups = Object.values(grouped).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      setPatientGroups(sortedGroups);
    } catch (err) { console.error('Error fetching SOAP records:', err); } finally { setLoading(false); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.from('medical_records').select(`*, patient:patients(full_name), therapist:users!created_by(full_name)`).order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) { toast({ title: "Tidak ada data", description: "Belum ada data evaluasi harian untuk diekspor." }); return; }
      exportDailyRecapsToCSV(data);
      toast({ title: "Export Berhasil", description: "File CSV evaluasi harian telah diunduh." });
    } catch (err) { console.error(err); toast({ variant: "destructive", title: "Gagal Export", description: err.message }); } finally { setIsExporting(false); }
  };

  const handleImportClick = () => { if (fileInputRef.current) { fileInputRef.current.click(); } };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsedData = await parseDailyRecapsCSV(file);
      const { data: patients, error: patientError } = await getPatients();
      if (patientError) throw patientError;

      const validRecords = [];
      const warnings = [];
      let successCount = 0;

      for (const row of parsedData) {
        const patientName = row.patientName;
        const matchResult = findPatientMatch(patientName, patients);

        if (matchResult.status !== 'exact') {
          warnings.push({ patientName: row.patientName, message: `Pasien tidak ditemukan atau nama ambigu (Butuh Exact Match). Baris ini dilewati.` });
          continue; 
        }

        // Validate matched ID
        if (!validatePatientId(matchResult.patient.id, 'ImportCSV').valid) {
             warnings.push({ patientName: row.patientName, message: `ID Pasien tidak valid. Dilewati.` });
             continue;
        }

        validRecords.push({
          patient_id: matchResult.patient.id,
          record_type: 'SOAP',
          subjective: row.subjective,
          objective: row.objective,
          assessment: row.assessment,
          plan: row.plan,
          therapist_name: row.therapistName, 
          created_at: row.date ? new Date(row.date).toISOString() : new Date().toISOString()
        });
        successCount++;
      }

      if (validRecords.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        const recordsToInsert = validRecords.map(r => ({ ...r, created_by: currentUserId }));
        const { error: insertError } = await createBulkMedicalRecords(recordsToInsert);
        if (insertError) throw insertError;
      }

      setImportSummary({ totalProcessed: parsedData.length, successCount: successCount, warningCount: warnings.length, warnings: warnings });
      setShowImportSummary(true);
      fetchSoapRecords();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) { console.error(err); toast({ variant: "destructive", title: "Gagal Import", description: err.message }); if (fileInputRef.current) fileInputRef.current.value = ''; } finally { setIsImporting(false); }
  };

  const filteredGroups = patientGroups.filter(group => group.patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || (group.patient.medical_record_number && group.patient.medical_record_number.toLowerCase().includes(searchTerm.toLowerCase())));
  const handlePatientClick = (group) => { setSelectedPatientGroup(group); setDetailModalOpen(true); };

  if (loading) { return ( <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" /><p className="text-slate-500 font-medium">Memuat data evaluasi harian...</p></div> ); }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-h-[600px]">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1"><h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-blue-600" />Daftar Evaluasi Harian (SOAP)</h2><p className="text-sm text-slate-500 mt-1">Pantau perkembangan pasien melalui catatan SOAP dari terapis.</p></div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <Button variant="outline" onClick={handleImportClick} disabled={isImporting} size="sm" className="w-full sm:w-auto"><Upload className="w-4 h-4 mr-2" />{isImporting ? 'Importing...' : 'Import CSV'}</Button>
                <Button onClick={handleExport} disabled={isExporting} size="sm" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-white"><Download className="w-4 h-4 mr-2" />{isExporting ? 'Exporting...' : 'Export CSV'}</Button>
             </div>
             <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Cari nama pasien atau No RM..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-9" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.length === 0 ? ( <div className="col-span-full text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200"><div className="mx-auto h-12 w-12 text-slate-300 mb-3"><ClipboardList className="h-full w-full" /></div><p className="text-slate-900 font-medium">Tidak ada data ditemukan</p><p className="text-sm text-slate-500 mt-1">{searchTerm ? 'Coba kata kunci pencarian lain.' : 'Belum ada evaluasi SOAP yang tercatat.'}</p></div> ) : (
            filteredGroups.map((group) => (
              <Card key={group.patient.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer border-slate-200 group overflow-hidden bg-white" onClick={() => handlePatientClick(group)}>
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400 w-full" />
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm border border-blue-200">{group.patient.full_name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0"><h3 className="font-semibold text-slate-900 truncate pr-2" title={group.patient.full_name}>{group.patient.full_name}</h3><p className="text-xs text-slate-500 font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">{group.patient.medical_record_number || 'No RM'}</p></div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 whitespace-nowrap">{group.count} Catatan</Badge>
                  </div>
                  <div className="space-y-2.5 text-sm text-slate-600 mb-5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2.5"><Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="truncate">Terakhir: <span className="font-medium text-slate-900">{format(new Date(group.lastDate), 'dd MMM yyyy', { locale: id })}</span></span></div>
                    <div className="flex items-center gap-2.5"><User className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="truncate">Oleh: {group.records[0]?.therapist?.full_name || 'Terapis'}</span></div>
                  </div>
                  <Button className="w-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 justify-between group-hover:shadow-sm transition-all" variant="outline" size="sm"><span className="font-medium">Lihat Detail SOAP</span><ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" /></Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <DailyEvaluationDetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} patientData={selectedPatientGroup} />
        <ImportSummaryModal isOpen={showImportSummary} onClose={() => setShowImportSummary(false)} summary={importSummary} />
      </div>
    </div>
  );
};

export default DailyEvaluationReadOnly;