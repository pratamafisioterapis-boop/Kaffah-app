import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet, Info, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { parseAttendanceExcel, buildAttendanceRecords } from '@/utils/attendanceExcelParser';
import { bulkUpsertAttendanceRecords } from '@/lib/api';

const STATUS_LABEL = {
  on_time: { label: 'Tepat Waktu', className: 'bg-green-600' },
  late: { label: 'Terlambat', className: 'bg-red-600' },
  incomplete: { label: 'Absen Tidak Lengkap', className: 'bg-amber-500' },
};

const AttendanceUploadModal = ({ isOpen, onClose, onSuccess, shiftSettingsByDept }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload, preview, importing, done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [records, setRecords] = useState([]);
  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setParsed(null);
    setRecords([]);
    setImporting(false);
    setResultSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const result = parseAttendanceExcel(bstr, { type: 'binary' });
        if (!result.periodStart || result.employees.length === 0) {
          toast({
            variant: "destructive",
            title: "Format File Tidak Dikenali",
            description: result.warnings[0] || 'Pastikan file adalah export asli "Employee Attendance Record" dari mesin absensi.',
          });
          return;
        }
        const built = buildAttendanceRecords(result, shiftSettingsByDept || {});
        setParsed(result);
        setRecords(built);
        setFileName(selectedFile.name);
        setStep('preview');
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal Membaca File", description: error.message });
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const lateCount = records.filter((r) => r.status === 'late').length;
  const incompleteCount = records.filter((r) => r.status === 'incomplete').length;
  const onTimeCount = records.filter((r) => r.status === 'on_time').length;

  const handleImport = async () => {
    if (records.length === 0) return;
    setImporting(true);
    setStep('importing');

    const { data, error } = await bulkUpsertAttendanceRecords(records, fileName);
    setImporting(false);

    if (error) {
      toast({ variant: "destructive", title: "Import Gagal", description: error.message || "Gagal menyimpan data absensi." });
      setStep('preview');
      return;
    }

    setResultSummary({ imported: data?.imported || records.length });
    setStep('done');
    toast({ title: "Import Selesai", description: `${data?.imported || records.length} data absensi berhasil disimpan.` });
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[850px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Upload Absensi Karyawan
          </DialogTitle>
          <DialogDescription>
            Upload file Excel (.xls/.xlsx) hasil export dari mesin absensi untuk memantau kedisiplinan jam masuk &amp; pulang karyawan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {step === 'upload' && (
            <div className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Format File</AlertTitle>
                <AlertDescription className="text-blue-700 text-sm mt-1">
                  Gunakan file "Employee Attendance Record" asli dari mesin fingerprint/absensi (berisi User ID, Name, Department,
                  dan jam masuk-pulang per tanggal). Data akan dicocokkan otomatis dengan nama fisioterapis yang terdaftar bila cocok.
                  Upload ulang periode yang sama akan menimpa data sebelumnya, bukan menduplikasi.
                </AlertDescription>
              </Alert>

              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="font-semibold text-lg text-slate-700">Klik untuk upload file absensi</h3>
                <p className="text-slate-500 text-sm mt-1">Format .xls atau .xlsx</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={processFile}
                />
              </div>
            </div>
          )}

          {(step === 'preview' || step === 'importing') && (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                Periode: <span className="font-medium text-slate-700">{parsed?.periodStart} s/d {parsed?.periodEnd}</span> &middot; {parsed?.employees.length} karyawan
              </div>

              {parsed?.warnings?.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Perhatian</AlertTitle>
                  <AlertDescription className="text-amber-700 text-xs mt-1 space-y-0.5">
                    {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-200 p-3 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Tepat Waktu</p>
                  <p className="text-xl font-bold text-green-700">{onTimeCount}</p>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 p-3 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Terlambat</p>
                  <p className="text-xl font-bold text-red-700">{lateCount}</p>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <p className="text-xs text-amber-600 font-medium">Tidak Lengkap</p>
                  <p className="text-xl font-bold text-amber-700">{incompleteCount}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="h-[320px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Departemen</TableHead>
                        <TableHead>Masuk</TableHead>
                        <TableHead>Pulang</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{r.attendance_date}</TableCell>
                          <TableCell className="font-medium">{r.employee_name}</TableCell>
                          <TableCell>{r.department || '-'}</TableCell>
                          <TableCell>{r.check_in || '-'}</TableCell>
                          <TableCell>{r.check_out || '-'}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_LABEL[r.status]?.className}>
                              {STATUS_LABEL[r.status]?.label}
                              {r.status === 'late' && r.late_minutes ? ` (${r.late_minutes}m)` : ''}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && resultSummary && (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
              <CheckCircle className="w-16 h-16 text-green-600" />
              <h3 className="text-lg font-semibold text-slate-800">Import Selesai</h3>
              <p className="text-slate-500 text-sm">{resultSummary.imported} data absensi berhasil disimpan.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50">
          {step === 'done' ? (
            <Button onClick={handleClose}>Selesai</Button>
          ) : step === 'upload' ? (
            <Button variant="ghost" onClick={handleClose}>Batal</Button>
          ) : (
            <>
              <Button variant="outline" onClick={resetState} disabled={importing}>Upload Ulang</Button>
              <Button onClick={handleImport} disabled={records.length === 0 || importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? 'Menyimpan...' : `Simpan ${records.length} Data`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceUploadModal;
