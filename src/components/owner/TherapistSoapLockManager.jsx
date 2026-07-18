import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock, Unlock, ShieldAlert, ShieldCheck, ShieldOff, Loader2, Save,
  Settings2, User, AlertTriangle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn, formatTherapistPeriodLabel } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  getSoapLockSettings,
  saveSoapLockSettings,
  getClinicTherapistsSoapLockStatus,
  updateTherapistSoapLockOverride,
  setTherapistManualUnlock,
  getPhysiotherapists
} from '@/lib/api';

const RULE_SOURCE_LABEL = {
  exempt: 'Dikecualikan',
  custom: 'Aturan Khusus',
  clinic: 'Aturan Klinik',
  manual_unlock: 'Dibuka Manual',
  disabled: 'Aturan Nonaktif',
  not_found: '-'
};

const TherapistSoapLockManager = () => {
  const { toast } = useToast();
  const { userDetails } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ enabled: false, threshold_count: 5 });

  const [therapists, setTherapists] = useState([]);
  const [statusByTherapist, setStatusByTherapist] = useState({});

  const [editTherapist, setEditTherapist] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [settingsRes, therapistsRes, statusRes] = await Promise.all([
      getSoapLockSettings(),
      getPhysiotherapists(),
      getClinicTherapistsSoapLockStatus()
    ]);

    if (settingsRes.data) {
      setSettings({
        enabled: !!settingsRes.data.enabled,
        threshold_count: settingsRes.data.threshold_count ?? 5
      });
    }

    if (therapistsRes.data) {
      const sorted = therapistsRes.data
        .filter(t => t.is_active)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTherapists(sorted);
    }

    if (statusRes.data) {
      const map = {};
      statusRes.data.forEach(s => { map[s.therapist_id] = s; });
      setStatusByTherapist(map);
    }

    setLoading(false);
  };

  const handleSaveSettings = async () => {
    if (settings.threshold_count < 1) {
      toast({ variant: 'destructive', title: 'Nilai tidak valid', description: 'Jumlah SOAP harus lebih dari 0.' });
      return;
    }
    setSaving(true);
    const { error } = await saveSoapLockSettings(settings);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
    } else {
      toast({ title: 'Tersimpan', description: 'Aturan kunci SOAP klinik diperbarui.' });
      loadAll();
    }
    setSaving(false);
  };

  const openEdit = (therapist) => {
    setEditTherapist(therapist);
    setEditForm({
      soap_lock_exempt: !!therapist.soap_lock_exempt,
      soap_lock_custom_enabled: !!therapist.soap_lock_custom_enabled,
      soap_lock_threshold_count: therapist.soap_lock_threshold_count ?? settings.threshold_count,
      soap_lock_manual_unlock: !!therapist.soap_lock_manual_unlock,
      soap_lock_manual_unlock_note: therapist.soap_lock_manual_unlock_note || ''
    });
  };

  const closeEdit = () => {
    setEditTherapist(null);
    setEditForm(null);
  };

  const handleSaveOverride = async () => {
    if (!editTherapist || !editForm) return;
    setSavingOverride(true);

    const { error: overrideError } = await updateTherapistSoapLockOverride(editTherapist.id, {
      soap_lock_exempt: editForm.soap_lock_exempt,
      soap_lock_custom_enabled: editForm.soap_lock_custom_enabled,
      soap_lock_threshold_count: editForm.soap_lock_custom_enabled ? (parseInt(editForm.soap_lock_threshold_count) || 5) : null
    });

    const { error: unlockError } = await setTherapistManualUnlock(
      editTherapist.id,
      editForm.soap_lock_manual_unlock,
      { note: editForm.soap_lock_manual_unlock_note, byName: userDetails?.full_name || userDetails?.name }
    );

    if (overrideError || unlockError) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: (overrideError || unlockError).message });
    } else {
      toast({ title: 'Tersimpan', description: `Pengaturan kunci SOAP untuk ${editTherapist.name} diperbarui.` });
      closeEdit();
      loadAll();
    }
    setSavingOverride(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Lock className="w-5 h-5 text-red-500" /> Kunci SOAP Terapis
        </h2>
        <p className="text-sm text-slate-500">
          Kunci otomatis jadwal booking (kalender & manual) untuk terapis yang punya terlalu banyak SOAP belum diisi.
        </p>
      </div>

      {/* GLOBAL SETTINGS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Aturan Klinik (Default)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Berlaku untuk semua terapis aktif, kecuali yang punya aturan khusus atau dikecualikan.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold", settings.enabled ? "text-emerald-600" : "text-slate-400")}>
              {settings.enabled ? 'Aktif' : 'Nonaktif'}
            </span>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
              className="data-[state=checked]:bg-red-500"
            />
          </div>
        </div>

        {!settings.enabled && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Fitur ini nonaktif secara default agar tidak tiba-tiba mengunci jadwal terapis yang sudah punya backlog SOAP. Aktifkan setelah threshold di bawah dirasa sesuai.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600">Kunci jika SOAP kosong mencapai</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={settings.threshold_count}
              onChange={(e) => setSettings(prev => ({ ...prev, threshold_count: parseInt(e.target.value) || 0 }))}
              className="w-24"
              disabled={saving}
            />
            <span className="text-sm text-slate-500">kunjungan, dalam Periode aktif terapis (diatur di kartu terapis masing-masing, tab Data Terapis)</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Simpan Aturan Klinik
          </Button>
        </div>
      </div>

      {/* PER THERAPIST STATUS */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 px-1">Status Per Terapis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {therapists.map((t) => {
            const status = statusByTherapist[t.id];
            const locked = !!status?.locked;
            const source = status?.rule_source;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl border p-4 flex flex-col gap-3 shadow-sm",
                  locked ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs",
                      locked ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {(t.name || 'T').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-500">{RULE_SOURCE_LABEL[source] || '-'}</p>
                    </div>
                  </div>

                  {locked ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-red-600 text-white shrink-0">
                      <Lock className="w-3 h-3" /> Terkunci
                    </span>
                  ) : source === 'exempt' ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-200 text-slate-600 shrink-0">
                      <ShieldOff className="w-3 h-3" /> Dikecualikan
                    </span>
                  ) : source === 'manual_unlock' ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      <Unlock className="w-3 h-3" /> Dibuka Manual
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      <ShieldCheck className="w-3 h-3" /> Aman
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <ShieldAlert className={cn("w-3.5 h-3.5", locked ? "text-red-500" : "text-slate-400")} />
                  <span>
                    <strong className={locked ? "text-red-600" : "text-slate-700"}>{status?.unfilled_count ?? 0}</strong> SOAP kosong
                    {status?.threshold_count ? ` / ambang ${status.threshold_count}` : ''}
                    {status?.period_start && status?.period_end
                      ? ` (periode ${format(new Date(status.period_start), 'dd MMM')} - ${format(new Date(status.period_end), 'dd MMM')})`
                      : ` (${formatTherapistPeriodLabel(t)})`}
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-slate-600 border-slate-200 hover:bg-slate-50"
                  onClick={() => openEdit(t)}
                >
                  <Settings2 className="w-3.5 h-3.5 mr-2" /> Atur Terapis Ini
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* PER-THERAPIST EDIT DIALOG */}
      <Dialog open={!!editTherapist} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4" /> Aturan Kunci SOAP: {editTherapist?.name}
            </DialogTitle>
            <DialogDescription>
              Atur pengecualian, aturan khusus, atau buka kunci sementara untuk terapis ini.
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">Kecualikan dari kunci</p>
                  <p className="text-[11px] text-slate-500">Terapis ini tidak akan pernah terkunci otomatis.</p>
                </div>
                <Switch
                  checked={editForm.soap_lock_exempt}
                  onCheckedChange={(c) => setEditForm(prev => ({ ...prev, soap_lock_exempt: c }))}
                />
              </div>

              <div className={cn("p-3 rounded-lg border space-y-3", editForm.soap_lock_exempt ? "bg-slate-50 opacity-50 pointer-events-none" : "bg-white")}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Gunakan aturan khusus</p>
                    <p className="text-[11px] text-slate-500">Threshold &amp; periode berbeda dari aturan klinik.</p>
                  </div>
                  <Switch
                    checked={editForm.soap_lock_custom_enabled}
                    onCheckedChange={(c) => setEditForm(prev => ({ ...prev, soap_lock_custom_enabled: c }))}
                  />
                </div>

                {editForm.soap_lock_custom_enabled && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-slate-500">SOAP kosong (dihitung dalam Periode aktif terapis ini)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editForm.soap_lock_threshold_count}
                      onChange={(e) => setEditForm(prev => ({ ...prev, soap_lock_threshold_count: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-900">Buka kunci manual (darurat)</p>
                    <p className="text-[11px] text-amber-700">Tetap bisa booking meski masih di atas ambang. Nonaktifkan lagi kapan saja.</p>
                  </div>
                  <Switch
                    checked={editForm.soap_lock_manual_unlock}
                    onCheckedChange={(c) => setEditForm(prev => ({ ...prev, soap_lock_manual_unlock: c }))}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
                {editForm.soap_lock_manual_unlock && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-700">Catatan (opsional)</Label>
                    <Textarea
                      value={editForm.soap_lock_manual_unlock_note}
                      onChange={(e) => setEditForm(prev => ({ ...prev, soap_lock_manual_unlock_note: e.target.value }))}
                      placeholder="Contoh: backlog lama, sudah dikonfirmasi terapis akan menyusul."
                      rows={2}
                      className="bg-white text-sm"
                    />
                    {editTherapist?.soap_lock_manual_unlock_by_name && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 pt-1">
                        <AlertTriangle className="w-3 h-3" /> Terakhir dibuka oleh {editTherapist.soap_lock_manual_unlock_by_name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Batal</Button>
            <Button onClick={handleSaveOverride} disabled={savingOverride} className="bg-slate-900 hover:bg-slate-800">
              {savingOverride && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistSoapLockManager;
