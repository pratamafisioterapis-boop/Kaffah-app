import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTherapistPracticeHoursGrouped } from '@/lib/api';
import { cn } from '@/lib/utils';

const TherapistSelectionCard = ({ therapist, isSelected, onSelect }) => {
  const [workingSchedules, setWorkingSchedules] = useState([]);

  useEffect(() => {
    if (!therapist?.id) return;
    let isMounted = true;

    getTherapistPracticeHoursGrouped(therapist.id).then(({ data }) => {
      if (!isMounted || !data) return;
      setWorkingSchedules(data.map(g => `${g.day_range}: ${g.display_start_time?.slice(0, 5)} - ${g.display_end_time?.slice(0, 5)}`));
    });

    return () => { isMounted = false; };
  }, [therapist?.id]);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full",
        isSelected 
          ? "border-[#1e3a8a] bg-gradient-to-b from-blue-50/60 to-white shadow-[0_20px_50px_-20px_rgba(30,58,138,0.35)] ring-1 ring-[#1e3a8a]/30" 
          : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_18px_40px_-22px_rgba(30,58,138,0.25)]"
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 rounded-full text-slate-300">
            <span className="text-4xl font-bold">{therapist.name?.charAt(0)}</span>
          </div>
        )}
        
        {isSelected && (
          <div className="absolute top-4 right-4 bg-[#1e3a8a] rounded-full p-1.5 shadow-md shadow-blue-900/30">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <div className="mb-3.5 sm:mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 leading-tight tracking-tight">
            {therapist.name}
          </h3>
          <p className="text-[#3b82f6] font-semibold text-sm">
            {therapist.specialization || 'Physiotherapist'}
          </p>
        </div>

        {therapist.bio && (
          <p className="text-slate-500 text-sm mb-5 sm:mb-6 line-clamp-3 leading-relaxed">
            {therapist.bio}
          </p>
        )}

        <div className="mt-auto space-y-3.5 sm:space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <Clock className="w-3 h-3 text-[#1e3a8a]" /> Jadwal Praktik
            </div>
            <div className="space-y-1">
              {workingSchedules.length > 0 ? (
                workingSchedules.map((schedule, idx) => (
                  <div key={idx} className="text-sm text-slate-700 font-semibold">
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
              "w-full h-11 font-bold rounded-full transition-all duration-300",
              isSelected 
                ? "bg-[#1e3a8a] hover:bg-[#172554] text-white shadow-md shadow-blue-900/20" 
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
