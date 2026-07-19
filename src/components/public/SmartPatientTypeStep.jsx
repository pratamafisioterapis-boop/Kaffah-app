import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SmartPatientTypeStep = ({ onBack, onSelectNew, onSelectReturning }) => {
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

      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-[#0f1e3d] tracking-tight mb-2">Anda Pasien Baru atau Pasien Lama?</h2>
        <p className="text-slate-500 text-sm sm:text-base">Ini membantu kami mempercepat proses booking Anda.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <button
          type="button"
          onClick={onSelectNew}
          className="group text-left bg-white rounded-2xl border border-slate-200/70 hover:border-[#1e3a8a]/40 shadow-[0_10px_30px_-20px_rgba(15,30,61,0.15)] hover:shadow-[0_15px_40px_-20px_rgba(15,30,61,0.3)] p-6 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f1e3d]/5 flex items-center justify-center mb-4">
            <UserPlus className="w-5 h-5 text-[#0f1e3d]" />
          </div>
          <p className="font-bold text-[#0f1e3d] mb-1">Pasien Baru</p>
          <p className="text-sm text-slate-500 mb-4">Belum pernah terapi di Kaffah Physiotherapy sebelumnya.</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a]">
            Lanjutkan <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          onClick={onSelectReturning}
          className="group text-left bg-white rounded-2xl border border-slate-200/70 hover:border-[#1e3a8a]/40 shadow-[0_10px_30px_-20px_rgba(15,30,61,0.15)] hover:shadow-[0_15px_40px_-20px_rgba(15,30,61,0.3)] p-6 transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[#0f1e3d]/5 flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-[#0f1e3d]" />
          </div>
          <p className="font-bold text-[#0f1e3d] mb-1">Pasien Lama</p>
          <p className="text-sm text-slate-500 mb-4">Sudah pernah terapi di sini — kami cari data & riwayat Anda.</p>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a]">
            Lanjutkan <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </div>
    </motion.div>
  );
};

export default SmartPatientTypeStep;
