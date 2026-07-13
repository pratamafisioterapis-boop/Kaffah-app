import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Zap, Check, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TreatmentSelectionStep = ({ onSelect, initialSelection }) => {
  const [selectedId, setSelectedId] = useState(initialSelection || null);

  useEffect(() => {
    if (initialSelection) {
      setSelectedId(initialSelection);
    }
  }, [initialSelection]);

  const handleCardClick = (id) => {
    setSelectedId(id);
  };

  const handleContinue = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  const handleWhatsAppClick = () => {
    const message = `Halo Admin Kaffah Physiotherapy,

Saya ingin melakukan reservasi layanan fisioterapi homecare.

Mohon informasi terkait jadwal yang tersedia dan prosedur booking.

Terima kasih.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/6285245965745?text=${encodedMessage}`, '_blank');
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  const cardVariants = {
    hover: { scale: 1.02, transition: { duration: 0.2 } },
    tap: { scale: 0.98, transition: { duration: 0.1 } }
  };

  const subtleFade = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } }
  };

  return (
    <motion.div
      className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-14 md:py-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="text-center mb-10 sm:mb-14 space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-[#1e3a8a] text-xs font-bold tracking-wide uppercase px-3.5 py-1.5 rounded-full mb-1">
          <Check className="w-3.5 h-3.5" /> Langkah 1 dari 5
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Pilih Jenis Treatment
        </h2>
        <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Silakan pilih jenis layanan sesuai dengan kebutuhan Anda sebelum melanjutkan proses booking.
        </p>
      </div>

      {/* ================== SERVICE CARDS (LOGIC TIDAK DIUBAH) ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 mb-10 sm:mb-14">
        {/* Card 1 */}
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={() => handleCardClick('physiotherapy')}
          className={cn(
            "relative cursor-pointer rounded-3xl border p-6 sm:p-8 transition-all duration-300 overflow-hidden group",
            selectedId === 'physiotherapy'
              ? "border-[#1e3a8a] bg-gradient-to-br from-blue-50 to-white shadow-[0_25px_60px_-20px_rgba(30,58,138,0.35)] ring-1 ring-[#1e3a8a]/20"
              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_20px_50px_-25px_rgba(30,58,138,0.25)]"
          )}
        >
          {selectedId === 'physiotherapy' && (
            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-400/10 rounded-full blur-2xl" />
          )}
          <div className="flex items-start justify-between mb-5 sm:mb-6 relative z-10">
            <div className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
              selectedId === 'physiotherapy'
                ? "bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] text-white shadow-lg shadow-blue-900/20"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
            )}>
              <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            {selectedId === 'physiotherapy' && (
              <div className="bg-[#1e3a8a] rounded-full p-1.5 shadow-md">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            )}
          </div>

          <h3 className={cn(
            "text-xl sm:text-2xl font-bold mb-2.5 sm:mb-3 tracking-tight",
            selectedId === 'physiotherapy'
              ? "text-[#1e3a8a]"
              : "text-slate-900"
          )}>
            Physiotherapy Treatment
          </h3>

          <p className="text-slate-500 text-sm sm:text-base mb-5 sm:mb-6 leading-relaxed">
            Layanan fisioterapi klinis berbasis assessment untuk nyeri, cedera, gangguan gerak, saraf terjepit, stroke, dan rehabilitasi pasca operasi.
          </p>

          <ul className="space-y-2.5 sm:space-y-3">
            {[
              "Konsultasi",
              "Assessment klinis menyeluruh",
              "Program terapi personal",
              "Modalitas therapy",
              "Manual therapy", 
              "Exercise therapy",
              "Home programs & Edukasi"
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-700">
                <span className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full mt-0.5 shrink-0",
                  selectedId === 'physiotherapy'
                    ? "bg-blue-100 text-[#1e3a8a]"
                    : "bg-emerald-50 text-emerald-600"
                )}>
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="font-medium text-sm sm:text-base">{feature}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Card 2 */}
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={() => handleCardClick('recovery')}
          className={cn(
            "relative cursor-pointer rounded-3xl border p-6 sm:p-8 transition-all duration-300 overflow-hidden group",
            selectedId === 'recovery'
              ? "border-[#1e3a8a] bg-gradient-to-br from-blue-50 to-white shadow-[0_25px_60px_-20px_rgba(30,58,138,0.35)] ring-1 ring-[#1e3a8a]/20"
              : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_20px_50px_-25px_rgba(30,58,138,0.25)]"
          )}
        >
          {selectedId === 'recovery' && (
            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-400/10 rounded-full blur-2xl" />
          )}
          <div className="flex items-start justify-between mb-5 sm:mb-6 relative z-10">
            <div className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
              selectedId === 'recovery'
                ? "bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] text-white shadow-lg shadow-blue-900/20"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
            )}>
              <Zap className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            {selectedId === 'recovery' && (
              <div className="bg-[#1e3a8a] rounded-full p-1.5 shadow-md">
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            )}
          </div>

          <h3 className={cn(
            "text-xl sm:text-2xl font-bold mb-2.5 sm:mb-3 tracking-tight",
            selectedId === 'recovery'
              ? "text-[#1e3a8a]"
              : "text-slate-900"
          )}>
            Recovery Treatment
          </h3>

          <p className="text-slate-500 text-sm sm:text-base mb-5 sm:mb-6 leading-relaxed">
            Layanan pemulihan untuk mengurangi kelelahan otot dan mempercepat recovery.
          </p>

          <ul className="space-y-2.5 sm:space-y-3">
            {[
              "Konsultasi",
              "Pemeriksaan otot",
              "Sport massage",
              "Manual muscle release",
              "Stretching",
              "Recovery pump",
              "Edukasi mandiri"
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-700">
                <span className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full mt-0.5 shrink-0",
                  selectedId === 'recovery'
                    ? "bg-blue-100 text-[#1e3a8a]"
                    : "bg-emerald-50 text-emerald-600"
                )}>
                  <Check className="w-3.5 h-3.5" />
                </span>
                <span className="font-medium text-sm sm:text-base">{feature}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* ================== PREMIUM HOMECARE NOTICE ================== */}
      <motion.div
        variants={subtleFade}
        initial="hidden"
        animate="visible"
        className="mb-10 sm:mb-14 relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border border-emerald-100 p-6 sm:p-8 shadow-[0_20px_50px_-25px_rgba(5,150,105,0.3)]"
      >
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-200/30 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-bold tracking-wider text-emerald-600 uppercase mb-2">
              Exclusive Service
            </p>
            <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-2.5 sm:mb-3 tracking-tight">
              Layanan Fisioterapi Homecare
            </h4>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
              Untuk reservasi layanan fisioterapi homecare, kami sarankan menghubungi 
              Admin Kaffah Physiotherapy secara langsung agar penjadwalan dapat disesuaikan 
              dengan kebutuhan dan ketersediaan terapis.
            </p>
          </div>

          <button
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 sm:px-7 py-3 rounded-full text-sm font-semibold shadow-lg shadow-emerald-900/15 transition-all duration-300 hover:scale-105 shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            Hubungi Admin via WhatsApp
          </button>
        </div>
      </motion.div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!selectedId}
          className={cn(
            "h-13 sm:h-14 px-8 sm:px-10 text-base sm:text-lg font-bold rounded-full transition-all duration-300 flex items-center gap-2",
            selectedId
              ? "bg-[#1e3a8a] hover:bg-[#172554] text-white shadow-lg shadow-blue-900/20 transform hover:-translate-y-1 hover:shadow-xl"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
        >
          Lanjutkan <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
};

export default TreatmentSelectionStep;
