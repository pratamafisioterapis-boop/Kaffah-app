import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseWorkingHours } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TherapistSelectionCard = ({ therapist, isSelected, onSelect }) => {
  const workingSchedules = parseWorkingHours(therapist.working_hours);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        "relative rounded-xl border transition-all duration-300 overflow-hidden flex flex-col h-full",
        isSelected 
          ? "border-[#1e3a8a] bg-blue-50/50 shadow-lg shadow-blue-900/10 ring-1 ring-[#1e3a8a]" 
          : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg"
      )}
    >
      <div className="aspect-square bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-center relative">
        {therapist.avatar_url ? (
          <img 
            src={therapist.avatar_url} 
            alt={therapist.name} 
            className="w-full h-full object-contain mix-blend-multiply"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-full text-slate-300">
            <span className="text-4xl font-bold">{therapist.name?.charAt(0)}</span>
          </div>
        )}
        
        {isSelected && (
          <div className="absolute top-4 right-4 bg-[#1e3a8a] rounded-full p-1.5 shadow-md">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
            {therapist.name}
          </h3>
          <p className="text-[#3b82f6] font-medium text-sm">
            {therapist.specialization || 'Physiotherapist'}
          </p>
        </div>

        {therapist.bio && (
          <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed">
            {therapist.bio}
          </p>
        )}

        <div className="mt-auto space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Jadwal Praktik
            </div>
            <div className="space-y-1">
              {workingSchedules.length > 0 ? (
                workingSchedules.map((schedule, idx) => (
                  <div key={idx} className="text-sm text-slate-700 font-medium">
                    {schedule}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 italic">Jadwal belum tersedia</div>
              )}
            </div>
          </div>

          <Button 
            className={cn(
              "w-full h-11 font-bold transition-all duration-300",
              isSelected 
                ? "bg-[#1e3a8a] hover:bg-[#172554] text-white" 
                : "bg-white text-[#1e3a8a] border-2 border-[#1e3a8a] hover:bg-blue-50"
            )}
            onClick={onSelect}
          >
            {isSelected ? "Terpilih" : "Pilih Fisioterapis"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default TherapistSelectionCard;