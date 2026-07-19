import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Loader2, FileUp, ExternalLink, CheckCircle2 } from 'lucide-react';
import { uploadFileToClinicDrive, getMyDriveUploads } from '@/lib/api';

const TherapistDriveUpload = () => {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await getMyDriveUploads();
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Pilih File', description: 'Silakan pilih file terlebih dahulu.' });
      return;
    }

    setUploading(true);
    const { data, error } = await uploadFileToClinicDrive({ file, label: label.trim() });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Upload', description: error.message });
    } else {
      toast({ title: 'Berhasil', description: `File "${file.name}" berhasil diunggah ke Google Drive.` });
      setFile(null);
      setLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchHistory();
    }
    setUploading(false);
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
          <Input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
    </div>
  );
};

export default TherapistDriveUpload;
