import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Save, FileSpreadsheet, ShieldCheck, ShieldAlert, ExternalLink, RefreshCw, PlusCircle,
} from 'lucide-react';
import {
  getGoogleDriveConnectionStatus,
  getGoogleSheetsSettings,
  updateGoogleSheetsSettings,
  createGoogleSheetsBackup,
  syncGoogleSheetsNow,
  GOOGLE_SHEETS_DOMAINS,
} from '@/lib/api';

const DEFAULT_ENABLED = GOOGLE_SHEETS_DOMAINS.map((d) => d.key);

const formatDateTime = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch (_e) {
    return iso;
  }
};

const GoogleSheetsSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [driveConnected, setDriveConnected] = useState(false);
  const [settings, setSettings] = useState(null);
  const [enabledSheets, setEnabledSheets] = useState(DEFAULT_ENABLED);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [driveStatusRes, sheetsRes] = await Promise.all([
      getGoogleDriveConnectionStatus(),
      getGoogleSheetsSettings(),
    ]);

    setDriveConnected(!!driveStatusRes.data?.connected);

    if (sheetsRes.data) {
      setSettings(sheetsRes.data);
      setEnabledSheets(sheetsRes.data.enabled_sheets || DEFAULT_ENABLED);
      setAutoSyncEnabled(sheetsRes.data.auto_sync_enabled !== false);
    } else {
      setSettings(null);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    const { data, error } = await createGoogleSheetsBackup();
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Membuat Spreadsheet', description: error.message });
    } else {
      toast({
        title: 'Berhasil',
        description: data?.alreadyExists
          ? 'Spreadsheet backup sudah ada sebelumnya.'
          : 'Spreadsheet backup berhasil dibuat & data awal sudah disinkronkan.',
      });
      await fetchAll();
    }
    setCreating(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    const { error } = await syncGoogleSheetsNow();
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Sinkronisasi', description: error.message });
    } else {
      toast({ title: 'Berhasil', description: 'Data terbaru sudah disinkronkan ke Google Sheets.' });
    }
    await fetchAll();
    setSyncing(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const { error } = await updateGoogleSheetsSettings({ enabledSheets, autoSyncEnabled });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } else {
      toast({ title: 'Tersimpan', description: 'Pengaturan backup Google Sheets berhasil disimpan.' });
      await fetchAll();
    }
    setSaving(false);
  };

  const toggleDomain = (key) => {
    setEnabledSheets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const hasSpreadsheet = !!settings?.spreadsheet_id;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          Backup Data ke Google Sheets
        </h2>
        <p className="text-slate-500 mt-1">
          Simpan salinan data penting klinik ini (pasien, appointment, keuangan, rekam medis, dll) ke 1 Google Spreadsheet
          dengan kolom yang rapi dan relevan &mdash; bukan data mentah. Berguna sebagai cadangan apabila terjadi masalah pada aplikasi.
        </p>
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-lg border border-slate-200 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {!driveConnected && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Hubungkan akun Google Drive Anda terlebih dahulu di tab <strong>Google Drive</strong> sebelum membuat
                spreadsheet backup (memakai koneksi akun Google yang sama).
              </span>
            </div>
          )}

          <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Status Spreadsheet Backup</Label>
                <p className="text-xs text-slate-500">Satu spreadsheet per klinik, berisi beberapa tab data.</p>
              </div>
              {hasSpreadsheet ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Sudah Dibuat
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> Belum Dibuat
                </span>
              )}
            </div>

            {!hasSpreadsheet ? (
              <Button onClick={handleCreate} disabled={creating || !driveConnected} className="bg-emerald-600 hover:bg-emerald-700">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                Buat Spreadsheet Backup
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={settings.spreadsheet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Buka Spreadsheet <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sinkronkan Sekarang
                  </Button>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {settings.last_synced_at && (
                    <p>Terakhir disinkronkan: <strong>{formatDateTime(settings.last_synced_at)}</strong></p>
                  )}
                  {settings.last_sync_status === 'error' && settings.last_sync_error && (
                    <p className="text-red-600">Sinkronisasi terakhir gagal: {settings.last_sync_error}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {hasSpreadsheet && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
              <div>
                <Label className="text-base">Data yang Disinkronkan</Label>
                <p className="text-xs text-slate-500">Pilih data mana saja yang ingin dimasukkan ke spreadsheet.</p>
              </div>

              <div className="space-y-2">
                {GOOGLE_SHEETS_DOMAINS.map((domain) => (
                  <label
                    key={domain.key}
                    className="flex items-start gap-3 p-2.5 rounded-md border border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={enabledSheets.includes(domain.key)}
                      onCheckedChange={() => toggleDomain(domain.key)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{domain.label}</p>
                      <p className="text-xs text-slate-400">{domain.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <Label className="text-sm">Sinkronisasi Otomatis Harian</Label>
                  <p className="text-xs text-slate-500">Sistem akan menyinkronkan data setiap malam secara otomatis.</p>
                </div>
                <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Simpan Pengaturan
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GoogleSheetsSettings;
