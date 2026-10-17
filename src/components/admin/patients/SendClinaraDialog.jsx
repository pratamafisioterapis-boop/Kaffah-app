import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Copy, Link2, ShieldOff, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import {
  buildPortalUrl, buildWhatsAppLink, createLink, getLiveLink, extractHonorific, markLinkSent, patientDisplayName, setLinkStatus,
} from '@/lib/patientPortal';

const STATUS_LABEL = {
  active: { text: 'Aktif', cls: 'bg-green-100 text-green-800' },
  locked: { text: 'Terkunci (5x salah tanggal lahir)', cls: 'bg-red-100 text-red-800' },
  disabled: { text: 'Dinonaktifkan', cls: 'bg-slate-200 text-slate-800' },
};

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : null;

// Kirim tautan aplikasi pasien (Clinara) lewat WhatsApp milik admin.
// Token mentah hanya ada saat tautan dibuat. Setelah dialog ditutup, tautan
// hanya bisa dikirim ulang dengan membuat tautan baru (yang lama dicabut).
const SendClinaraDialog = ({ patient, onClose }) => {
  const { toast } = useToast();
  const { clinicName, userDetails } = useAuth();
  const [clinicDomain, setClinicDomain] = useState(null);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // { linkId, url } hanya sesudah dibuat di dialog ini

  const open = Boolean(patient);
  const missingBirth = patient && !patient.birth_date;

  const load = useCallback(async () => {
    if (!patient) return;
    setLoading(true);
    try {
      setLink(await getLiveLink(patient.id));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal memuat status tautan', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [patient, toast]);

  useEffect(() => {
    if (!patient || !userDetails?.clinic_id) return;
    supabase.from('clinics').select('subdomain, custom_domain, custom_domain_status')
      .eq('id', userDetails.clinic_id).maybeSingle().then(({ data }) => setClinicDomain(data || null));
  }, [patient, userDetails?.clinic_id]);

  useEffect(() => {
    setFresh(null);
    setLink(null);
    if (patient) load();
  }, [patient, load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast({ title: okMessage });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => run(async () => {
    const res = await createLink(patient.id);
    setFresh({ linkId: res.link_id, url: buildPortalUrl(res.token, clinicDomain) });
    await load();
  }, 'Tautan baru dibuat');

  const handleCopy = () => run(async () => {
    try {
      await navigator.clipboard.writeText(fresh.url);
    } catch {
      throw new Error('Browser menolak menyalin. Pilih teks tautan lalu salin manual.');
    }
  }, 'Tautan disalin');

  const handleSent = () => {
    // Tandai terkirim saat admin membuka WhatsApp; aplikasi tidak bisa tahu pesan benar-benar dikirim.
    markLinkSent(fresh.linkId, 'whatsapp').then(load).catch(() => {});
  };

  const handleStatus = (status, msg) => run(async () => {
    await setLinkStatus(link.id, status);
    await load();
  }, msg);

  const wa = fresh && patient
    ? buildWhatsAppLink({ phone: patient.phone, patientName: patientDisplayName(patient), honorific: extractHonorific(patient.nickname), clinicName, url: fresh.url })
    : null;
  const st = link ? STATUS_LABEL[link.status] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim Clinara ke pasien</DialogTitle>
          <DialogDescription>
            {patient?.full_name}. Pasien membuka tautan lalu memasukkan tanggal lahirnya untuk melihat progres, latihan, keluhan, dan chat.
          </DialogDescription>
        </DialogHeader>

        {missingBirth ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            Tanggal lahir pasien belum diisi, jadi tautan belum bisa dibuat. Lengkapi lewat Edit Pasien dulu.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4">
            {link && (
              <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Status tautan</span>
                  <Badge className={`${st?.cls || ''} border-transparent`}>{st?.text || link.status}</Badge>
                </div>
                <div className="text-slate-500 text-xs">
                  {link.sent_at ? `Dikirim ${fmt(link.sent_at)}` : 'Belum pernah dikirim'}
                  {' · '}
                  {link.last_opened_at ? `Terakhir dibuka ${fmt(link.last_opened_at)}` : 'Belum pernah dibuka'}
                </div>
              </div>
            )}

            {fresh ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-sm break-all select-all font-medium text-sky-900">
                  {fresh.url}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button asChild className="bg-green-600 hover:bg-green-700 text-white flex-1" onClick={handleSent}>
                    <a href={wa} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4 mr-2" /> Kirim lewat WhatsApp</a>
                  </Button>
                  <Button variant="outline" onClick={handleCopy} disabled={busy}><Copy className="h-4 w-4 mr-2" /> Salin</Button>
                </div>
                {patient && !patient.phone && (
                  <p className="text-xs text-slate-500">Nomor HP pasien kosong. WhatsApp tetap terbuka dan Anda memilih kontaknya sendiri.</p>
                )}
                <p className="text-xs text-slate-500">
                  Tautan ini hanya bisa dilihat sekarang. Jika dialog ditutup, mengirim ulang berarti membuat tautan baru dan tautan lama berhenti berlaku.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" onClick={handleCreate} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                  {link ? 'Buat tautan baru untuk dikirim ulang' : 'Buat tautan pasien'}
                </Button>
                {link && (
                  <p className="text-xs text-slate-500">Tautan yang lama berhenti berlaku, dan pasien perlu membuka tautan baru ini.</p>
                )}
              </div>
            )}

            {link && link.status === 'active' && (
              <Button variant="outline" className="w-full text-red-700 border-red-200 hover:bg-red-50" disabled={busy}
                onClick={() => handleStatus('disabled', 'Tautan dinonaktifkan')}>
                <ShieldOff className="h-4 w-4 mr-2" /> Nonaktifkan akses pasien
              </Button>
            )}
            {link && (link.status === 'disabled' || link.status === 'locked') && (
              <Button variant="outline" className="w-full" disabled={busy}
                onClick={() => handleStatus('active', 'Tautan diaktifkan lagi')}>
                <ShieldCheck className="h-4 w-4 mr-2" /> {link.status === 'locked' ? 'Buka kunci tautan' : 'Aktifkan lagi'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendClinaraDialog;
