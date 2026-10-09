import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarClock, Send, Loader2, Info, Trash2, Check, X, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import {
  getSundaySwapRequests, getSundaySwapCandidates, createSundaySwapRequest,
  respondSundaySwapRequest, cancelSundaySwapRequest,
} from '@/lib/api';
import SundaySwapCard from '@/components/shared/SundaySwapCard';

const DAY_KEY = 'yyyy-MM-dd';

// Tukar jadwal masuk hari Minggu: pilih terapis pengganti (yang libur), pengganti wajib acc, lalu owner acc.
const TherapistSundaySwap = ({ therapist, onChanged }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const todayStr = format(new Date(), DAY_KEY);

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [date, setDate] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [substitute, setSubstitute] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [declining, setDeclining] = useState(null);
  const [declineNote, setDeclineNote] = useState('');

  const load = useCallback(async () => {
    const { data } = await getSundaySwapRequests();
    setRequests(data);
    setLoading(false);
    if (onChanged) onChanged();
  }, [onChanged]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel(`sunday-swap-${user?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_sunday_swap_requests' }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, user?.id]);

  const dateError = useMemo(() => {
    if (!date) return null;
    if (date < todayStr) return 'Tanggal tidak boleh sudah lewat.';
    if (parseISO(date).getDay() !== 0) return 'Tukar jadwal hanya untuk hari Minggu.';
    if (requests.some((r) => r.requested_by === user?.id && r.swap_date === date && r.status !== 'rejected')) {
      return 'Sudah ada pengajuan tukar jadwal di tanggal ini.';
    }
    return null;
  }, [date, todayStr, requests, user?.id]);

  useEffect(() => {
    setSubstitute(null);
    setCandidates([]);
    if (!date || dateError) return undefined;
    let active = true;
    setLoadingCandidates(true);
    getSundaySwapCandidates(date).then(({ data, error }) => {
      if (!active) return;
      if (error) toast({ variant: 'destructive', title: 'Gagal memuat terapis', description: error.message });
      setCandidates(data);
      setLoadingCandidates(false);
    });
    return () => { active = false; };
  }, [date, dateError, toast]);

  const hasShift = !!(therapist?.work_start_time && therapist?.work_end_time);
  const blocker = !hasShift ? 'Jam kerja Anda belum diatur, hubungi owner.'
    : !date ? 'Pilih tanggal Minggu dulu.'
    : dateError || (!loadingCandidates && candidates.length === 0 ? 'Tidak ada terapis yang libur di tanggal ini.' : null)
    || (!substitute ? 'Pilih terapis pengganti.' : null);

  const handleSubmit = async () => {
    if (blocker) return;
    setSubmitting(true);
    const { error } = await createSundaySwapRequest({ substituteId: substitute.id, date, notes });
    setSubmitting(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal mengirim pengajuan',
        description: error.code === '23505' ? 'Sudah ada pengajuan tukar jadwal di tanggal ini.' : error.message,
      });
      return;
    }
    toast({
      title: 'Permintaan terkirim',
      description: `${substitute.name} diberi tahu. Setelah ia setuju, owner akan menyetujui.`,
      className: 'bg-green-50 text-green-800 border-green-200',
    });
    setDate(''); setNotes('');
    load();
  };

  const respond = async (request, accept, note = null) => {
    setBusyId(request.id);
    const { error } = await respondSundaySwapRequest(request.id, accept, note);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memproses', description: error.message });
      return false;
    }
    toast({
      title: accept ? 'Anda menerima tukar jadwal' : 'Permintaan ditolak',
      description: accept ? 'Menunggu persetujuan owner.' : `${request.therapist_name || 'Terapis'} akan diberi tahu.`,
    });
    load();
    return true;
  };

  const handleCancel = async (request) => {
    if (!window.confirm('Batalkan pengajuan tukar jadwal ini?')) return;
    setBusyId(request.id);
    const { error } = await cancelSundaySwapRequest(request.id);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: error.message });
      return;
    }
    toast({ title: 'Pengajuan dibatalkan' });
    load();
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  const incoming = requests.filter((r) => r.substitute_user_id === user?.id && r.status === 'pending_substitute');
  const incomingDone = requests.filter((r) => r.substitute_user_id === user?.id && r.status !== 'pending_substitute');
  const mine = requests.filter((r) => r.requested_by === user?.id);

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600" /> Permintaan untuk Anda
            <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{incoming.length}</span>
          </h3>
          <p className="text-xs text-slate-500 -mt-1">Rekan Anda meminta Anda menggantikan jadwal masuknya di hari Minggu. Anda wajib menyetujui sebelum diteruskan ke owner.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {incoming.map((r) => (
              <SundaySwapCard
                key={r.id}
                request={r}
                footer={(
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={busyId === r.id}
                      onClick={() => respond(r, true)}
                    >
                      {busyId === r.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                      Terima
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      disabled={busyId === r.id}
                      onClick={() => { setDeclining(r); setDeclineNote(''); }}
                    >
                      <X className="w-4 h-4 mr-1.5" /> Tolak
                    </Button>
                  </div>
                )}
              />
            ))}
          </div>
          {declining && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-2">
              <Label>Alasan menolak {declining.therapist_name} (opsional)</Label>
              <Textarea value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} className="resize-none h-16 bg-white" placeholder="Contoh: ada acara keluarga." />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDeclining(null)}>Batal</Button>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={busyId === declining.id}
                  onClick={async () => { if (await respond(declining, false, declineNote)) setDeclining(null); }}
                >
                  Tolak Permintaan
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center"><CalendarClock className="w-3.5 h-3.5" /></span>
              Tukar jadwal masuk hari Minggu
            </h3>
            <p className="text-xs text-slate-500 -mt-2">Pilih terapis yang libur di hari Minggu itu untuk menggantikan Anda. Ia wajib menyetujui, lalu owner menyetujui.</p>

            <div className="space-y-1.5">
              <Label htmlFor="sunday-date">Tanggal Minggu</Label>
              <Input id="sunday-date" type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} />
              {dateError && <p className="text-xs text-red-600 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{dateError}</p>}
            </div>

            {date && !dateError && (
              <div className="space-y-2">
                <Label>Terapis pengganti (yang libur)</Label>
                {loadingCandidates ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : candidates.length === 0 ? (
                  <p className="text-xs text-slate-500">Tidak ada terapis yang libur di tanggal ini.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {candidates.map((c) => {
                      const selected = substitute?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSubstitute(c)}
                          className={cn(
                            'text-left rounded-xl border-2 p-3 flex items-center justify-between transition-all',
                            selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300',
                          )}
                        >
                          <span className="text-sm font-bold text-slate-800">{c.name}</span>
                          {selected && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {substitute && (
                  <p className="text-xs rounded-lg bg-blue-50 text-blue-800 px-3 py-2">
                    Pada {format(parseISO(date), 'dd-MM-yyyy')} <b>{substitute.name}</b> masuk menggantikan Anda
                    ({String(therapist.work_start_time).slice(0, 5)}–{String(therapist.work_end_time).slice(0, 5)}), dan Anda libur.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sunday-notes">Catatan (opsional)</Label>
              <Textarea id="sunday-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: ada acara keluarga." className="resize-none h-16" />
            </div>
          </section>

          <div className="space-y-2">
            {blocker && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />{blocker}</p>}
            <Button onClick={handleSubmit} disabled={!!blocker || submitting} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Kirim Permintaan Tukar Jadwal
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-bold text-slate-800">Pengajuan Saya</h3>
          {mine.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-xl">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Belum ada pengajuan tukar jadwal</p>
            </div>
          ) : mine.map((r) => (
            <SundaySwapCard
              key={r.id}
              request={r}
              footer={(r.status === 'pending_substitute' || r.status === 'pending_owner') ? (
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busyId === r.id} onClick={() => handleCancel(r)}>
                  {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                  Batalkan pengajuan
                </Button>
              ) : null}
            />
          ))}
          {incomingDone.length > 0 && (
            <>
              <h3 className="font-bold text-slate-800 pt-2">Riwayat sebagai pengganti</h3>
              {incomingDone.map((r) => <SundaySwapCard key={r.id} request={r} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TherapistSundaySwap;
