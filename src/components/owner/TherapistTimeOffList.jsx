import React, { useState, useEffect } from 'react';
import { 
  getTherapistTimeOff, getTherapistExtraShifts, getWeeklyOffWaivers,
  deleteTherapistTimeOff,
  updateTherapistTimeOff
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, CalendarDays, Clock, Pencil, Loader2, CalendarCheck } from 'lucide-react';
import { WAIVER_REASON_LABEL } from '@/lib/leaveRequestUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const REASONS = ['Cuti', 'Sakit', 'Libur', 'Training', 'Izin Pribadi', 'Event', 'Lainnya'];

const REASON_TO_LEAVE_TYPE = {
  'Cuti': 'annual',
  'Sakit': 'sick',
  'Libur': 'weekly_off',
  'Training': 'training',
  'Izin Pribadi': 'personal',
  'Event': 'other',
  'Lainnya': 'other'
};

// reason disimpan sebagai "Jenis - catatan"
const parseReason = (reason) => {
  const raw = reason || '';
  const idx = raw.indexOf(' - ');
  if (idx === -1) return { label: raw.trim(), note: '' };
  return { label: raw.slice(0, idx).trim(), note: raw.slice(idx + 3).trim() };
};

const TherapistTimeOffList = ({ therapist, refreshTrigger }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [timeOffs, setTimeOffs] = useState([]);
  const [extraShifts, setExtraShifts] = useState([]);
  const [waivers, setWaivers] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ reason: 'Libur', notes: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (therapist) {
      loadData();
    }
  }, [therapist, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    const [{ data }, extraRes, waiverRes] = await Promise.all([
      getTherapistTimeOff(therapist.id), getTherapistExtraShifts(therapist.id), getWeeklyOffWaivers(therapist.id),
    ]);
    if (data) setTimeOffs(data);
    setExtraShifts(extraRes.data || []);
    setWaivers(waiverRes.data || []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteTherapistTimeOff(deleteId);
    if (!error) {
       toast({ title: "Data Cuti Dihapus" });
       loadData();
    } else {
       toast({ variant: "destructive", title: "Gagal Menghapus" });
    }
    setDeleteId(null);
  };

  const openEdit = (item) => {
    const { label, note } = parseReason(item.reason);
    setEditForm({ reason: REASONS.includes(label) ? label : 'Lainnya', notes: note });
    setEditItem(item);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSavingEdit(true);
    const { error } = await updateTherapistTimeOff(editItem.id, {
      reason: editForm.notes.trim() ? `${editForm.reason} - ${editForm.notes.trim()}` : editForm.reason,
      leave_type: REASON_TO_LEAVE_TYPE[editForm.reason] || 'other'
    });
    setSavingEdit(false);
    if (!error) {
      toast({ title: "Data Cuti Diperbarui" });
      setEditItem(null);
      loadData();
    } else {
      toast({ variant: "destructive", title: "Gagal Memperbarui", description: error.message });
    }
  };

  if (!therapist) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
         Riwayat Cuti: {therapist.name}
         <Badge variant="outline">{timeOffs.length}</Badge>
      </h3>
      
      {waivers.length > 0 && (
         <div className="space-y-2">
            {waivers.map(w => (
               <div key={w.id} className="flex items-start gap-3 rounded-app-sm border border-rose-200 bg-rose-50 px-4 py-3">
                  <CalendarCheck className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-rose-900">
                     <span className="font-semibold">{format(new Date(`${w.off_date}T00:00:00`), 'EEEE, dd MMM yyyy', { locale: id })}</span>
                     {' '}— jatah libur mingguan dibatalkan, terapis tetap masuk.
                     <span className="block text-xs text-rose-700 mt-0.5">
                        {WAIVER_REASON_LABEL[w.reason] || w.reason} ({format(new Date(`${w.sunday_date}T00:00:00`), 'dd MMM yyyy', { locale: id })}). Jatah libur dikembalikan otomatis bila izin / libur nasional itu dihapus.
                     </span>
                  </div>
               </div>
            ))}
         </div>
      )}

      {loading ? (
         <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-app-sm animate-pulse" />)}
         </div>
      ) : timeOffs.length === 0 ? (
         <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-app-sm text-slate-500">
            Tidak ada data cuti.
         </div>
      ) : (
         <div className="space-y-3">
            {timeOffs.map(item => {
               const startDate = new Date(item.start_date);
               const endDate = new Date(item.end_date);
               const isPartial = !!item.start_time;
               // Libur mingguan yang diganti kerja lewat jadwal pengganti izin.
               const replacedBy = item.leave_type === 'weekly_off' && !isPartial
                  ? extraShifts.filter(e => e.shift_date >= item.start_date && e.shift_date <= item.end_date)
                  : [];

               return (
                  <Card key={item.id} className="group hover:border-orange-200 transition-colors">
                     <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-start gap-4">
                           <div className="bg-orange-50 text-orange-600 p-2 rounded-app-sm">
                              <CalendarDays className="w-5 h-5" />
                           </div>
                           <div>
                              <div className="font-medium text-slate-800">
                                 {format(startDate, 'dd MMM yyyy', { locale: id })} 
                                 {item.start_date !== item.end_date && ` - ${format(endDate, 'dd MMM yyyy', { locale: id })}`}
                              </div>
                              <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                                 <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                    {parseReason(item.reason).label}
                                 </Badge>
                                 {replacedBy.length > 0 && (
                                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                                       Diganti kerja {replacedBy.map(e => `${e.start_time.slice(0,5)}-${e.end_time.slice(0,5)}`).join(', ')} (jadwal pengganti izin)
                                    </Badge>
                                 )}
                                 {isPartial && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1 border-orange-200 text-orange-700 bg-orange-50">
                                       <Clock className="w-3 h-3" /> 
                                       {item.start_time.slice(0,5)} - {item.end_time.slice(0,5)}
                                    </Badge>
                                 )}
                              </div>
                              {parseReason(item.reason).note && (
                                 <p className="text-xs text-slate-500 mt-1 italic">
                                    "{parseReason(item.reason).note}"
                                 </p>
                              )}
                           </div>
                        </div>
                        
                        <div className="flex items-center">
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           className="text-slate-300 hover:text-app-accent-bright hover:bg-app-soft"
                           onClick={() => openEdit(item)}
                        >
                           <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           className="text-slate-300 hover:text-red-500 hover:bg-red-50"
                           onClick={() => setDeleteId(item.id)}
                        >
                           <Trash2 className="w-4 h-4" />
                        </Button>
                        </div>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
           <DialogHeader>
              <DialogTitle>Edit Cuti / Izin</DialogTitle>
              <DialogDescription>Ubah jenis izin dan catatan.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-sm font-medium">Jenis Izin</label>
                 <Select value={editForm.reason} onValueChange={(v) => setEditForm({ ...editForm, reason: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                       {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <label className="text-sm font-medium">Catatan (Opsional)</label>
                 <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Keterangan lebih lanjut..."
                    className="resize-none h-20"
                 />
              </div>
           </div>
           <DialogFooter>
              <Button variant="ghost" onClick={() => setEditItem(null)} disabled={savingEdit}>Batal</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                 {savingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                 Simpan
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
           <DialogHeader>
              <DialogTitle>Hapus Data Cuti?</DialogTitle>
              <DialogDescription>Data yang dihapus tidak dapat dikembalikan.</DialogDescription>
           </DialogHeader>
           <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Batal</Button>
              <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistTimeOffList;