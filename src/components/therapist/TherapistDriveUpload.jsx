import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Loader2, FileUp, ExternalLink, CheckCircle2, Paperclip, X, Camera, Image as ImageIcon } from 'lucide-react';
import { uploadFileToClinicDrive, getMyDriveUploads } from '@/lib/api';

const MAX_FILE_SIZE_MB = 100;

// Simpan file yang baru dipilih ke IndexedDB supaya selamat dari reload
// halaman (tab Android bisa di-reload OS saat user berada di native
// file/camera picker; file yang dipilih hilang tanpa pesan apa pun).
// Saat komponen dimuat lagi, file yang tersimpan dipulihkan otomatis.
const PENDING_DB = 'kaffah-drive-upload';
const PENDING_STORE = 'pending';
const PENDING_KEY = 'current';
const PENDING_MAX_AGE_MS = 15 * 60 * 1000;

const openPendingDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(PENDING_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PENDING_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const withPendingStore = async (mode, fn) => {
  const db = await openPendingDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, mode);
      const result = fn(tx.objectStore(PENDING_STORE));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const savePendingUpload = (file, label) =>
  withPendingStore('readwrite', (store) =>
    store.put({ file, label, savedAt: Date.now() }, PENDING_KEY)
  ).catch(() => {});

const loadPendingUpload = () =>
  withPendingStore('readonly', (store) => store.get(PENDING_KEY)).catch(() => null);

const clearPendingUpload = () =>
  withPendingStore('readwrite', (store) => store.delete(PENDING_KEY)).catch(() => {});

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

const TherapistDriveUpload = () => {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const resetAllInputs = () => {
    [cameraInputRef, galleryInputRef].forEach((ref) => {
      if (ref.current) ref.current.value = '';
    });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Pulihkan file yang sempat dipilih tapi hilang karena halaman ter-reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await loadPendingUpload();
      if (cancelled || !pending?.file) return;
      if (Date.now() - (pending.savedAt || 0) > PENDING_MAX_AGE_MS) {
        clearPendingUpload();
        return;
      }
      setFile(pending.file);
      if (pending.label) setLabel(pending.label);
      toast({ title: 'File Dipulihkan', description: `File "${pending.file.name}" yang sempat terputus berhasil dipulihkan.` });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setiap kali file/label berubah, simpan sebagai upload tertunda.
  useEffect(() => {
    if (file) savePendingUpload(file, label);
  }, [file, label]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await getMyDriveUploads();
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    if (selected && selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Terlalu Besar',
        description: `Ukuran maksimal ${MAX_FILE_SIZE_MB} MB. File Anda ${formatFileSize(selected.size)}.`,
      });
      resetAllInputs();
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleClearFile = () => {
    setFile(null);
    resetAllInputs();
    clearPendingUpload();
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Pilih File', description: 'Silakan pilih file terlebih dahulu.' });
      return;
    }

    if (!label.trim()) {
      toast({ variant: 'destructive', title: 'Keterangan Wajib Diisi', description: 'Silakan isi keterangan sebagai nama file yang akan diunggah.' });
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
          Upload Konten
        </h2>
        <p className="text-slate-500 mt-1">
          Unggah foto atau video ke folder Google Drive klinik yang telah diatur Owner.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">Pilih File</Label>
          {/* Dua jalur terpisah: kamera dan galeri memakai picker media ringan
              Android (terbukti stabil, sama dengan upload Remunerasi). */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4" /> Ambil Foto
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" /> Foto/Video
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
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
          <Label className="text-xs text-slate-600">Keterangan <span className="text-red-500">*</span></Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Contoh: Foto evaluasi pasien Budi"
            required
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={uploading || !file || !label.trim()} className="bg-blue-600 hover:bg-blue-700">
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
    </div>
  );
};

export default TherapistDriveUpload;
