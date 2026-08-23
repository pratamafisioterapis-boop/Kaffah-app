import React, { useState, useEffect } from 'react';
import { getTherapistScheduleOverrides, deleteTherapistScheduleOverride } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const TherapistScheduleOverrideList = ({ therapist, refreshTrigger }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (therapist) loadData();
  }, [therapist, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await getTherapistScheduleOverrides(therapist.id);
    if (data) setOverrides(data);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteTherapistScheduleOverride(deleteId);
    if (!error) {
      toast({ title: 'Jadwal Pengganti Dihapus' });
      loadData();
    } else {
      toast({ variant: 'destructive', title: 'Gagal Menghapus' });
    }
    setDeleteId(null);
  };

  if (!therapist) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        Riwayat Jadwal Pengganti: {therapist.name}
        <Badge variant="outline">{overrides.length}</Badge>
      </h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : overrides.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-lg text-slate-500">
          Belum ada jadwal pengganti untuk terapis ini.
        </div>
      ) : (
        <div className="space-y-3">
          {overrides.map((item) => (
            <Card key={item.id} className="group hover:border-blue-200 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {format(new Date(`${item.override_date}T00:00:00`), 'EEEE, dd MMM yyyy', { locale: id })}
                    </div>
                    <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                      <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                        {item.start_time?.slice(0, 5)}{item.end_time ? ` - ${item.end_time.slice(0, 5)}` : ''}
                      </Badge>
                    </div>
                    {item.note && <p className="text-xs text-slate-400 mt-1 italic">"{item.note}"</p>}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-300 hover:text-red-500 hover:bg-red-50"
                  onClick={() => setDeleteId(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Jadwal Pengganti?</DialogTitle>
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

export default TherapistScheduleOverrideList;
