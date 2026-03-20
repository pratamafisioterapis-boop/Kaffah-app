import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const WhatsAppScheduleConfig = ({ category, onSave }) => {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    is_enabled: false,
    timing_type: 'immediate',
    timing_value: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [category]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wa_schedule_config')
      .select('*')
      .eq('category', category)
      .maybeSingle();
    
    if (data) {
        setConfig(data);
    } else {
        // Defaults based on category
        const defaults = {
            category,
            is_enabled: false,
            timing_type: category === 'booking_appointment' ? 'immediate' : 
                         category === 'follow_up' ? 'custom_days' :
                         category === 'package_expiry' ? 'multiple' : 'custom_time',
            timing_value: category === 'package_expiry' ? { days_before: [3] } : 
                          category === 'follow_up' ? { days: 3 } : 
                          category === 'booking_appointment' ? {} : { time: "09:00" }
        };
        setConfig(defaults);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
        category,
        is_enabled: config.is_enabled,
        timing_type: config.timing_type,
        timing_value: config.timing_value
    };

    // Check if exists
    const { data: existing } = await supabase.from('wa_schedule_config').select('id').eq('category', category).maybeSingle();
    
    let result;
    if (existing) {
        result = await supabase.from('wa_schedule_config').update(payload).eq('id', existing.id);
    } else {
        result = await supabase.from('wa_schedule_config').insert([payload]);
    }

    if (result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error.message });
    } else {
        toast({ title: "Tersimpan", description: "Konfigurasi jadwal berhasil disimpan." });
        if (onSave) onSave();
    }
    setSaving(false);
  };

  if (loading) return <div className="py-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
       <div className="flex items-center justify-between">
          <Label className="text-base font-semibold text-slate-800">Pengaturan Jadwal Pengiriman</Label>
          <div className="flex items-center gap-2">
             <span className="text-sm text-slate-600">{config.is_enabled ? 'Aktif' : 'Non-aktif'}</span>
             <Switch checked={config.is_enabled} onCheckedChange={(c) => setConfig({...config, is_enabled: c})} />
          </div>
       </div>

       <div className="pt-2 border-t border-slate-200">
           {category === 'booking_appointment' && (
               <p className="text-sm text-slate-500 italic">Pesan akan dikirim segera setelah booking dibuat.</p>
           )}

           {category === 'follow_up' && (
               <div className="flex items-center gap-3">
                   <Label>Kirim setelah</Label>
                   <Input 
                      type="number" 
                      className="w-20" 
                      min="1" max="30"
                      value={config.timing_value?.days || 3}
                      onChange={(e) => setConfig({...config, timing_value: { days: parseInt(e.target.value) }})}
                   />
                   <Label>hari sejak kunjungan terakhir.</Label>
               </div>
           )}

           {category === 'package_expiry' && (
               <div className="space-y-3">
                   <Label>Kirim peringatan pada:</Label>
                   <div className="flex flex-wrap gap-4">
                       {[7, 3, 1].map(day => (
                           <div key={day} className="flex items-center space-x-2">
                               <Checkbox 
                                  id={`h-${day}`} 
                                  checked={(config.timing_value?.days_before || []).includes(day)}
                                  onCheckedChange={(checked) => {
                                      const current = config.timing_value?.days_before || [];
                                      const updated = checked 
                                        ? [...current, day] 
                                        : current.filter(d => d !== day);
                                      setConfig({...config, timing_value: { days_before: updated }});
                                  }}
                               />
                               <label htmlFor={`h-${day}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                   H-{day} Expiry
                               </label>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {(category === 'therapy_reminder' || category === 'birthday') && (
               <div className="flex items-center gap-3">
                   <Label>Waktu Pengiriman (WIB)</Label>
                   <Input 
                      type="time" 
                      className="w-32"
                      value={config.timing_value?.time || "09:00"}
                      onChange={(e) => setConfig({...config, timing_value: { time: e.target.value }})}
                   />
               </div>
           )}
       </div>

       <div className="pt-2">
           <Button onClick={handleSave} disabled={saving} size="sm" className="bg-blue-600 hover:bg-blue-700">
               {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
               Simpan Jadwal
           </Button>
       </div>
    </div>
  );
};

export default WhatsAppScheduleConfig;