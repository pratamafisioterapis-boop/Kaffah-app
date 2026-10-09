import React, { useCallback, useEffect, useState } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CalendarHeart, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getNationalHolidays, addNationalHoliday, deleteNationalHoliday } from '@/lib/api';

// Hari libur nasional klinik. Yang jatuh di hari Minggu membuat terapis tidak mendapat
// jatah libur mingguan di hari Senin setelahnya (diterapkan otomatis oleh database).
const NationalHolidayManager = () => {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const load = useCallback(async () => {
    const { data } = await getNationalHolidays();
    setHolidays(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.date || !form.name.trim()) {
      toast({ variant: 'destructive', title: 'Lengkapi data', description: 'Tanggal dan nama hari libur wajib diisi.' });
      return;
    }
    setSaving(true);
    const { error } = await addNationalHoliday({ holidayDate: form.date, name: form.name });
    setSaving(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal menyimpan',
        description: error.code === '23505' ? 'Tanggal itu sudah terdaftar sebagai hari libur.' : error.message,
      });
      return;
    }
    toast({ title: 'Hari libur nasional ditambahkan' });
    setForm({ date: '', name: '' });
    load();
  };

  const handleDelete = async (item) => {
    const { error } = await deleteNationalHoliday(item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    toast({ title: 'Hari libur dihapus' });
    load();
  };

  const isSunday = (d) => getDay(parseISO(d)) === 0;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
          <CalendarHeart className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Hari Libur Nasional</h3>
          <p className="text-xs text-slate-500">
            Hari libur nasional yang jatuh di hari <b>Minggu</b> membuat terapis tidak mendapat jatah libur mingguan di hari <b>Senin</b> setelahnya (otomatis tetap masuk).
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Tanggal</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nama hari libur</Label>
          <Input value={form.name} placeholder="Contoh: Hari Raya Waisak" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <Button onClick={handleAdd} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah
        </Button>
      </div>

      {loading ? (
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ) : holidays.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada hari libur nasional yang dicatat.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{h.name}</p>
                <p className="text-xs text-slate-500">{format(parseISO(h.holiday_date), 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSunday(h.holiday_date) && (
                  <Badge variant="outline" className="text-[11px] border-rose-200 text-rose-700 bg-rose-50">Minggu · Senin tanpa jatah libur</Badge>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(h)} aria-label={`Hapus ${h.name}`}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NationalHolidayManager;
