import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TherapistProfileCard from '@/components/public/TherapistProfileCard';

const TherapistFilteredSelectionStep = ({ therapists, selectedTreatment, selectedTherapistId, onSelect, onBack }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-7xl mx-auto px-4 py-8"
    >
      <div className="flex items-center mb-8">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mr-4 pl-0 hover:bg-transparent hover:text-blue-600 text-slate-500"
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Kembali
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pilih Fisioterapis</h2>
          <p className="text-slate-500">Pilih terapis yang tersedia untuk layanan <span className="font-semibold text-blue-600 capitalize">{selectedTreatment}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500 font-medium">Tidak ada terapis yang tersedia untuk layanan ini saat ini.</p>
        </div>
      )}
    </motion.div>
  );
};

export default TherapistFilteredSelectionStep;