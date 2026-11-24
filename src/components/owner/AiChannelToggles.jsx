import React, { useEffect, useState, useCallback } from 'react';
import { Bot } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';

const CHANNELS = [
  { key: 'ai_watzap_enabled', label: 'Watzap', hint: 'Nomor resmi' },
  { key: 'ai_bablast_enabled', label: 'Bablast', hint: 'Nomor Kimmy' },
];

// Dua saklar AI per jalur. Mati = AI tidak membalas dan tidak mengirim draf ke Telegram.
export default function AiChannelToggles() {
  const { toast } = useToast();
  const [clinicId, setClinicId] = useState(null);
  const [values, setValues] = useState(null); // { ai_watzap_enabled, ai_bablast_enabled, enabled }
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const cid = await getCachedClinicId(s?.session?.user?.id);
      if (!alive || !cid) return;
      setClinicId(cid);
      const { data } = await supabase
        .from('wa_ai_settings')
        .select('enabled, ai_watzap_enabled, ai_bablast_enabled')
        .eq('clinic_id', cid)
        .maybeSingle();
      if (alive && data) setValues(data);
    })();
    return () => { alive = false; };
  }, []);

  const toggle = useCallback(async (key, next) => {
    if (!clinicId || !values) return;
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setSaving(key);
    const { error } = await supabase
      .from('wa_ai_settings')
      .update({ [key]: next, updated_at: new Date().toISOString() })
      .eq('clinic_id', clinicId);
    setSaving(null);
    if (error) {
      setValues((v) => ({ ...v, [key]: prev }));
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    const label = CHANNELS.find((c) => c.key === key)?.label;
    toast({ title: `AI ${label} ${next ? 'aktif' : 'nonaktif'}` });
  }, [clinicId, values, toast]);

  if (!values) return null;

  return (
    <div className="rounded-app-lg border border-app-border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Bot className="h-4 w-4 text-app-accent" aria-hidden="true" />
        AI Agent WhatsApp
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CHANNELS.map(({ key, label, hint }) => {
          const on = values[key] !== false;
          return (
            <label
              key={key}
              htmlFor={`ai-toggle-${key}`}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-app border border-app-border px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{label}</span>
                <span className="block truncate text-xs text-app-muted">{on ? 'Aktif' : 'Nonaktif'} · {hint}</span>
              </span>
              <Switch
                id={`ai-toggle-${key}`}
                checked={on}
                disabled={saving === key}
                onCheckedChange={(v) => toggle(key, v)}
                aria-label={`AI agent ${label}`}
              />
            </label>
          );
        })}
      </div>
      {values.enabled === false && (
        <p className="mt-2 text-xs text-amber-700">
          Saklar utama AI sedang mati di Pengaturan, jadi kedua jalur tidak membalas walaupun toggle ini aktif.
        </p>
      )}
    </div>
  );
}
