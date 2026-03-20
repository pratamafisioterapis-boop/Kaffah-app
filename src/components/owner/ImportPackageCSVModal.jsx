import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { read, utils } from 'xlsx';
import { getPatients, getOperationalOptions, createPackageTracking } from '@/lib/api';
import { format, isValid, parseISO } from 'date-fns';

const ImportPackageCSVModal = ({ isOpen, onClose, onSuccess }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState('upload'); // upload, preview, importing
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationSummary, setValidationSummary] = useState({ valid: 0, invalid: 0 });
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reference Data
  const [patients, setPatients] = useState([]);
  const [packageTypes, setPackageTypes] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReferenceData();
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setValidationSummary({ valid: 0, invalid: 0 });
    setImporting(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchReferenceData = async () => {
    setLoadingRefs(true);
    try {
      const [patientsRes, pkgTypesRes] = await Promise.all([
        getPatients(),
        getOperationalOptions('tipe_paket')
      ]);
      setPatients(patientsRes.data || []);
      setPackageTypes(pkgTypesRes.data || []);
    } catch (error) {
      console.error("Failed to load reference data", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data referensi." });
    } finally {
      setLoadingRefs(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['Nama Pasien', 'Tanggal Beli (YYYY-MM-DD)', 'Tanggal Selesai (YYYY-MM-DD)', 'Jenis Paket', 'Total Sesi'];
    const sample = ['Budi Santoso', '2024-01-01', '2024-02-01', 'Paket 5 Sesi', '5'];
    
    const ws = utils.aoa_to_sheet([headers, sample]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    const wbout = utils.sheet_to_csv(ws);
    
    const blob = new Blob([wbout], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "template_import_paket.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length < 2) {
          throw new Error("File kosong atau format salah");
        }

        validateData(data);
        setStep('preview');
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal Membaca File", description: error.message });
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const findPatient = (name) => {
    if (!name) return null;
    const cleanName = name.toString().toLowerCase().trim();
    // Exact match RM
    const byRM = patients.find(p => p.rm_number?.toLowerCase() === cleanName);
    if (byRM) return byRM;
    // Name match
    return patients.find(p => p.full_name?.toLowerCase().includes(cleanName) || cleanName.includes(p.full_name?.toLowerCase()));
  };

  const findPackageType = (name) => {
    if (!name) return null;
    const cleanName = name.toString().toLowerCase().trim();
    return packageTypes.find(p => p.label.toLowerCase() === cleanName);
  };

  const validateData = (rows) => {
    const headers = rows[0].map(h => h?.toString().toLowerCase().trim());
    // Basic mapping check
    const nameIdx = headers.findIndex(h => h.includes('nama'));
    const dateIdx = headers.findIndex(h => h.includes('beli') || h.includes('start'));
    const endIdx = headers.findIndex(h => h.includes('selesai') || h.includes('end'));
    const typeIdx = headers.findIndex(h => h.includes('jenis') || h.includes('paket'));
    const sessionIdx = headers.findIndex(h => h.includes('total') || h.includes('sesi'));

    if (nameIdx === -1 || dateIdx === -1 || typeIdx === -1) {
      toast({ variant: "destructive", title: "Format Salah", description: "Kolom wajib: Nama Pasien, Tanggal Beli, Jenis Paket tidak ditemukan." });
      setFile(null);
      return;
    }

    const processed = rows.slice(1).map((row, index) => {
      const rawName = row[nameIdx];
      const rawDate = row[dateIdx];
      const rawEnd = row[endIdx];
      const rawType = row[typeIdx];
      const rawSession = row[sessionIdx];

      if (!rawName && !rawType) return null; // Skip empty rows

      const patient = findPatient(rawName);
      const pkgType = findPackageType(rawType);
      
      let status = 'valid';
      let errors = [];

      if (!patient) {
        status = 'invalid';
        errors.push('Pasien tidak ditemukan');
      }
      if (!pkgType) {
        status = 'invalid';
        errors.push('Jenis paket tidak valid');
      }
      
      let startDate = null;
      if (rawDate) {
        // Try parsing various formats
        const d = new Date(rawDate);
        if (isValid(d)) startDate = format(d, 'yyyy-MM-dd');
        else {
             status = 'invalid';
             errors.push('Format tanggal salah');
        }
      } else {
        status = 'invalid';
        errors.push('Tanggal beli wajib');
      }

      let endDate = null;
      if (rawEnd) {
          const d = new Date(rawEnd);
          if (isValid(d)) endDate = format(d, 'yyyy-MM-dd');
      }

      // Default sessions from package type if not provided
      const totalSessions = rawSession ? parseInt(rawSession) : (pkgType?.session_count || 0);

      return {
        id: index,
        rawName,
        rawType,
        rawDate,
        patientId: patient?.id,
        patientName: patient?.full_name,
        packageTypeId: pkgType?.id,
        packageName: pkgType?.label || rawType,
        startDate,
        endDate,
        totalSessions,
        validityDays: pkgType?.validity_days || 30,
        status,
        errors
      };
    }).filter(Boolean);

    setParsedData(processed);
    setValidationSummary({
      valid: processed.filter(p => p.status === 'valid').length,
      invalid: processed.filter(p => p.status === 'invalid').length
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    const validRows = parsedData.filter(p => p.status === 'valid');
    let successCount = 0;
    
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const payload = {
          patient_id: row.patientId,
          package_type_id: row.packageTypeId,
          package_name: row.packageName,
          total_sessions: row.totalSessions,
          sessions_used: 0,
          sessions_remaining: row.totalSessions,
          start_date: row.startDate,
          end_date: row.endDate || null,
          validity_days: row.validityDays,
          status: 'aktif'
        };
        
        // If end_date is missing, calculate it
        if (!payload.end_date && payload.start_date && payload.validity_days) {
            const start = new Date(payload.start_date);
            const end = new Date(start);
            end.setDate(end.getDate() + payload.validity_days);
            payload.end_date = format(end, 'yyyy-MM-dd');
        }

        // Ensure package_type_id is present
        if (!payload.package_type_id) {
            console.error(`Skipping import for ${row.rawName}: Missing package_type_id`);
            continue;
        }

        await createPackageTracking(payload);
        successCount++;
        setProgress(Math.round(((i + 1) / validRows.length) * 100));
      } catch (error) {
        console.error(`Failed to import row ${i}`, error);
      }
    }

    toast({
      title: "Import Selesai",
      description: `Berhasil mengimpor ${successCount} dari ${validRows.length} data paket.`,
    });
    
    setImporting(false);
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
             <Upload className="w-5 h-5" /> Import Data Paket (CSV)
          </DialogTitle>
          <DialogDescription>
            Upload file CSV untuk menambahkan riwayat paket secara massal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {step === 'upload' && (
             <div className="space-y-6">
                 <Alert className="bg-blue-50 border-blue-200">
                    <InfoIcon className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Petunjuk Format CSV</AlertTitle>
                    <AlertDescription className="text-blue-700 text-sm mt-1">
                        Pastikan kolom CSV sesuai urutan: <br/>
                        <b>Nama Pasien, Tanggal Beli, Tanggal Selesai, Jenis Paket, Total Sesi</b><br/>
                        Format Tanggal: YYYY-MM-DD (Contoh: 2024-01-30)
                    </AlertDescription>
                 </Alert>

                 <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-4" />
                    <h3 className="font-semibold text-lg text-slate-700">Klik untuk upload file CSV</h3>
                    <p className="text-slate-500 text-sm mt-1">atau drag & drop file disini</p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".csv, .xlsx, .xls"
                        onChange={processFile} 
                    />
                 </div>

                 <div className="flex justify-center">
                    <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
                        <Download className="w-4 h-4" /> Download Template CSV
                    </Button>
                 </div>
             </div>
          )}

          {(step === 'preview' || step === 'importing') && (
              <div className="space-y-4">
                  <div className="flex gap-4">
                      <div className="flex-1 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-3">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                          <div>
                              <p className="text-xs text-green-600 font-medium">Data Valid</p>
                              <p className="text-xl font-bold text-green-700">{validationSummary.valid}</p>
                          </div>
                      </div>
                      <div className="flex-1 bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-3">
                          <XCircle className="w-8 h-8 text-red-600" />
                          <div>
                              <p className="text-xs text-red-600 font-medium">Data Invalid</p>
                              <p className="text-xl font-bold text-red-700">{validationSummary.invalid}</p>
                          </div>
                      </div>
                  </div>

                  <div className="rounded-md border">
                      <ScrollArea className="h-[300px]">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Nama Pasien</TableHead>
                                    <TableHead>Jenis Paket</TableHead>
                                    <TableHead>Tgl Beli</TableHead>
                                    <TableHead>Pesan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedData.map((row) => (
                                    <TableRow key={row.id} className={row.status === 'invalid' ? 'bg-red-50/50' : ''}>
                                        <TableCell>
                                            {row.status === 'valid' 
                                                ? <Badge className="bg-green-600">Valid</Badge> 
                                                : <Badge variant="destructive">Invalid</Badge>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{row.rawName}</div>
                                            {row.patientName && <div className="text-xs text-slate-500">Matched: {row.patientName}</div>}
                                        </TableCell>
                                        <TableCell>{row.rawType}</TableCell>
                                        <TableCell>{row.startDate || row.rawDate}</TableCell>
                                        <TableCell className="text-xs text-red-600">
                                            {row.errors.join(', ')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </ScrollArea>
                  </div>
                  
                  {step === 'importing' && (
                     <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                             <span>Importing...</span>
                             <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                     </div>
                  )}
              </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50">
            {step === 'upload' ? (
                <Button variant="ghost" onClick={onClose}>Batal</Button>
            ) : (
                <>
                    <Button variant="outline" onClick={resetState} disabled={importing}>Upload Ulang</Button>
                    <Button onClick={handleImport} disabled={validationSummary.valid === 0 || importing}>
                        {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {importing ? 'Memproses...' : `Import ${validationSummary.valid} Data`}
                    </Button>
                </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function InfoIcon(props) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    )
}

export default ImportPackageCSVModal;