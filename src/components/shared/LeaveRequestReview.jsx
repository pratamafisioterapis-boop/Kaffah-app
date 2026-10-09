import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Inbox, ChevronDown, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getLeaveRequests, reviewLeaveRequest, revokeLeaveRequest } from '@/lib/api';
import LeaveRequestCard from '@/components/shared/LeaveRequestCard';

// Daftar pengajuan izin untuk owner / terapis kepala: setujui atau tolak,
// beserta jadwal pengganti yang diajukan terapis.
const LeaveRequestReview = ({ onChanged, className = '' }) => {
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
    const { data, error } = await getLeaveRequests();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat pengajuan izin', description: error.message });
    setRequests(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pending = requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.leave_date.localeCompare(b.leave_date));
  const history = requests.filter((r) => r.status !== 'pending').slice(0, 30);

  const review = async (request, approve, note = null) => {
    setBusyId(request.id);
    const { error } = await reviewLeaveRequest(request.id, approve, note);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memproses pengajuan', description: error.message });
      return false;
    }
    toast({
      title: approve ? 'Izin disetujui' : 'Izin ditolak',
      description: approve
        ? `${request.therapist_name || 'Terapis'} sudah tercatat izin, slot booking tanggal izin ditutup dan jadwal pengganti dibuka.`
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
    const { data: stillBooked, error } = await revokeLeaveRequest(revoking.id, revokeNote);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan izin', description: error.message });
      return;
    }
    toast({
      title: 'Persetujuan izin dibatalkan',
      description: `Libur dan jadwal pengganti ${revoking.therapist_name || 'terapis'} sudah dikembalikan.`
        + (stillBooked > 0 ? ` Perhatian: ${stillBooked} booking di tanggal pengganti masih aktif, mohon dijadwalkan ulang.` : ''),
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
        <h3 className="text-base font-bold text-slate-800">Pengajuan Izin Terapis</h3>
        {pending.length > 0 && (
          <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{pending.length} baru</span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-app">
          <Inbox className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Tidak ada pengajuan yang menunggu</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((r) => {
            const own = r.requested_by === user?.id;
            return (
              <LeaveRequestCard
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
            Riwayat pengajuan ({history.length})
          </button>
          {showHistory && (
            <div className="grid gap-3 lg:grid-cols-2 mt-3">
              {history.map((r) => (
                <LeaveRequestCard
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

      <Dialog open={!!revoking} onOpenChange={(open) => { if (!open) setRevoking(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan izin yang sudah disetujui?</DialogTitle>
            <DialogDescription>
              Hari libur {revoking?.therapist_name || 'terapis'} akan dihapus dan jadwal masuk pengganti
              yang terlanjur dibuka akan ditutup, sehingga jadwalnya kembali seperti semula. Terapis akan diberi tahu.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={revokeNote}
            onChange={(e) => setRevokeNote(e.target.value)}
            placeholder="Alasan pembatalan (opsional)"
            className="resize-none h-24"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevoking(null)}>Kembali</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={busyId === revoking?.id} onClick={confirmRevoke}>
              {busyId === revoking?.id && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Ya, Batalkan Izin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan izin?</DialogTitle>
            <DialogDescription>
              Beri alasan singkat agar {rejecting?.therapist_name || 'terapis'} paham (opsional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Contoh: jadwal pasien hari itu penuh, mohon pilih tanggal lain."
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

export default LeaveRequestReview;
