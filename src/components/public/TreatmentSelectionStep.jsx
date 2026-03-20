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
      className="w-full max-w-5xl mx-auto px-4 py-12 md:py-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="text-center mb-12 space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
          Pilih Jenis Treatment
        </h2>
        <p className="text-slate-600 text-lg max-w-2xl mx-auto">
          Silakan pilih jenis layanan sesuai dengan kebutuhan Anda sebelum melanjutkan proses booking.
        </p>
      </div>

      {/* ================== SERVICE CARDS (TIDAK DIUBAH) ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Card 1 */}
        <motion.div
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={() => handleCardClick('physiotherapy')}
          className={cn(
            "relative cursor-pointer rounded-2xl border-2 p-8 transition-all duration-300 overflow-hidden group",
            selectedId === 'physiotherapy'
              ? "border-[#1e3a8a] bg-[#dbeafe] shadow-xl shadow-blue-900/10"
              : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg"
          )}
        >
          <div className="flex items-start justify-between mb-6">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedId === 'physiotherapy'
                ? "bg-[#1e3a8a] text-white"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
            )}>
              <Stethoscope className="w-8 h-8" />
            </div>
            {selectedId === 'physiotherapy' && (
              <div className="bg-[#1e3a8a] rounded-full p-1">
                <Check className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          <h3 className={cn(
            "text-2xl font-bold mb-3",
            selectedId === 'physiotherapy'
              ? "text-[#1e3a8a]"
              : "text-slate-900"
          )}>
            Physiotherapy Treatment
          </h3>

          <p className="text-slate-600 mb-6 leading-relaxed">
            Layanan fisioterapi klinis berbasis assessment untuk nyeri, cedera, gangguan gerak, saraf terjepit, stroke, dan rehabilitasi pasca operasi.
          </p>

          <ul className="space-y-3">
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
                <Check className={cn(
                  "w-5 h-5 mt-0.5 shrink-0",
                  selectedId === 'physiotherapy'
                    ? "text-blue-700"
                    : "text-green-500"
                )} />
                <span className="font-medium">{feature}</span>
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
            "relative cursor-pointer rounded-2xl border-2 p-8 transition-all duration-300 overflow-hidden group",
            selectedId === 'recovery'
              ? "border-[#1e3a8a] bg-[#dbeafe] shadow-xl shadow-blue-900/10"
              : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg"
          )}
        >
          <div className="flex items-start justify-between mb-6">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedId === 'recovery'
                ? "bg-[#1e3a8a] text-white"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
            )}>
              <Zap className="w-8 h-8" />
            </div>
            {selectedId === 'recovery' && (
              <div className="bg-[#1e3a8a] rounded-full p-1">
                <Check className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          <h3 className={cn(
            "text-2xl font-bold mb-3",
            selectedId === 'recovery'
              ? "text-[#1e3a8a]"
              : "text-slate-900"
          )}>
            Recovery Treatment
          </h3>

          <p className="text-slate-600 mb-6 leading-relaxed">
            Layanan pemulihan untuk mengurangi kelelahan otot dan mempercepat recovery.
          </p>

          <ul className="space-y-3">
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
                <Check className={cn(
                  "w-5 h-5 mt-0.5 shrink-0",
                  selectedId === 'recovery'
                    ? "text-blue-700"
                    : "text-green-500"
                )} />
                <span className="font-medium">{feature}</span>
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
        className="mb-14 relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border border-emerald-200 p-8 shadow-sm"
      >
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-200/30 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-emerald-600 uppercase mb-2">
              Exclusive Service
            </p>
            <h4 className="text-xl font-bold text-slate-900 mb-3">
              Layanan Fisioterapi Homecare
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Untuk reservasi layanan fisioterapi homecare, kami sarankan menghubungi 
              Admin Kaffah Physiotherapy secara langsung agar penjadwalan dapat disesuaikan 
              dengan kebutuhan dan ketersediaan terapis.
            </p>
          </div>

          <button
            onClick={handleWhatsAppClick}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 rounded-full text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-105"
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
            "h-14 px-10 text-lg font-bold rounded-xl transition-all duration-300 flex items-center gap-2",
            selectedId
              ? "bg-[#1e3a8a] hover:bg-[#172554] text-white shadow-lg shadow-blue-900/20 transform hover:-translate-y-1"
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