import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserX, Stethoscope, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TherapistSelectionCard from './TherapistSelectionCard';

const TherapistSelectionStep = ({ 
  therapists, 
  selectedTreatment, 
  onBack, 
  onSelect, 
  selectedTherapistId 
}) => {
  // Filter therapists based on selected service type
  const filteredTherapists = therapists.filter(t => {
    // If no services defined, maybe include by default or exclude? 
    // Assuming include if empty to not break legacy data, but stricter is better.
    // Let's assume strict: must have service tag. 
    // BUT fallback: if services is null/empty, show for all to prevent empty screens during migration.
    if (!t.services || t.services.length === 0) return true; 
    return t.services.includes(selectedTreatment);
  });

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    },
    exit: { 
      opacity: 0, 
      x: -20,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div 
      className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8 md:py-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="mb-8 sm:mb-10">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="pl-0 hover:bg-transparent hover:text-[#3b82f6] text-[#1e3a8a] transition-colors mb-4 sm:mb-5"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Kembali ke Pilihan Treatment
        </Button>

        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-[#1e3a8a] text-xs font-bold tracking-wide uppercase px-3.5 py-1.5 rounded-full mb-3 sm:mb-4">
          <Check className="w-3.5 h-3.5" /> Langkah 2 dari 5
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2.5 sm:mb-3 tracking-tight">
          Pilih Fisioterapis
        </h2>
        <p className="text-slate-500 text-base sm:text-lg leading-relaxed">
          Kami memiliki tim spesialis untuk layanan <span className="font-semibold text-[#1e3a8a] capitalize">{selectedTreatment}</span>.
        </p>
      </div>

      {filteredTherapists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {filteredTherapists.map((therapist) => (
            <TherapistSelectionCard
              key={therapist.id}
              therapist={therapist}
              isSelected={selectedTherapistId === therapist.id}
              onSelect={() => onSelect(therapist.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-5 ring-1 ring-slate-100">
            <UserX className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 tracking-tight">Tidak Ada Fisioterapis Tersedia</h3>
          <p className="text-slate-500 max-w-md text-sm sm:text-base leading-relaxed px-4">
            Maaf, belum ada fisioterapis yang tersedia untuk layanan {selectedTreatment} saat ini. Silakan coba layanan lain.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TherapistSelectionStep;
