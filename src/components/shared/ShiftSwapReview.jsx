import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Inbox, ChevronDown, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getShiftSwapRequests, reviewShiftSwapRequest, revokeShiftSwapRequest } from '@/lib/api';
import ShiftSwapCard from '@/components/shared/ShiftSwapCard';
import RevokeApprovalDialog from '@/components/shared/RevokeApprovalDialog';

// Daftar pengajuan tukar shift untuk owner / terapis kepala: setujui atau tolak.
const ShiftSwapReview = ({ onChanged, className = '' }) => {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const canRevoke = role === 'owner' || role === 'super_admin';
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [revokeNote, setRevokeNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await getShiftSwapRequests();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat pengajuan tukar shift', description: error.message });
    setRequests(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pending = requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.swap_date.localeCompare(b.swap_date));
  const history = requests.filter((r) => r.status !== 'pending').slice(0, 30);

  const review = async (request, approve, note = null) => {
    setBusyId(request.id);
    const { error } = await reviewShiftSwapRequest(request.id, approve, note);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memproses pengajuan', description: error.message });
      return false;
    }
    toast({
      title: approve ? 'Tukar shift disetujui' : 'Tukar shift ditolak',
      description: approve
        ? `Jam kerja ${request.therapist_name || 'terapis'} di tanggal itu diganti dan slot booking diperbarui.`
        : `${request.therapist_name || 'Terapis'} akan diberi tahu.`,
    });
    await load();
    if (onChanged) onChanged();
    return true;
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    const ok = await review(rejecting, false, rejectNote);
    if (ok) { setRejecting(null); setRejectNote(''); }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setBusyId(revoking.id);
    const { error } = await revokeShiftSwapRequest(revoking.id, revokeNote);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan tukar shift', description: error.message });
      return;
    }
    toast({
      title: 'Persetujuan tukar shift dibatalkan',
      description: `Jam kerja ${revoking.therapist_name || 'terapis'} di tanggal itu sudah dikembalikan.`,
    });
    setRevoking(null);
    setRevokeNote('');
    await load();
    if (onChanged) onChanged();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-app-accent" /></div>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-slate-800">Pengajuan Tukar Shift</h3>
        {pending.length > 0 && (
          <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{pending.length} baru</span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-app">
          <Inbox className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Tidak ada pengajuan tukar shift yang menunggu</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((r) => {
            const own = r.requested_by === user?.id;
            return (
              <ShiftSwapCard
                key={r.id}
                request={r}
                showTherapist
                footer={own ? (
                  <p className="text-xs text-slate-500">Pengajuan Anda sendiri — menunggu persetujuan owner.</p>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={busyId === r.id}
                      onClick={() => review(r, true)}
                    >
                      {busyId === r.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                      Setujui
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      disabled={busyId === r.id}
                      onClick={() => { setRejecting(r); setRejectNote(''); }}
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> Tolak
                    </Button>
                  </div>
                )}
              />
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            Riwayat tukar shift ({history.length})
          </button>
          {showHistory && (
            <div className="grid gap-3 lg:grid-cols-2 mt-3">
              {history.map((r) => (
                <ShiftSwapCard
                  key={r.id}
                  request={r}
                  showTherapist
                  footer={canRevoke && r.status === 'approved' && !r.revoked_at ? (
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50"
                      disabled={busyId === r.id}
                      onClick={() => { setRevoking(r); setRevokeNote(''); }}
                    >
                      <Undo2 className="w-4 h-4 mr-1.5" /> Batalkan Persetujuan
                    </Button>
                  ) : null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <RevokeApprovalDialog
        open={!!revoking}
        title="Batalkan tukar shift yang sudah disetujui?"
        description={`Jam kerja ${revoking?.therapist_name || 'terapis'} di tanggal itu akan dikembalikan ke jadwal mingguan dan slot booking diperbarui. Terapis akan diberi tahu.`}
        note={revokeNote}
        onNoteChange={setRevokeNote}
        busy={busyId === revoking?.id}
        onConfirm={confirmRevoke}
        onClose={() => setRevoking(null)}
      />

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak tukar shift?</DialogTitle>
            <DialogDescription>
              Beri alasan singkat agar {rejecting?.therapist_name || 'terapis'} paham (opsional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Contoh: shift siang sudah penuh terapis."
            className="resize-none h-24"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Batal</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={busyId === rejecting?.id} onClick={confirmReject}>
              {busyId === rejecting?.id && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftSwapReview;
