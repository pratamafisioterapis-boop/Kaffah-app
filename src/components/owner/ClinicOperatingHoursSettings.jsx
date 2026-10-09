import React, { useEffect, useState } from 'react';
import { Clock, Info, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { defaultOperatingHours, OPERATING_DAY_NAMES, OPERATING_DAY_ORDER, timeToMinutes } from '@/lib/leaveRequestUtils';

// Jam buka klinik per hari. Dipakai form izin terapis: jam izin sebagian dan jam pengganti
// harus di dalam jam buka hari itu, dan hari yang ditandai tutup tidak bisa jadi hari pengganti.
const ClinicOperatingHoursSettings = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const clinicId = userDetails?.clinic_id;

  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return undefined;
    let active = true;
    supabase.from('clinics').select('operating_hours').eq('id', clinicId).single().then(({ data }) => {
      if (!active) return;
      setHours({ ...defaultOperatingHours(clinicId), ...(data?.operating_hours || {}) });
      setLoading(false);
    });
    return () => { active = false; };
  }, [clinicId]);

  const update = (day, patch) => setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));

  const invalidDay = hours && OPERATING_DAY_ORDER.find((d) => hours[d].enabled && timeToMinutes(hours[d].end) <= timeToMinutes(hours[d].start));

  const handleSave = async () => {
    if (invalidDay !== undefined) return;
    setSaving(true);
    const { error } = await supabase.from('clinics').update({ operating_hours: hours }).eq('id', clinicId);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan jam buka', description: error.message });
      return;
    }
    toast({ title: 'Jam buka klinik disimpan', className: 'bg-green-50 text-green-800 border-green-200' });
  };

  if (loading || !hours) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-app-accent" /></div>;
  }

  return (
    <div className="bg-white p-6 rounded-app border border-slate-200 space-y-4 max-w-xl">
      <div>
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4" /> Jam Buka Klinik</h3>
        <p className="text-xs text-slate-500 mt-1">
          Atur jam buka dan tutup untuk tiap hari. Dipakai pada pengajuan izin terapis: jam izin dan jam pengganti harus di dalam jam buka hari itu, dan hari yang ditandai tutup tidak bisa dipilih sebagai hari pengganti.
        </p>
      </div>

      <div className="space-y-2">
        {OPERATING_DAY_ORDER.map((d) => {
          const day = hours[d];
          const bad = day.enabled && timeToMinutes(day.end) <= timeToMinutes(day.start);
          return (
            <div key={d} className={`flex items-center gap-3 rounded-app-sm border p-2.5 ${bad ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}>
              <Switch checked={day.enabled} onCheckedChange={(v) => update(d, { enabled: v })} aria-label={`Buka hari ${OPERATING_DAY_NAMES[d]}`} />
              <span className="w-16 text-sm font-medium text-slate-800">{OPERATING_DAY_NAMES[d]}</span>
              {day.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input type="time" aria-label={`Jam buka ${OPERATING_DAY_NAMES[d]}`} value={day.start} onChange={(e) => update(d, { start: e.target.value })} className="h-9" />
                  <span className="text-slate-400">–</span>
                  <Input type="time" aria-label={`Jam tutup ${OPERATING_DAY_NAMES[d]}`} value={day.end} onChange={(e) => update(d, { end: e.target.value })} className="h-9" />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Tutup</span>
              )}
            </div>
          );
        })}
      </div>

      {invalidDay !== undefined && (
        <p className="text-xs text-red-600 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Jam tutup {OPERATING_DAY_NAMES[invalidDay]} harus setelah jam buka.
        </p>
      )}

      <Button onClick={handleSave} disabled={saving || invalidDay !== undefined} className="bg-app-accent hover:bg-app-accent-hover">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Simpan Jam Buka
      </Button>
    </div>
  );
};

export default ClinicOperatingHoursSettings;
