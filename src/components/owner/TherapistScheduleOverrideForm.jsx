import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { upsertTherapistScheduleOverride } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarClock, CheckCircle } from 'lucide-react';

const TherapistScheduleOverrideForm = ({ therapist, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    override_date: '',
    start_time: '09:00',
    end_time: '',
    note: '',
  });

  const handleSubmit = async () => {
    if (!therapist) return;
    if (!formData.override_date || !formData.start_time) {
      toast({ variant: 'destructive', title: 'Data Belum Lengkap', description: 'Tanggal dan jam masuk wajib diisi.' });
      return;
    }

    setLoading(true);
    const { error } = await upsertTherapistScheduleOverride({
      therapist_id: therapist.id,
      override_date: formData.override_date,
      start_time: `${formData.start_time}:00`,
      end_time: formData.end_time ? `${formData.end_time}:00` : null,
      note: formData.note || null,
    });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message || 'Terjadi kesalahan saat menyimpan.' });
      return;
    }

    toast({ title: 'Berhasil', description: 'Jadwal pengganti berhasil disimpan.', className: 'bg-green-50 text-green-800 border-green-200' });
    setFormData({ override_date: '', start_time: '09:00', end_time: '', note: '' });
    onSuccess?.();
  };

  return (
    <Card className="border-slate-200 shadow-sm h-full">
      <CardHeader className="bg-slate-50 border-b pb-4">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
          <CalendarClock className="w-5 h-5 text-blue-500" />
          Tambah Jadwal Pengganti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <Label>Tanggal <span className="text-red-500">*</span></Label>
          <Input type="date" value={formData.override_date} onChange={(e) => setFormData({ ...formData, override_date: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Jam Masuk <span className="text-red-500">*</span></Label>
            <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Jam Pulang (opsional)</Label>
            <Input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Catatan (opsional)</Label>
          <Textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="mis. tukar shift dengan terapis lain"
            className="resize-none h-20"
          />
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 border-t p-4 flex justify-end">
        <Button onClick={handleSubmit} disabled={loading || !therapist} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          {loading ? 'Menyimpan...' : 'Simpan Jadwal Pengganti'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TherapistScheduleOverrideForm;
