import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Inbox, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { getSundaySwapRequests, reviewSundaySwapRequest } from '@/lib/api';
import SundaySwapCard from '@/components/shared/SundaySwapCard';

// Owner: setujui / tolak tukar jadwal Minggu yang sudah di-acc terapis pengganti.
const SundaySwapReview = ({ onChanged, className = '' }) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getSundaySwapRequests();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat tukar jadwal', description: error.message });
    setRequests(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pending = requests.filter((r) => r.status === 'pending_owner').sort((a, b) => a.swap_date.localeCompare(b.swap_date));
  const waiting = requests.filter((r) => r.status === 'pending_substitute').length;
  const history = requests.filter((r) => r.status === 'approved' || r.status === 'rejected').slice(0, 30);

  const review = async (request, approve, note = null) => {
    setBusyId(request.id);
    const { error } = await reviewSundaySwapRequest(request.id, approve, note);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memproses pengajuan', description: error.message });
      return false;
    }
    toast({
      title: approve ? 'Tukar jadwal disetujui' : 'Tukar jadwal ditolak',
      description: approve
        ? `${request.substitute_name} masuk menggantikan ${request.therapist_name} dan slot booking diperbarui.`
        : 'Terapis terkait akan diberi tahu.',
    });
    await load();
    if (onChanged) onChanged();
    return true;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-slate-800">Pengajuan Tukar Jadwal Minggu</h3>
        {pending.length > 0 && <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{pending.length} baru</span>}
      </div>
      {waiting > 0 && <p className="text-xs text-slate-500">{waiting} pengajuan masih menunggu konfirmasi terapis pengganti.</p>}

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-xl">
          <Inbox className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Tidak ada tukar jadwal yang menunggu persetujuan</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((r) => (
            <SundaySwapCard
              key={r.id}
              request={r}
              footer={(
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busyId === r.id} onClick={() => review(r, true)}>
                    {busyId === r.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                    Setujui
                  </Button>
                  <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" disabled={busyId === r.id} onClick={() => { setRejecting(r); setRejectNote(''); }}>
                    <XCircle className="w-4 h-4 mr-1.5" /> Tolak
                  </Button>
                </div>
              )}
            />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            Riwayat tukar jadwal ({history.length})
          </button>
          {showHistory && <div className="grid gap-3 lg:grid-cols-2 mt-3">{history.map((r) => <SundaySwapCard key={r.id} request={r} />)}</div>}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak tukar jadwal?</DialogTitle>
            <DialogDescription>Beri alasan singkat agar terapis paham (opsional).</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className="resize-none h-24" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Batal</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={busyId === rejecting?.id}
              onClick={async () => { if (await review(rejecting, false, rejectNote)) setRejecting(null); }}
            >
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SundaySwapReview;
