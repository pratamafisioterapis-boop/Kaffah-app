import React, { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AVAILABLE_VARIABLES } from '@/lib/whatsappRenderEngine';

const TemplateEditModal = ({ isOpen, onClose, template, onSave, saving }) => {
  const [formData, setFormData] = useState({
    template_content: '',
    is_active: true,
    send_rule: { delay_days: 0, send_at_hour: 9, send_at_minute: 0 }
  });

  useEffect(() => {
    if (template) {
      setFormData({
        template_content: template.template_content || '',
        is_active: template.is_active,
        send_rule: template.send_rule || { delay_days: 0, send_at_hour: 9, send_at_minute: 0 }
      });
    }
  }, [template]);

  const handleSave = () => {
    onSave(template.id, formData);
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Template: {template.template_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
           {/* Active Toggle */}
           <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
              <div className="flex flex-col">
                 <span className="font-medium text-sm">Status Template</span>
                 <span className="text-xs text-slate-500">Aktifkan untuk mengirim otomatis</span>
              </div>
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
           </div>

           {/* Content */}
           <div className="space-y-2">
              <Label>Isi Pesan WhatsApp</Label>
              <Textarea 
                 value={formData.template_content}
                 onChange={(e) => setFormData({...formData, template_content: e.target.value})}
                 className="min-h-[150px] font-mono text-sm"
                 placeholder="Ketik pesan..."
              />
              <div className="bg-blue-50 p-2 rounded text-xs text-blue-700 flex gap-2 flex-wrap">
                 <span className="font-bold">Available Variables:</span>
                 {AVAILABLE_VARIABLES.map(v => (
                    <span key={v} className="bg-white px-1 rounded border border-blue-200 cursor-pointer hover:bg-blue-100" 
                          onClick={() => setFormData(prev => ({...prev, template_content: prev.template_content + ' ' + v}))}>
                       {v}
                    </span>
                 ))}
              </div>
           </div>

           {/* Rules */}
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label>Delay (Hari)</Label>
                 <Input 
                    type="number" 
                    min="0"
                    value={formData.send_rule.delay_days}
                    onChange={(e) => setFormData({
                        ...formData, 
                        send_rule: {...formData.send_rule, delay_days: parseInt(e.target.value)}
                    })}
                 />
                 <p className="text-[10px] text-slate-500">0 = Kirim hari H</p>
              </div>
              <div className="space-y-2">
                 <Label>Waktu Kirim (Jam)</Label>
                 <div className="flex items-center gap-2">
                    <Input 
                        type="number" 
                        min="0" max="23"
                        value={formData.send_rule.send_at_hour}
                        onChange={(e) => setFormData({
                            ...formData, 
                            send_rule: {...formData.send_rule, send_at_hour: parseInt(e.target.value)}
                        })}
                    />
                    <span>:</span>
                    <Input 
                        type="number" 
                        min="0" max="59"
                        value={formData.send_rule.send_at_minute}
                        onChange={(e) => setFormData({
                            ...formData, 
                            send_rule: {...formData.send_rule, send_at_minute: parseInt(e.target.value)}
                        })}
                    />
                 </div>
              </div>
           </div>
        </div>

        <DialogFooter>
           <Button variant="outline" onClick={onClose}>Batal</Button>
           <Button onClick={handleSave} disabled={saving} className="bg-[#1e3a8a]">
              {saving ? 'Menyimpan...' : <><Save className="w-4 h-4 mr-2" /> Simpan Perubahan</>}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateEditModal;