import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserCheck, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown when Smart Booking's "Pasien Baru" step finds a likely existing
// patient (matched on nama + no HP + tanggal lahir). The patient must
// explicitly confirm before we link the booking to that patient_id — this is
// the safety check that prevents auto-linking to the wrong medical record.
const SmartPatientMatchConfirmStep = ({ candidate, onBack, onConfirm, onReject }) => {
  const [busy, setBusy] = useState(null); // 'confirm' | 'reject' | null

  const handleConfirm = async () => {
    setBusy('confirm');
    await onConfirm(candidate);
  };

  const handleReject = async () => {
    setBusy('reject');
    await onReject();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Konfirmasi Data</h2>
              <p className="text-blue-100 text-sm mt-0.5">Kami menemukan data yang mirip</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <UserCheck className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
            <p className="text-sm text-[#1e3a8a] leading-relaxed">
              Kami menemukan data pasien terdaftar dengan nama, tanggal lahir, dan/atau nomor WhatsApp yang sama dengan yang Anda masukkan. Apakah ini Anda?
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
            <p className="font-bold text-[#1e3a8a]">{candidate.full_name}</p>
            <p className="text-sm text-slate-500">No. RM: {candidate.medical_record_number || '-'}</p>
            {candidate.phone && <p className="text-sm text-slate-500">WhatsApp: {candidate.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={handleReject}
              className="h-12 rounded-xl border-slate-200 font-semibold"
            >
              {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bukan Saya'}
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={handleConfirm}
              className="h-12 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] font-semibold"
            >
              {busy === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Ini Saya'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SmartPatientMatchConfirmStep;
