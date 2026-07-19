import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, HardDrive, Copy, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import {
  getGoogleDriveSettings,
  upsertGoogleDriveSettings,
  getGoogleDriveServiceAccountEmail,
} from '@/lib/api';

const extractFolderId = (input) => {
  const trimmed = input.trim();
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
};

const GoogleDriveSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [folderName, setFolderName] = useState('');
  const [hasFolder, setHasFolder] = useState(false);
  const [serviceEmail, setServiceEmail] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [settingsRes, emailRes] = await Promise.all([
      getGoogleDriveSettings(),
      getGoogleDriveServiceAccountEmail(),
    ]);

    if (settingsRes.data) {
      setFolderInput(settingsRes.data.folder_id || '');
      setFolderName(settingsRes.data.folder_name || '');
      setHasFolder(!!settingsRes.data.folder_id);
    }
    if (emailRes.data?.serviceAccountEmail) {
      setServiceEmail(emailRes.data.serviceAccountEmail);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const folderId = extractFolderId(folderInput);
    if (!folderId) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Folder ID / Link Drive wajib diisi.' });
      return;
    }

    setSaving(true);
    const { error } = await upsertGoogleDriveSettings({ folderId, folderName: folderName.trim() });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } else {
      toast({ title: 'Tersimpan', description: 'Folder tujuan upload Google Drive berhasil diatur.' });
      setHasFolder(true);
    }
    setSaving(false);
  };

  const handleCopyEmail = () => {
    if (!serviceEmail) return;
    navigator.clipboard.writeText(serviceEmail);
    toast({ title: 'Disalin', description: 'Email service account disalin ke clipboard.' });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-600" />
          Upload Google Drive Terapis
        </h2>
        <p className="text-slate-500 mt-1">
          Atur folder Google Drive tujuan agar terapis dapat mengunggah dokumen (foto, PDF, dll) langsung dari dashboard mereka.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="text-base">Status Folder</Label>
            <p className="text-xs text-slate-500">Folder tempat file terapis akan disimpan.</p>
          </div>
          {!loading && (
            hasFolder ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Terhubung
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Belum Diatur
              </span>
            )
          )}
        </div>

        {loading ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-4">
            <ol className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 list-decimal list-inside">
              <li>Buat / pilih folder di Google Drive Anda untuk menampung dokumen terapis.</li>
              <li>
                Klik <strong>Share</strong> pada folder tersebut, lalu tambahkan email berikut sebagai <strong>Editor</strong>:
                <div className="mt-2 flex items-center gap-2">
                  <Input readOnly value={serviceEmail || 'Memuat...'} className="font-mono text-xs bg-white" />
                  <Button type="button" variant="outline" size="icon" onClick={handleCopyEmail} disabled={!serviceEmail}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </li>
              <li>Salin ID folder atau tautan lengkap folder, lalu tempel di bawah ini.</li>
            </ol>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Folder ID atau Link Google Drive</Label>
                <Input
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Nama Folder (opsional, untuk label)</Label>
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Contoh: Dokumen Terapis Klinik"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={hasFolder ? `https://drive.google.com/drive/folders/${extractFolderId(folderInput)}` : '#'}
                target="_blank"
                rel="noreferrer"
                className={`text-xs flex items-center gap-1 ${hasFolder ? 'text-blue-600 hover:underline' : 'text-slate-300 pointer-events-none'}`}
              >
                Buka folder di Drive <ExternalLink className="w-3 h-3" />
              </a>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Folder
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleDriveSettings;
