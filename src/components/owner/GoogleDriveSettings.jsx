import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, HardDrive, ShieldCheck, ShieldAlert, ExternalLink, LogIn } from 'lucide-react';
import {
  getGoogleDriveSettings,
  upsertGoogleDriveSettings,
  getGoogleDriveConnectionStatus,
  startGoogleDriveOAuth,
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
  const [connecting, setConnecting] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [folderName, setFolderName] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');

  useEffect(() => {
    fetchAll();
    handleOAuthRedirectResult();
  }, []);

  const handleOAuthRedirectResult = () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('drive_status');
    if (!status) return;

    if (status === 'success') {
      toast({ title: 'Berhasil', description: 'Google Drive berhasil terhubung.' });
    } else if (status === 'error') {
      toast({ variant: 'destructive', title: 'Gagal Menghubungkan', description: params.get('drive_message') || 'Terjadi kesalahan.' });
    }

    params.delete('drive_status');
    params.delete('drive_message');
    params.delete('tab');
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  };

  const fetchAll = async () => {
    setLoading(true);
    const [settingsRes, statusRes] = await Promise.all([
      getGoogleDriveSettings(),
      getGoogleDriveConnectionStatus(),
    ]);

    if (settingsRes.data) {
      setFolderInput(settingsRes.data.folder_id || '');
      setFolderName(settingsRes.data.folder_name || '');
    }
    if (statusRes.data) {
      setConnected(!!statusRes.data.connected);
      setConnectedEmail(statusRes.data.connectedEmail || '');
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    const { data, error } = await startGoogleDriveOAuth();
    if (error || !data?.url) {
      toast({ variant: 'destructive', title: 'Gagal Memulai', description: error?.message || 'Tidak bisa memulai koneksi Google Drive.' });
      setConnecting(false);
      return;
    }
    window.location.href = data.url;
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
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-600" />
          Upload Google Drive Terapis
        </h2>
        <p className="text-slate-500 mt-1">
          Hubungkan akun Google Drive Anda agar terapis dapat mengunggah dokumen (foto, PDF, dll) langsung dari dashboard mereka ke folder Drive Anda.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="text-base">Status Koneksi Google Drive</Label>
            <p className="text-xs text-slate-500">Akun Google yang akan menampung file upload terapis.</p>
          </div>
          {!loading && (
            connected ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Terhubung
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Belum Terhubung
              </span>
            )
          )}
        </div>

        {loading ? (
          <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-4">
            {connected ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-800">
                Terhubung sebagai <strong>{connectedEmail || 'akun Google'}</strong>.
                <Button variant="link" onClick={handleConnect} disabled={connecting} className="text-emerald-700 h-auto p-0 ml-2">
                  Hubungkan ulang / ganti akun
                </Button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-slate-600">
                  Klik tombol di bawah untuk login dengan akun Google Anda dan mengizinkan aplikasi menyimpan file ke Drive Anda.
                </p>
                <Button onClick={handleConnect} disabled={connecting} className="bg-blue-600 hover:bg-blue-700">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Hubungkan Google Drive
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Folder ID atau Link Google Drive</Label>
                <Input
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/xxxxxxxx"
                />
                <p className="text-[11px] text-slate-400">Folder ini harus ada di akun Google yang sama dengan yang Anda hubungkan di atas.</p>
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
                href={folderInput ? `https://drive.google.com/drive/folders/${extractFolderId(folderInput)}` : '#'}
                target="_blank"
                rel="noreferrer"
                className={`text-xs flex items-center gap-1 ${folderInput ? 'text-blue-600 hover:underline' : 'text-slate-300 pointer-events-none'}`}
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
