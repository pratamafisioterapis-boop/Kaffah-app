import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, Upload, CheckCircle2, Loader2, 
  FileSpreadsheet, Info, AlertTriangle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { importPatientsFromCSV, parseCSVForPreview } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PatientImportCSV = ({ onImportSuccess }) => {
  const { toast } = useToast();
  const { role } = useAuth();
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [showDocs, setShowDocs] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [processingFile, setProcessingFile] = useState(false);
  const [rmPreviewCache, setRmPreviewCache] = useState({});

  if (role !== 'owner') return null;

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;

  const downloadTemplate = () => {
    // Pipe delimited headers based on user requirement
    const headers = [
      'Nama Pasien', 'Jenis Kelamin', 'Info', 'Tgl Lahir', 'NIK', 'Alamat', 'No HP'
    ];

    const examples = [
      'Budi Santoso|Laki-laki|Instagram|1980-05-15|1234567890123456|Jl. Merdeka No. 1|081234567890',
      'Siti Nurhaliza|Perempuan|Google|20-10-1992||Jl. Sudirman Kav. 5|085678901234',
      'Ahmad Wijaya|Laki-laki|Facebook|1975/03/08|9876543210987654|Jl. Diponegoro 10|081908765432'
    ];

    const csvContent = [headers.join('|'), ...examples].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_import_pasien_baru.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    if (uploadedFile.type !== 'text/csv' && !uploadedFile.name.endsWith('.csv')) {
      toast({
        variant: "destructive",
        title: "File tidak valid",
        description: "Mohon upload file dengan format .csv"
      });
      return;
    }

    setFile(uploadedFile);
    setImportErrors([]);
    setProcessingFile(true);
    setActiveStep(3); 
    
    try {
        const textContent = await uploadedFile.text();
        setCsvText(textContent);
        const data = await parseCSVForPreview(textContent);
        if (data.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "File CSV kosong atau format salah." });
        }
        setParsedData(data);
        const newCache = {};
        data.forEach(row => {
            if(row.isValid && row.fullName && row.rmNumber) {
            newCache[row.fullName] = row.rmNumber;
            }
        });
        setRmPreviewCache(newCache);
    } catch (err) {
        console.error("Parse error", err);
        toast({ variant: "destructive", title: "Error", description: "Gagal memproses file CSV: " + err.message });
        setCsvText('');
    } finally {
        setProcessingFile(false);
    }
  };

  const handleImportCSV = async () => {
    if (!csvText || csvText.trim().length === 0) {
        toast({ variant: "destructive", title: "Import Gagal", description: "Tidak ada data CSV yang valid." });
        return;
    }

    if (invalidCount > 0) {
       if (!window.confirm(`Terdapat ${invalidCount} baris data tidak valid yang akan dilewati. Lanjutkan import ${validCount} data valid saja?`)) {
          return;
       }
    }

    if (validCount === 0) {
       toast({ variant: "destructive", title: "Import Gagal", description: "Tidak ada baris data valid untuk diimport." });
       return;
    }

    setImporting(true);
    setImportErrors([]);

    try {
      const result = await importPatientsFromCSV(csvText, rmPreviewCache);

      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (result.errors && result.errors.length > 0) {
          setImportErrors(result.errors);
          toast({
            variant: "warning",
            title: "Import Selesai dengan Peringatan",
            description: `Berhasil: ${result.imported_count}, Gagal: ${result.errors.length}`
          });
      } else {
          toast({
            title: "Import Selesai",
            description: `Berhasil import ${result.imported_count} data pasien.`,
            variant: "default"
          });
      }
      
      if (result.imported_count > 0) {
          if (!result.errors || result.errors.length === 0) {
              setFile(null);
              setCsvText('');
              setParsedData([]);
              setActiveStep(1);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
          if (onImportSuccess) onImportSuccess();
      }

    } catch (error) {
      console.error("Import execution error:", error);
      toast({
        variant: "destructive",
        title: "Import Gagal",
        description: error.message
      });
    } finally {
      setImporting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8 space-x-4 text-sm">
      {[
        { num: 1, label: 'Download Template' },
        { num: 2, label: 'Upload CSV' },
        { num: 3, label: 'Preview & Validasi' },
        { num: 4, label: 'Import' }
      ].map((step) => (
        <div key={step.num} className={`flex items-center ${activeStep >= step.num ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 border ${activeStep >= step.num ? 'bg-blue-100 border-blue-600' : 'bg-slate-50 border-slate-300'}`}>
            {step.num}
          </div>
          <span className="hidden sm:inline">{step.label}</span>
          {step.num < 4 && <div className="w-8 h-px bg-slate-300 mx-2 hidden sm:block" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Import Data Pasien (CSV)</h2>
          <p className="text-slate-500 text-sm">Format Baru: Nama|Gender|Info|Tgl Lahir|NIK|Alamat|No HP (Pemisah Pipa |)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowDocs(!showDocs)} className="gap-2">
          <Info className="w-4 h-4" /> Panduan
        </Button>
      </div>

      <StepIndicator />

      {showDocs && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600"/> Kolom CSV (Urutan Wajib)</h4>
            <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1 font-mono">
                <li>Nama Pasien (Wajib)</li>
                <li>Jenis Kelamin (Laki-laki/Perempuan)</li>
                <li>Info Tambahan (Opsional)</li>
                <li>Tanggal Lahir (YYYY-MM-DD)</li>
                <li>NIK (Max 16 digit)</li>
                <li>Alamat</li>
                <li>No HP (10-15 digit)</li>
            </ol>
            <div className="bg-blue-50 p-3 rounded-md text-xs text-blue-700">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>Gunakan pemisah pipa (<strong>|</strong>) bukan koma (,).</li>
                    <li>Contoh: <code>Budi|Laki-laki|Instagram|1990-01-01|123456|Jl. A|08123</code></li>
                    <li>Baris tanpa Nama Pasien akan otomatis dilewati.</li>
                </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-2 hover:border-blue-400 transition-colors cursor-pointer group" onClick={downloadTemplate}>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">1. Download Template</h3>
            <p className="text-xs text-slate-500 mt-1">Template CSV format pipa (|)</p>
          </CardContent>
        </Card>

        <Card className="border-dashed border-2 hover:border-blue-400 transition-colors cursor-pointer group relative">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full">
            {processingFile ? (
               <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
            ) : (
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-green-600" />
                </div>
            )}
            <h3 className="font-semibold text-slate-900">2. Upload CSV</h3>
            <p className="text-xs text-slate-500 mt-1">
              {file ? file.name : "Klik atau drag file ke sini"}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {importErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Import Selesai dengan {importErrors.length} Error</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-[100px] mt-2 w-full pr-4">
                <ul className="list-disc pl-5 space-y-1 text-xs">
                    {importErrors.map((err, idx) => (
                        <li key={idx}>
                            Baris {err.row}: {Array.isArray(err.reasons) ? err.reasons.join(", ") : err.reasons}
                        </li>
                    ))}
                </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {parsedData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">3. Preview & Validasi</h3>
            <div className="flex gap-2 text-xs font-medium">
              <span className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/> {validCount} Valid</span>
              <span className="flex items-center text-red-600"><AlertCircle className="w-4 h-4 mr-1"/> {invalidCount} Invalid</span>
            </div>
          </div>
          <div className="h-[300px] w-full overflow-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 w-10">#</th>
                  <th className="px-4 py-2 w-16">Status</th>
                  <th className="px-4 py-2">No RM (Est)</th>
                  <th className="px-4 py-2">Nama Pasien</th>
                  <th className="px-4 py-2">Nama Panggilan</th>
                  <th className="px-4 py-2">Tgl Lahir</th>
                  <th className="px-4 py-2">Usia</th>
                  <th className="px-4 py-2">No HP</th>
                  <th className="px-4 py-2">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? "hover:bg-slate-50" : "bg-red-50 hover:bg-red-100"}>
                      <td className="px-4 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-4 py-2">
                        {row.isValid ? 
                            <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        }
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-600">{row.rmNumber}</td>
                      <td className="px-4 py-2 font-medium">
                          {row.fullName || <span className="text-red-500 italic">Kosong</span>}
                      </td>
                      <td className="px-4 py-2 text-blue-600 font-medium">{row.nickname || '-'}</td>
                      <td className="px-4 py-2">
                          {row.birthDate || '-'}
                      </td>
                      <td className="px-4 py-2">{row.age !== null ? `${row.age} Thn` : '-'}</td>
                      <td className="px-4 py-2">{row.phone || '-'}</td>
                      <td className="px-4 py-2">{row.additionalInfo}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
           {invalidCount > 0 && (
             <div className="p-4 bg-red-50 border-t border-red-100">
               <h4 className="text-xs font-bold text-red-700 mb-2">Error Detil:</h4>
               <ul className="text-xs text-red-600 space-y-1 max-h-[100px] overflow-y-auto pl-4 list-disc">
                 {parsedData.filter(r => !r.isValid).map((r, i) => (
                   <li key={i}>
                       Baris {r.rowNumber}: {r.errors && r.errors.length > 0 ? r.errors.join(", ") : "Data tidak valid"}
                   </li>
                 ))}
               </ul>
             </div>
          )}
        </Card>
      )}

      {parsedData.length > 0 && (
         <div className="flex justify-end pt-4">
            <Button 
              onClick={handleImportCSV} 
              disabled={importing || validCount === 0}
              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengimport...</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4 mr-2" /> Import {validCount} Data Valid</>
              )}
            </Button>
         </div>
      )}
    </div>
  );
};

export default PatientImportCSV;