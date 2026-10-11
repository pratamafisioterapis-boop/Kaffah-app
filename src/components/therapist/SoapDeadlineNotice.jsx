import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { KAFFAH_CLINIC_ID } from '@/lib/subjectiveTemplate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : '');

// Khusus klinik Kaffah: pemberitahuan masa percobaan "SOAP tepat waktu".
// Banner selalu tampil di dashboard terapis; popup muncul setiap komponen ini
// dipasang — yaitu setiap login atau setiap awal pindah akun (owner/admin
// ke terapis), karena dashboard dirender ulang pada saat itu.
const SoapDeadlineNotice = ({ therapist }) => {
  const [notice, setNotice] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!therapist?.id || therapist.clinic_id !== KAFFAH_CLINIC_ID) { setNotice(null); return undefined; }
    let active = true;
    supabase.rpc('get_soap_deadline_notice', { p_therapist_id: therapist.id }).then(({ data, error }) => {
      if (!active || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.active) { setNotice(row); setOpen(true); } else { setNotice(null); }
    });
    return () => { active = false; };
  }, [therapist?.id, therapist?.clinic_id]);

  if (!notice) return null;

  const locked = notice.locked && notice.overdue_count > 0;
  const body = (
    <>
      <p>
        Masa percobaan pengisian SOAP tepat waktu berlaku sampai <strong>{fmtDate(notice.deadline_end)}</strong>.
        Minggu ini ada keringanan: SOAP setiap sesi boleh diisi sampai <strong>pukul 23.59</strong> di hari sesi.
        Lewat dari itu, <strong>Booking Calendar akan dikunci</strong> sampai SOAP yang terlambat diisi.
      </p>
      {locked && (
        <p className="mt-2 font-semibold">
          Booking Calendar Anda sedang terkunci: {notice.overdue_count} SOAP melewati batas. Segera lengkapi di menu Evaluasi Pasien.
        </p>
      )}
      {!locked && notice.today_unfilled_count > 0 && (
        <p className="mt-2 font-semibold">
          Hari ini ada {notice.today_unfilled_count} SOAP yang belum terisi — selesaikan sebelum 23.59.
        </p>
      )}
    </>
  );

  return (
    <>
      <div className={`flex items-start gap-3 px-4 py-3 mb-4 rounded-app-sm border text-sm ${locked ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        {locked ? <Lock className="w-4 h-4 mt-0.5 shrink-0" /> : <Clock className="w-4 h-4 mt-0.5 shrink-0" />}
        <div className="min-w-0 break-words">{body}</div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Batas Pengisian SOAP
            </DialogTitle>
            <DialogDescription asChild><div className="text-sm text-slate-700">{body}</div></DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setOpen(false)}>Mengerti</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SoapDeadlineNotice;
