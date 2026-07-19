import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, Zap, Check, ArrowRight, MessageCircle, Crown, ShieldCheck, Sparkles } from 'lucide-react';
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
    window.open(`https://wa.me/6281233339435?text=${encodedMessage}`, '_blank');
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  const cardVariants = {
    hover: { scale: 1.015, transition: { duration: 0.25 } },
    tap: { scale: 0.985, transition: { duration: 0.1 } }
  };

  const subtleFade = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } }
  };

  const services = [
    {
      id: 'physiotherapy',
      icon: Stethoscope,
      title: 'Physiotherapy Treatment',
      desc: 'Layanan fisioterapi klinis berbasis assessment untuk nyeri, cedera, gangguan gerak, saraf terjepit, stroke, dan rehabilitasi pasca operasi.',
      features: [
        'Konsultasi',
        'Assessment klinis menyeluruh',
        'Program terapi personal',
        'Modalitas therapy',
        'Manual therapy',
        'Exercise therapy',
        'Home programs & Edukasi'
      ]
    },
    {
      id: 'recovery',
      icon: Zap,
      title: 'Recovery Treatment',
      desc: 'Layanan pemulihan untuk mengurangi kelelahan otot dan mempercepat recovery.',
      features: [
        'Konsultasi',
        'Pemeriksaan otot',
        'Sport massage',
        'Manual muscle release',
        'Stretching',
        'Recovery pump',
        'Edukasi mandiri'
      ]
    }
  ];

  return (
    <motion.div
      className="w-full max-w-5xl mx-auto px-4 pt-8 sm:pt-14 md:pt-20 pb-28"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <a
        href="/booking/smart"
        className="flex items-center justify-between gap-3 mb-6 sm:mb-8 rounded-2xl bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] px-5 py-4 sm:px-6 sm:py-5 shadow-[0_15px_40px_-20px_rgba(15,30,61,0.5)] hover:shadow-[0_20px_50px_-20px_rgba(15,30,61,0.6)] transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#e8c98a]" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm sm:text-base">Coba Smart Booking — Lebih Cepat &amp; Simpel</p>
            <p className="text-blue-100 text-xs sm:text-sm truncate">Cukup ceritakan keluhan Anda, sistem carikan terapis &amp; jadwal terbaik</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-white shrink-0 group-hover:translate-x-1 transition-transform" />
      </a>

      <div className="text-center mb-10 sm:mb-14 space-y-3 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0f1e3d]/5 border border-[#0f1e3d]/10">
          <Crown className="w-3.5 h-3.5 text-[#b8935f]" />
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.15em] text-[#0f1e3d] uppercase">
            Kaffah Premium Care
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0f1e3d] tracking-tight">
          Pilih Jenis Treatment
        </h2>
        <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Silakan pilih jenis layanan sesuai dengan kebutuhan Anda sebelum melanjutkan proses booking.
        </p>
      </div>

      {/* ================== SERVICE CARDS ================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 mb-10 sm:mb-14">
        {services.map((service) => {
          const Icon = service.icon;
          const isActive = selectedId === service.id;
          return (
            <motion.div
              key={service.id}
              variants={cardVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={() => handleCardClick(service.id)}
              className={cn(
                "relative cursor-pointer rounded-[28px] p-7 sm:p-9 transition-all duration-300 overflow-hidden group h-full flex flex-col",
                "border bg-white",
                isActive
                  ? "border-[#b8935f]/40 shadow-[0_30px_70px_-25px_rgba(15,30,61,0.45)] ring-1 ring-[#b8935f]/30"
                  : "border-slate-200/70 shadow-[0_10px_35px_-20px_rgba(15,30,61,0.15)] hover:border-[#0f1e3d]/15 hover:shadow-[0_25px_60px_-25px_rgba(15,30,61,0.3)]"
              )}
            >
              {/* Subtle premium backdrop */}
              <div className={cn(
                "absolute inset-0 opacity-0 transition-opacity duration-500",
                isActive && "opacity-100"
              )}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f1e3d]/[0.03] via-transparent to-[#b8935f]/[0.05]" />
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#b8935f]/10 rounded-full blur-3xl" />
              </div>

              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#b8935f] via-[#0f1e3d] to-[#b8935f]" />
              )}

              <div className="flex items-start justify-between mb-6 sm:mb-7 relative z-10">
                <div className={cn(
                  "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-br from-[#0f1e3d] to-[#1e3a8a] text-[#e8c98a] shadow-lg shadow-[#0f1e3d]/30"
                    : "bg-[#0f1e3d]/5 text-[#0f1e3d] group-hover:bg-[#0f1e3d]/10"
                )}>
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                {isActive && (
                  <div className="bg-[#0f1e3d] rounded-full p-1.5 shadow-md ring-2 ring-[#b8935f]/40">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#e8c98a]" />
                  </div>
                )}
              </div>

              <h3 className={cn(
                "text-xl sm:text-2xl font-bold mb-2.5 sm:mb-3 tracking-tight relative z-10",
                isActive ? "text-[#0f1e3d]" : "text-slate-900"
              )}>
                {service.title}
              </h3>

              <p className="text-slate-500 text-sm sm:text-base mb-6 leading-relaxed relative z-10">
                {service.desc}
              </p>

              <div className="h-px bg-slate-100 mb-5 relative z-10" />

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-auto relative z-10">
                {service.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-600">
                    <span className={cn(
                      "flex items-center justify-center w-4.5 h-4.5 rounded-full shrink-0",
                      isActive ? "text-[#b8935f]" : "text-[#0f1e3d]/40"
                    )}>
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium text-xs sm:text-sm leading-snug">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ================== PREMIUM HOMECARE NOTICE ================== */}
      <motion.div
        variants={subtleFade}
        initial="hidden"
        animate="visible"
        className="mb-10 sm:mb-14 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f1e3d] via-[#132348] to-[#0f1e3d] p-7 sm:p-9 shadow-[0_30px_70px_-25px_rgba(15,30,61,0.5)]"
      >
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#b8935f]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#1e3a8a]/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-[#b8935f]" />
              <p className="text-[11px] sm:text-xs font-bold tracking-[0.15em] text-[#b8935f] uppercase">
                Exclusive Service
              </p>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-white mb-2.5 sm:mb-3 tracking-tight">
              Layanan Fisioterapi Homecare
            </h4>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Untuk reservasi layanan fisioterapi homecare, kami sarankan menghubungi
              Admin Kaffah Physiotherapy secara langsung agar penjadwalan dapat disesuaikan
              dengan kebutuhan dan ketersediaan terapis.
            </p>
          </div>

          <button
            onClick={handleWhatsAppClick}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#b8935f] to-[#d4b378] hover:from-[#a8825a] hover:to-[#c4a368] text-[#0f1e3d] px-6 sm:px-7 py-3 rounded-full text-sm font-bold shadow-lg shadow-[#b8935f]/20 transition-all duration-300 hover:scale-105 shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            Hubungi Admin via WhatsApp
          </button>
        </div>
      </motion.div>

      {/* ================== UNIFIED FLOATING CTA (selalu fixed, tidak perlu scroll) ================== */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 transition-all duration-300",
          selectedId ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-15px_40px_-15px_rgba(15,30,61,0.2)]">
          <div
            className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          >
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Layanan Dipilih</p>
              <p className="text-sm sm:text-base font-bold text-[#0f1e3d] truncate">
                {selectedId === 'physiotherapy' ? 'Physiotherapy Treatment' : selectedId === 'recovery' ? 'Recovery Treatment' : ''}
              </p>
            </div>
            <Button
              onClick={handleContinue}
              disabled={!selectedId}
              className="h-12 sm:h-14 px-6 sm:px-10 rounded-full bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] hover:from-[#0b1830] hover:to-[#172554] text-white font-bold shrink-0 flex items-center gap-2 shadow-lg shadow-[#0f1e3d]/30 text-sm sm:text-lg"
            >
              Lanjutkan <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TreatmentSelectionStep;
  