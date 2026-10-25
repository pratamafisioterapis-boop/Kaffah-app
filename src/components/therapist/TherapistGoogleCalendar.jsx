import React, { useState, useEffect, useCallback } from 'react';
import {
  getMyGoogleCalendarLink,
  startGoogleCalendarOAuth,
  resyncMyGoogleCalendar,
  disconnectMyGoogleCalendar,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { CalendarDays, Loader2, RefreshCw, Unlink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Hasil redirect dari therapist-gcal-oauth-callback (?gcal_status=...).
const consumeOAuthRedirectResult = () => {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('gcal_status');
  if (!status) return;

  if (status === 'success') {
    toast({ title: 'Google Calendar terhubung', description: 'Jadwal mendatang sedang disinkronkan ke kalender kamu.' });
  } else {
    toast({ variant: 'destructive', title: 'Gagal menghubungkan', description: params.get('gcal_message') || 'Terjadi kesalahan.' });
  }

  params.delete('gcal_status');
  params.delete('gcal_message');
  params.delete('settings');
  const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', newUrl);
};

const formatTime = (iso) => (iso ? format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: idLocale }) : '-');

const TherapistGoogleCalendar = ({ therapistId }) => {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const fetchLink = useCallback(async () => {
    const { data } = await getMyGoogleCalendarLink(therapistId);
    setLink(data || null);
    setLoading(false);
  }, [therapistId]);

  useEffect(() => {
    consumeOAuthRedirectResult();
    fetchLink();
  }, [fetchLink]);

  const handleConnect = async () => {
    setBusy('connect');
    const { data, error } = await startGoogleCalendarOAuth();
    if (error || !data?.url) {
      toast({ variant: 'destructive', title: 'Gagal memulai', description: error?.message || 'Tidak bisa menghubungkan Google Calendar.' });
      setBusy(null);
      return;
    }
    window.location.href = data.url;
  };

  const handleResync = async () => {
    setBusy('resync');
    const { data, error } = await resyncMyGoogleCalendar();
    setBusy(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Sinkron gagal', description: error.message });
    } else {
      toast({ title: 'Sinkron selesai', description: `${data?.synced ?? 0} jadwal disinkronkan.` });
    }
    fetchLink();
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Putuskan Google Calendar? Jadwal mendatang yang sudah masuk ke kalender kamu akan dihapus.')) return;
    setBusy('disconnect');
    const { error } = await disconnectMyGoogleCalendar();
    setBusy(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memutuskan', description: error.message });
    } else {
      toast({ title: 'Google Calendar diputuskan' });
    }
    fetchLink();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Hubungkan akun Google kamu supaya setiap jadwal pasien yang ditugaskan ke kamu otomatis muncul di
        Google Calendar — termasuk saat dijadwal ulang, dipindah terapis, atau dibatalkan.
      </p>

      {!link ? (
        <div className="p-4 rounded-app border border-slate-100 bg-white space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Belum terhubung</p>
              <p className="text-xs text-slate-500">Login dengan akun Google tempat kamu ingin menerima jadwal.</p>
            </div>
          </div>
          <Button
            onClick={handleConnect}
            disabled={busy === 'connect'}
            className="w-full rounded-app bg-app-accent hover:bg-app-accent-hover"
          >
            {busy === 'connect' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2" />}
            Hubungkan Google Calendar
          </Button>
        </div>
      ) : (
        <div className="p-4 rounded-app border border-slate-100 bg-white space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Terhubung</p>
              <p className="text-xs text-slate-500 break-all">{link.google_email || 'Akun Google'}</p>
            </div>
          </div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <p>Terhubung sejak: <span className="text-slate-700">{formatTime(link.connected_at)}</span></p>
            <p>Sinkron terakhir: <span className="text-slate-700">{formatTime(link.last_synced_at)}</span></p>
          </div>
          {link.last_error && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-app-sm p-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 break-words">{link.last_error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleResync} disabled={!!busy} className="rounded-app">
              {busy === 'resync' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sinkron ulang
            </Button>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={!!busy}
              className="rounded-app text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {busy === 'disconnect' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
              Putuskan
            </Button>
          </div>
          {link.last_error && (
            <Button variant="ghost" onClick={handleConnect} disabled={!!busy} className="w-full rounded-app text-xs">
              Hubungkan ulang akun Google
            </Button>
          )}
        </div>
      )}

      <div className="bg-slate-100/70 rounded-app p-3">
        <p className="text-xs text-slate-500 leading-relaxed">
          Event di kalender hanya salinan. Mengubah atau menghapusnya di Google Calendar tidak mengubah jadwal di aplikasi.
        </p>
      </div>
    </div>
  );
};

export default TherapistGoogleCalendar;
