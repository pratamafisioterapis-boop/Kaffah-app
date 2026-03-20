import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserX } from 'lucide-react';
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
      className="w-full max-w-7xl mx-auto px-4 py-8 md:py-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="mb-8">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="pl-0 hover:bg-transparent hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Kembali ke Pilihan Treatment
        </Button>
        
        <h2 className="text-3xl font-bold text-slate-900 mb-3">
          Pilih Fisioterapis
        </h2>
        <p className="text-slate-600 text-lg">
          Kami memiliki tim spesialis untuk layanan <span className="font-semibold text-blue-700 capitalize">{selectedTreatment}</span>.
        </p>
      </div>

      {filteredTherapists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
        <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="bg-slate-100 p-4 rounded-full mb-4">
            <UserX className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Tidak Ada Fisioterapis Tersedia</h3>
          <p className="text-slate-500 max-w-md">
            Maaf, belum ada fisioterapis yang tersedia untuk layanan {selectedTreatment} saat ini. Silakan coba layanan lain.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TherapistSelectionStep;