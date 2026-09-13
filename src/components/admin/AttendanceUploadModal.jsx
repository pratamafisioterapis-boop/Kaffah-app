import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet, Info, CheckCircle, AlertTriangle, Loader2, Link2 } from 'lucide-react';
import { parseAttendanceExcel, buildAttendanceRecords } from '@/utils/attendanceExcelParser';
import { buildHomecareLookup } from '@/utils/attendanceHomecareLookup';
import { bulkUpsertAttendanceRecords, upsertAttendanceEmployeeAlias, getAppointments } from '@/lib/api';

const STATUS_LABEL = {
  on_time: { label: 'Tepat Waktu', className: 'bg-green-600' },
  late: { label: 'Terlambat', className: 'bg-red-600' },
  incomplete: { label: 'Absen Tidak Lengkap', className: 'bg-amber-500' },
};

const AttendanceUploadModal = ({ isOpen, onClose, onSuccess, shiftSettingsByDept, therapists, aliases, onAliasesChanged }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload, preview, importing, done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);
  const [localAliases, setLocalAliases] = useState([]);
  const [linkingPick, setLinkingPick] = useState({});
  const [linkingBusy, setLinkingBusy] = useState(null);
  const [homecareLookup, setHomecareLookup] = useState(null);

  useEffect(() => { setLocalAliases(aliases || []); }, [aliases]);

  useEffect(() => {
    if (!parsed?.periodStart || !parsed?.periodEnd) {
      setHomecareLookup(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await getAppointments({
        startDate: `${parsed.periodStart}T00:00:00`,
        endDate: `${parsed.periodEnd}T23:59:59`,
      });
      if (!cancelled) setHomecareLookup(buildHomecareLookup(data || []));
    })();
    return () => { cancelled = true; };
  }, [parsed]);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setParsed(null);
    setImporting(false);
    setResultSummary(null);
    setHomecareLookup(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const aliasMap = useMemo(
    () => new Map((localAliases || []).map((a) => [a.employee_name.trim().toLowerCase(), a.physiotherapist_id])),
    [localAliases]
  );

  const records = useMemo(() => {
    if (!parsed) return [];
    return buildAttendanceRecords(parsed, {
      shiftSettingsByDept: shiftSettingsByDept || {},
      therapists: therapists || [],
      aliasMap,
      homecareLookup,
    });
  }, [parsed, shiftSettingsByDept, therapists, aliasMap, homecareLookup]);

  const unmatchedEmployeeNames = useMemo(() => {
    const seen = new Map();
    records.forEach((r) => {
      if (!r.matched_therapist_name && !seen.has(r.employee_name)) seen.set(r.employee_name, r.department);
    });
    return Array.from(seen.entries()).map(([employee_name, department]) => ({ employee_name, department }));
  }, [records]);

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
        setParsed(result);
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

  const handleLinkTherapist = async (employeeName) => {
    const physiotherapistId = linkingPick[employeeName];
    if (!physiotherapistId) return;
    setLinkingBusy(employeeName);
    const { data, error } = await upsertAttendanceEmployeeAlias({ employee_name: employeeName, physiotherapist_id: physiotherapistId });
    setLinkingBusy(null);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menghubungkan', description: error.message });
      return;
    }

    setLocalAliases((prev) => [...prev.filter((a) => a.employee_name.trim().toLowerCase() !== employeeName.trim().toLowerCase()), data]);
    onAliasesChanged?.();
    toast({ title: 'Berhasil Dihubungkan', description: `"${employeeName}" akan dipakai jadwalnya mulai sekarang.` });
  };

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
                  Jam masuk yang diharapkan mengikuti jadwal praktik fisioterapis pada hari itu di kalender booking; bila fisioterapis
                  tidak punya jadwal pada hari tersebut atau karyawan bukan fisioterapis, sistem memakai jam default per departemen.
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

              {unmatchedEmployeeNames.length > 0 && (
                <Alert className="bg-slate-50 border-slate-200">
                  <Link2 className="h-4 w-4 text-slate-500" />
                  <AlertTitle className="text-slate-800">Karyawan Belum Terhubung ke Fisioterapis</AlertTitle>
                  <AlertDescription className="text-slate-600 text-xs mt-1">
                    <p className="mb-2">
                      Nama berikut tidak otomatis cocok dengan data fisioterapis (mis. panggilan yang beda jauh dari nama lengkap).
                      Hubungkan manual sekali agar jadwal booking-nya terpakai — otomatis dipakai untuk upload berikutnya juga.
                    </p>
                    <div className="space-y-2">
                      {unmatchedEmployeeNames.map(({ employee_name, department }) => (
                        <div key={employee_name} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                          <span className="font-medium text-slate-700 w-28 truncate">{employee_name}</span>
                          <span className="text-slate-400 w-24 truncate">{department || '-'}</span>
                          <Select
                            value={linkingPick[employee_name] || ''}
                            onValueChange={(v) => setLinkingPick((prev) => ({ ...prev, [employee_name]: v }))}
                          >
                            <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Pilih fisioterapis..." /></SelectTrigger>
                            <SelectContent>
                              {(therapists || []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!linkingPick[employee_name] || linkingBusy === employee_name}
                            onClick={() => handleLinkTherapist(employee_name)}
                          >
                            {linkingBusy === employee_name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Hubungkan'}
                          </Button>
                        </div>
                      ))}
                    </div>
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
                        <TableHead>Jadwal Masuk</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{r.attendance_date}</TableCell>
                          <TableCell className="font-medium">
                            {r.employee_name}
                            {r.matched_therapist_name && (
                              <div className="text-[11px] text-slate-400 font-normal">↳ {r.matched_therapist_name}</div>
                            )}
                          </TableCell>
                          <TableCell>{r.department || '-'}</TableCell>
                          <TableCell>{r.check_in || '-'}</TableCell>
                          <TableCell>{r.check_out || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {r.expected_check_in ? (
                              <span className={r.expected_source === 'override' || r.expected_source === 'schedule' || r.expected_source === 'homecare' ? 'text-blue-600 font-medium' : 'text-slate-500'}>
                                {r.expected_check_in}
                                {r.expected_source === 'override' ? ' (jadwal pengganti)' : r.expected_source === 'schedule' ? ' (jadwal booking)' : r.expected_source === 'homecare' ? ' (setelah homecare)' : r.expected_source === 'department' ? ' (departemen)' : ' (default)'}
                              </span>
                            ) : '-'}
                          </TableCell>
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
