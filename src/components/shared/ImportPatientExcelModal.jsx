import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Download, FileSpreadsheet, Info, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { bulkCreatePatients } from '@/lib/api';
import { isValid, parseISO, format } from 'date-fns';

const TEMPLATE_HEADERS = [
  'Nama Pasien',
  'Nama Panggilan',
  'Jenis Kelamin (L/P)',
  'Tanggal Lahir (YYYY-MM-DD)',
  'NIK',
  'No. HP',
  'Alamat',
  'No. RM (opsional)'
];

const normalizeGender = (raw) => {
  if (!raw) return null;
  const v = raw.toString().trim().toLowerCase();
  if (['l', 'laki-laki', 'laki laki', 'pria', 'male', 'm'].includes(v)) return 'Laki-laki';
  if (['p', 'perempuan', 'wanita', 'female', 'f'].includes(v)) return 'Perempuan';
  return null;
};

const normalizePhone = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  let v = raw.toString().trim().replace(/[^\d]/g, '');
  if (!v) return null;
  // Excel often drops the leading 0 when a phone number is stored as a number
  if (!v.startsWith('0') && v.length >= 8 && v.length <= 12) v = '0' + v;
  return v;
};

const normalizeBirthDate = (raw) => {
  if (!raw) return { value: null, invalid: false };
  // Excel serial date number
  if (typeof raw === 'number') {
    const parsed = utils.format_cell({ t: 'n', v: raw, z: 'yyyy-mm-dd' });
    const d = new Date(parsed);
    if (isValid(d)) return { value: format(d, 'yyyy-MM-dd'), invalid: false };
    return { value: null, invalid: true };
  }
  const str = raw.toString().trim();
  if (!str) return { value: null, invalid: false };
  let d = parseISO(str);
  if (!isValid(d)) d = new Date(str);
  if (!isValid(d)) return { value: null, invalid: true };
  return { value: format(d, 'yyyy-MM-dd'), invalid: false };
};

const ImportPatientExcelModal = ({ isOpen, onClose, onSuccess }) => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload, preview, importing
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultSummary, setResultSummary] = useState(null);

  const resetState = () => {
    setStep('upload');
    setParsedRows([]);
    setImporting(false);
    setProgress(0);
    setResultSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const sample = [
      TEMPLATE_HEADERS,
      ['Budi Santoso', 'Budi', 'L', '1990-05-20', '3271012005900001', '081234567890', 'Jl. Merdeka No. 10', ''],
      ['Siti Aminah', '', '', '', '', '', '', '']
    ];
    const ws = utils.aoa_to_sheet(sample);
    ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Template');
    writeFile(wb, 'template_import_pasien.xlsx');
  };

  const processFile = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) {
          throw new Error('File kosong atau tidak ada baris data.');
        }

        validateRows(rows);
        setStep('preview');
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal Membaca File", description: error.message });
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const validateRows = (rows) => {
    const headers = rows[0].map(h => h?.toString().toLowerCase().trim());

    const nameIdx = headers.findIndex(h => h.includes('nama') && !h.includes('panggilan'));
    const nicknameIdx = headers.findIndex(h => h.includes('panggilan'));
    const genderIdx = headers.findIndex(h => h.includes('kelamin') || h.includes('gender'));
    const birthIdx = headers.findIndex(h => h.includes('lahir'));
    const nikIdx = headers.findIndex(h => h.includes('nik'));
    const phoneIdx = headers.findIndex(h => h.includes('hp') || h.includes('telepon') || h.includes('phone'));
    const addressIdx = headers.findIndex(h => h.includes('alamat') || h.includes('address'));
    const rmIdx = headers.findIndex(h => h.includes('no. rm') || h.includes('rekam medis') || h.trim() === 'rm');

    if (nameIdx === -1) {
      toast({ variant: "destructive", title: "Format Salah", description: "Kolom 'Nama Pasien' tidak ditemukan di file." });
      return;
    }

    const processed = rows.slice(1).map((row, index) => {
      const rawName = row[nameIdx];
      if ((row || []).every(cell => cell === '' || cell === null || cell === undefined)) return null; // skip fully empty rows

      const fullName = rawName ? rawName.toString().trim() : '';
      const { value: birthDate, invalid: birthInvalid } = birthIdx !== -1 ? normalizeBirthDate(row[birthIdx]) : { value: null, invalid: false };

      const isValidRow = fullName.length > 0;

      return {
        id: index,
        full_name: fullName,
        nickname: nicknameIdx !== -1 && row[nicknameIdx] ? row[nicknameIdx].toString().trim() : null,
        gender: genderIdx !== -1 ? normalizeGender(row[genderIdx]) : null,
        birth_date: birthDate,
        birthDateNote: birthInvalid ? 'Tanggal lahir tidak dikenali, dikosongkan' : null,
        nik: nikIdx !== -1 && row[nikIdx] ? row[nikIdx].toString().trim() : null,
        phone: phoneIdx !== -1 ? normalizePhone(row[phoneIdx]) : null,
        address: addressIdx !== -1 && row[addressIdx] ? row[addressIdx].toString().trim() : null,
        medical_record_number: rmIdx !== -1 && row[rmIdx] ? row[rmIdx].toString().trim() : null,
        status: isValidRow ? 'valid' : 'invalid',
        error: isValidRow ? null : 'Nama pasien wajib diisi'
      };
    }).filter(Boolean);

    setParsedRows(processed);
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) return;

    setImporting(true);
    setStep('importing');
    setProgress(30);

    const payload = validRows.map(r => ({
      full_name: r.full_name,
      nickname: r.nickname,
      gender: r.gender,
      birth_date: r.birth_date,
      nik: r.nik,
      phone: r.phone,
      address: r.address,
      ...(r.medical_record_number ? { medical_record_number: r.medical_record_number } : {})
    }));

    const { data, error } = await bulkCreatePatients(payload);
    setProgress(100);
    setImporting(false);

    if (error) {
      toast({ variant: "destructive", title: "Import Gagal", description: error.message || "Gagal menyimpan data pasien." });
      setStep('preview');
      return;
    }

    setResultSummary({ imported: data?.length || 0, skipped: invalidCount });
    toast({ title: "Import Selesai", description: `Berhasil menambahkan ${data?.length || 0} pasien baru.` });
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Import Pasien dari Excel
          </DialogTitle>
          <DialogDescription>
            Upload file Excel/CSV untuk menambahkan banyak pasien sekaligus.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {step === 'upload' && (
            <div className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Petunjuk Format</AlertTitle>
                <AlertDescription className="text-blue-700 text-sm mt-1">
                  Kolom yang wajib diisi hanya <b>Nama Pasien</b> — kolom lain boleh dikosongkan dan bisa dilengkapi belakangan.
                  Nomor Rekam Medis otomatis dibuat jika kolom "No. RM" kosong.
                  Simpan kolom No. HP/NIK sebagai format Teks di Excel agar angka 0 di depan tidak hilang.
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="font-semibold text-lg text-slate-700">Klik untuk upload file Excel/CSV</h3>
                <p className="text-slate-500 text-sm mt-1">atau drag &amp; drop file disini</p>
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
                  <Download className="w-4 h-4" /> Download Template Excel
                </Button>
              </div>
            </div>
          )}

          {(step === 'preview' || step === 'importing') && !resultSummary && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-xs text-green-600 font-medium">Siap Diimpor</p>
                    <p className="text-xl font-bold text-green-700">{validCount}</p>
                  </div>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-xs text-red-600 font-medium">Dilewati (Tanpa Nama)</p>
                    <p className="text-xl font-bold text-red-700">{invalidCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <ScrollArea className="h-[320px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Tgl Lahir</TableHead>
                        <TableHead>No. HP</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row) => (
                        <TableRow key={row.id} className={row.status === 'invalid' ? 'bg-red-50/50' : ''}>
                          <TableCell>
                            {row.status === 'valid'
                              ? <Badge className="bg-green-600">Valid</Badge>
                              : <Badge variant="destructive">Dilewati</Badge>}
                          </TableCell>
                          <TableCell className="font-medium">{row.full_name || '-'}</TableCell>
                          <TableCell>{row.gender || '-'}</TableCell>
                          <TableCell>{row.birth_date || '-'}</TableCell>
                          <TableCell>{row.phone || '-'}</TableCell>
                          <TableCell className="text-xs text-amber-600">
                            {row.error || row.birthDateNote || ''}
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
                    <span>Mengimpor...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {resultSummary && (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
              <CheckCircle className="w-16 h-16 text-green-600" />
              <h3 className="text-lg font-semibold text-slate-800">Import Selesai</h3>
              <p className="text-slate-500 text-sm">
                {resultSummary.imported} pasien berhasil ditambahkan.
                {resultSummary.skipped > 0 && ` ${resultSummary.skipped} baris dilewati karena tidak ada nama.`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-slate-50">
          {resultSummary ? (
            <Button onClick={handleClose}>Selesai</Button>
          ) : step === 'upload' ? (
            <Button variant="ghost" onClick={handleClose}>Batal</Button>
          ) : (
            <>
              <Button variant="outline" onClick={resetState} disabled={importing}>Upload Ulang</Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? 'Memproses...' : `Import ${validCount} Pasien`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportPatientExcelModal;
