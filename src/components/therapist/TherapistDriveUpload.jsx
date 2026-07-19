import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Loader2, FileUp, ExternalLink, CheckCircle2, Paperclip, X, FolderOpen, Bug } from 'lucide-react';
import { uploadFileToClinicDrive, getMyDriveUploads } from '@/lib/api';

const MAX_FILE_SIZE_MB = 25;

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

const nowStr = () => new Date().toTimeString().slice(0, 8) + '.' + new Date().getMilliseconds().toString().padStart(3, '0');

const useDiagLog = () => {
  const [log, setLog] = useState([]);
  const push = (msg) => setLog((prev) => [...prev.slice(-29), `${nowStr()} — ${msg}`]);
  return [log, push];
};

const TherapistDriveUpload = () => {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef(null);
  const [diagLog, pushDiag] = useDiagLog();

  useEffect(() => {
    pushDiag('Komponen dimuat (mount)');

    const onVisibility = () => pushDiag(`visibilitychange -> document.visibilityState=${document.visibilityState}`);
    const onPageShow = (e) => pushDiag(`pageshow (persisted=${e.persisted})`);
    const onPageHide = (e) => pushDiag(`pagehide (persisted=${e.persisted})`);
    const onFocus = () => pushDiag('window focus');
    const onBlur = () => pushDiag('window blur');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await getMyDriveUploads();
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    pushDiag(`onChange input file terpanggil, files.length=${e.target.files?.length ?? 'null'}${selected ? `, nama=${selected.name}` : ''}`);
    if (selected && selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Terlalu Besar',
        description: `Ukuran maksimal ${MAX_FILE_SIZE_MB} MB. File Anda ${formatFileSize(selected.size)}.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Pilih File', description: 'Silakan pilih file terlebih dahulu.' });
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await uploadFileToClinicDrive({ file, label: label.trim() });
      if (error) {
        console.error('[TherapistDriveUpload] Upload failed:', error);
        toast({ variant: 'destructive', title: 'Gagal Upload', description: error.message || 'Terjadi kesalahan saat mengunggah file.' });
      } else {
        toast({ title: 'Berhasil', description: `File "${file.name}" berhasil diunggah ke Google Drive.` });
        handleClearFile();
        setLabel('');
        fetchHistory();
      }
    } catch (err) {
      console.error('[TherapistDriveUpload] Unexpected error:', err);
      toast({ variant: 'destructive', title: 'Gagal Upload', description: err?.message || 'Terjadi kesalahan tak terduga.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-blue-600" />
          Upload Dokumen ke Google Drive
        </h2>
        <p className="text-slate-500 mt-1">
          Unggah dokumen (foto, PDF, dll) ke folder Google Drive klinik yang telah diatur Owner.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">Pilih File</Label>
          <button
            type="button"
            onClick={() => {
              pushDiag('Tombol "Pilih File" ditekan, memanggil input.click()');
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4" /> Pilih File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
            onClick={() => pushDiag('input file: onClick native terpicu')}
            disabled={uploading}
          />
          {file && (
            <div className="flex items-center justify-between gap-2 text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2 mt-1">
              <span className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-blue-400 flex-shrink-0">({formatFileSize(file.size)})</span>
              </span>
              <button type="button" onClick={handleClearFile} disabled={uploading} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">Keterangan (opsional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Contoh: Foto evaluasi pasien Budi"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={uploading || !file} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
            Upload ke Drive
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <Label className="text-base mb-3 block">Riwayat Upload Saya</Label>
        {loadingHistory ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Belum ada file yang diunggah.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.file_name}</p>
                    {item.label && <p className="text-xs text-slate-400 truncate">{item.label}</p>}
                  </div>
                </div>
                {item.web_view_link && (
                  <a
                    href={item.web_view_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-700">
        <Label className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
          <Bug className="w-3.5 h-3.5" /> Log Diagnostik (sementara, untuk debugging)
        </Label>
        <div className="text-[10px] font-mono space-y-0.5 max-h-64 overflow-y-auto">
          {diagLog.length === 0 ? (
            <p className="text-slate-500">Belum ada event tercatat.</p>
          ) : (
            diagLog.map((entry, i) => <p key={i} className="text-slate-300 break-all">{entry}</p>)
          )}
        </div>
      </div>
    </div>
  );
};

export default TherapistDriveUpload;
