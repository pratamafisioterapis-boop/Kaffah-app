import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shared post-booking success screen, used by both the manual and Smart
 * Booking flows so the confirmation experience stays identical either way.
 */
const BookingSuccessScreen = ({
  title = 'Booking Berhasil!',
  description = 'Terima kasih telah melakukan booking. Admin kami akan segera menghubungi Anda via WhatsApp untuk konfirmasi jadwal.'
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="bg-white max-w-md w-full rounded-3xl shadow-[0_25px_70px_-20px_rgba(30,58,138,0.35)] p-8 sm:p-10 text-center border border-slate-100 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1e3a8a] via-[#3b82f6] to-[#0ea5e9]" />
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-emerald-50 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/60">
          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" strokeWidth={1.75} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1e3a8a] mb-2 tracking-tight">{title}</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">{description}</p>
        <Button onClick={() => window.location.href = '/'} className="w-full bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-full h-13 sm:h-14 font-bold text-base shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5">Kembali ke Beranda</Button>
      </motion.div>
    </div>
  );
};

export default BookingSuccessScreen;
