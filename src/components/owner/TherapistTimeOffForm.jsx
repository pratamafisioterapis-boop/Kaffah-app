import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { addTherapistTimeOff } from '@/lib/api';
import { validateTherapistTimeOff } from '@/lib/validationHelpers';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarX, CheckCircle } from 'lucide-react';

const REASONS = ['Sakit', 'Libur', 'Training', 'Izin Pribadi', 'Lainnya'];

const TherapistTimeOffForm = ({ therapist, onSuccess, onCancel }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: 'Libur',
    notes: '',
    is_partial: false,
    start_time: '08:00',
    end_time: '12:00'
  });

  const handleSubmit = async () => {
    if (!therapist) {
      toast({
        variant: "destructive",
        title: "Terapis Belum Dipilih",
        description: "Silakan pilih terapis terlebih dahulu."
      });
      return;
    }

    // Prepare robust payload
    let formattedStartDate = '';
    let formattedEndDate = '';

    try {
      if (formData.start_date) {
        formattedStartDate = format(new Date(formData.start_date), 'yyyy-MM-dd');
      }
      if (formData.end_date) {
        formattedEndDate = format(new Date(formData.end_date), 'yyyy-MM-dd');
      }
    } catch (e) {
      console.error("Date formatting error:", e);
    }

    const payload = {
      therapist_id: therapist.id,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      start_time: formData.is_partial ? `${formData.start_time}:00` : null,
      end_time: formData.is_partial ? `${formData.end_time}:00` : null,
      reason: formData.notes ? `${formData.reason} - ${formData.notes}` : formData.reason
    };

    console.log("Submitting Time Off Payload:", payload);

    // 1. Centralized Validation
    const validation = validateTherapistTimeOff(payload);
    if (!validation.isValid) {
        toast({ 
            variant: "destructive", 
            title: "Validasi Gagal", 
            description: (
              <ul className="list-disc pl-4 mt-2">
                {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )
        });
        return;
    }

    setLoading(true);

    try {
      // 2. Insert via API
      const { error } = await addTherapistTimeOff(payload);
      
      if (error) {
         throw new Error(error.message || "Gagal menyimpan data ke server.");
      }

      toast({ 
          title: "Berhasil", 
          description: "Data cuti/izin berhasil disimpan.",
          className: "bg-green-50 text-green-800 border-green-200" 
      });
      
      if (onSuccess) onSuccess();
      
      // 3. Reset form
      setFormData({
        start_date: '', 
        end_date: '', 
        reason: 'Libur', 
        notes: '', 
        is_partial: false, 
        start_time: '08:00', 
        end_time: '12:00'
      });

    } catch (error) {
      console.error("Submission Error:", error);
      toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: error?.message || "Terjadi kesalahan saat menyimpan cuti. Cek koneksi Anda."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm h-full">
      <CardHeader className="bg-slate-50 border-b pb-4">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
           <CalendarX className="w-5 h-5 text-orange-500" />
           Input Cuti / Izin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
               <Label>Mulai Tanggal <span className="text-red-500">*</span></Label>
               <Input 
                  type="date" 
                  value={formData.start_date} 
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
               />
            </div>
            <div className="space-y-2">
               <Label>Sampai Tanggal <span className="text-red-500">*</span></Label>
               <Input 
                  type="date" 
                  value={formData.end_date} 
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})} 
               />
            </div>
         </div>

         <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
            <Label htmlFor="partial-mode" className="cursor-pointer">Izin Parsial (Jam Tertentu)</Label>
            <Switch 
               id="partial-mode" 
               checked={formData.is_partial} 
               onCheckedChange={(checked) => setFormData({...formData, is_partial: checked})} 
            />
         </div>

         {formData.is_partial && (
             <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                   <Label className="text-xs">Jam Mulai</Label>
                   <Input type="time" value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs">Jam Selesai</Label>
                   <Input type="time" value={formData.end_time} onChange={(e) => setFormData({...formData, end_time: e.target.value})} />
                </div>
             </div>
         )}

         <div className="space-y-2">
            <Label>Alasan</Label>
            <Select value={formData.reason} onValueChange={(v) => setFormData({...formData, reason: v})}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>
                  {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
               </SelectContent>
            </Select>
         </div>

         <div className="space-y-2">
            <Label>Catatan Tambahan (Opsional)</Label>
            <Textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="Keterangan lebih lanjut..."
                className="resize-none h-20"
            />
         </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t p-4 flex justify-end gap-3">
         {onCancel && <Button variant="ghost" onClick={onCancel} disabled={loading}>Batal</Button>}
         <Button onClick={handleSubmit} disabled={loading || !therapist} className="bg-orange-600 hover:bg-orange-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            {loading ? "Menyimpan..." : "Simpan Cuti"}
         </Button>
      </CardFooter>
    </Card>
  );
};

export default TherapistTimeOffForm;