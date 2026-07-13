import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TherapistProfileCard from '@/components/public/TherapistProfileCard';

const TherapistFilteredSelectionStep = ({ therapists, selectedTreatment, selectedTherapistId, onSelect, onBack }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8"
    >
      <div className="mb-8 sm:mb-10">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="pl-0 mb-4 sm:mb-5 hover:bg-transparent hover:text-[#3b82f6] text-slate-500"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Kembali
        </Button>

        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-[#1e3a8a] text-xs font-bold tracking-wide uppercase px-3.5 py-1.5 rounded-full mb-3 sm:mb-4">
          <Check className="w-3.5 h-3.5" /> Langkah 2 dari 5
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">Pilih Fisioterapis</h2>
        <p className="text-slate-500 text-base sm:text-lg leading-relaxed">
          Pilih terapis yang tersedia untuk layanan <span className="font-semibold text-[#1e3a8a] capitalize">{selectedTreatment}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {therapists.map((therapist) => (
          <TherapistProfileCard
            key={therapist.id}
            therapist={therapist}
            isSelected={selectedTherapistId === therapist.id}
            onSelect={() => onSelect(therapist.id)}
            showSelectButton={true}
          />
        ))}
      </div>

      {therapists.length === 0 && (
        <div className="text-center py-16 sm:py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-500 font-medium text-sm sm:text-base px-4">Tidak ada terapis yang tersedia untuk layanan ini saat ini.</p>
        </div>
      )}
    </motion.div>
  );
};

export default TherapistFilteredSelectionStep;
