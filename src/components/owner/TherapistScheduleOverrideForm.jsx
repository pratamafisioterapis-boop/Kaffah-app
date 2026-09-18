import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { upsertTherapistScheduleOverride } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarClock, CheckCircle } from 'lucide-react';

const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const GAP_OPTIONS = [0, 5, 10, 15, 30];

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const countSlots = (startTime, endTime, durationMinutes, gapMinutes) => {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return 0;
  let count = 0;
  let cursor = start;
  while (cursor + durationMinutes <= end) {
    count += 1;
    cursor += durationMinutes + gapMinutes;
  }
  return count;
};

const TherapistScheduleOverrideForm = ({ therapist, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    override_date: '',
    start_time: '09:00',
    end_time: '',
    capacity: 1,
    slot_duration_minutes: 60,
    gap_minutes: 0,
    note: '',
  });

  const slotPreviewCount = countSlots(formData.start_time, formData.end_time, formData.slot_duration_minutes, formData.gap_minutes);

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
      capacity: formData.capacity,
      slot_duration_minutes: formData.slot_duration_minutes,
      gap_minutes: formData.gap_minutes,
      note: formData.note || null,
    });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message || 'Terjadi kesalahan saat menyimpan.' });
      return;
    }

    toast({ title: 'Berhasil', description: 'Jadwal pengganti berhasil disimpan.', className: 'bg-green-50 text-green-800 border-green-200' });
    setFormData({ override_date: '', start_time: '09:00', end_time: '', capacity: 1, slot_duration_minutes: 60, gap_minutes: 0, note: '' });
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Durasi per Slot</Label>
            <Select value={String(formData.slot_duration_minutes)} onValueChange={(v) => setFormData({ ...formData, slot_duration_minutes: Number(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} menit</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Jeda Antar Slot</Label>
            <Select value={String(formData.gap_minutes)} onValueChange={(v) => setFormData({ ...formData, gap_minutes: Number(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAP_OPTIONS.map((g) => (
                  <SelectItem key={g} value={String(g)}>{g === 0 ? 'Tanpa jeda' : `${g} menit`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Kapasitas per Slot</Label>
          <Select value={String(formData.capacity)} onValueChange={(v) => setFormData({ ...formData, capacity: Number(v) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAPACITY_OPTIONS.map((c) => (
                <SelectItem key={c} value={String(c)}>{c} pasien</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400">
            Hanya dipakai bila jam pulang diisi — jam masuk s/d jam pulang akan dipecah jadi slot-slot booking per durasi di atas
            {formData.end_time ? ` (perkiraan ${slotPreviewCount} slot × ${formData.capacity} pasien)` : ''}, bukan jadwal mingguan.
          </p>
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
