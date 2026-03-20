import React, { useState, useEffect } from 'react';
import { 
  getTherapistTimeOff, 
  deleteTherapistTimeOff 
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, CalendarDays, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const TherapistTimeOffList = ({ therapist, refreshTrigger }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [timeOffs, setTimeOffs] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (therapist) {
      loadData();
    }
  }, [therapist, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await getTherapistTimeOff(therapist.id);
    if (data) setTimeOffs(data);
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

  if (!therapist) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
         Riwayat Cuti: {therapist.name}
         <Badge variant="outline">{timeOffs.length}</Badge>
      </h3>
      
      {loading ? (
         <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
         </div>
      ) : timeOffs.length === 0 ? (
         <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-lg text-slate-500">
            Tidak ada data cuti.
         </div>
      ) : (
         <div className="space-y-3">
            {timeOffs.map(item => {
               const startDate = new Date(item.start_date);
               const endDate = new Date(item.end_date);
               const isPartial = !!item.start_time;

               return (
                  <Card key={item.id} className="group hover:border-orange-200 transition-colors">
                     <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-start gap-4">
                           <div className="bg-orange-50 text-orange-600 p-2 rounded-lg">
                              <CalendarDays className="w-5 h-5" />
                           </div>
                           <div>
                              <div className="font-medium text-slate-800">
                                 {format(startDate, 'dd MMM yyyy', { locale: id })} 
                                 {item.start_date !== item.end_date && ` - ${format(endDate, 'dd MMM yyyy', { locale: id })}`}
                              </div>
                              <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                                 <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                    {item.reason?.split('-')[0].trim()}
                                 </Badge>
                                 {isPartial && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1 border-orange-200 text-orange-700 bg-orange-50">
                                       <Clock className="w-3 h-3" /> 
                                       {item.start_time.slice(0,5)} - {item.end_time.slice(0,5)}
                                    </Badge>
                                 )}
                              </div>
                              {item.reason?.includes('-') && (
                                 <p className="text-xs text-slate-400 mt-1 italic">
                                    "{item.reason.split('-')[1].trim()}"
                                 </p>
                              )}
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
               );
            })}
         </div>
      )}

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