import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTherapistPracticeHoursGrouped } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TherapistCard = ({ therapist, isSelected, onSelect }) => {
  const [practiceHours, setPracticeHours] = useState([]);
  const [loadingHours, setLoadingHours] = useState(true);
  const [errorHours, setErrorHours] = useState(false);

  useEffect(() => {
    if (therapist?.id) {
        fetchHours();
    } else {
        setLoadingHours(false);
    }
  }, [therapist]);

  const fetchHours = async () => {
      setLoadingHours(true);
      setErrorHours(false);
      try {
          const { data, error } = await getTherapistPracticeHoursGrouped(therapist.id);
          
          if (error) throw error;

          if (data) {
              // Format grouped data
              const formatted = data.map(group => 
                  `${group.day_range}: ${group.display_start_time?.slice(0,5)} - ${group.display_end_time?.slice(0,5)}`
              );
              setPracticeHours(formatted);
          }
      } catch (err) {
          console.error("Failed to load practice hours:", err);
          setErrorHours(true);
      } finally {
          setLoadingHours(false);
      }
  };

  if (!therapist) return null;

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={cn(
        "relative rounded-xl border transition-all duration-300 overflow-hidden flex flex-col h-full bg-white group",
        isSelected 
          ? "border-[#1e3a8a] shadow-xl shadow-blue-900/10 ring-1 ring-[#1e3a8a]" 
          : "border-slate-200 hover:border-[#3b82f6] hover:shadow-lg"
      )}
    >
       {/* Hover Overlay */}
      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all duration-300 pointer-events-none z-0" />

      <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-center relative overflow-hidden z-10">
        <div className="w-[100px] h-[100px] rounded-full shadow-lg border-2 border-white overflow-hidden bg-white">
            {therapist.avatar_url ? (
            <img 
                src={therapist.avatar_url} 
                alt={therapist.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(therapist.name)}&background=random`;
                }}
            />
            ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                <span className="text-4xl font-bold">{therapist.name?.charAt(0)}</span>
            </div>
            )}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col relative z-10">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-bold text-[#1e3a8a] mb-1 leading-tight line-clamp-2">
            {therapist.name}
          </h3>
          <p className="text-[#3b82f6] font-medium text-sm">
            {therapist.specialization || 'Physiotherapist'}
          </p>

           {/* Badges */}
           {Array.isArray(therapist.badges) && therapist.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                {therapist.badges.map((badge, idx) => (
                <span 
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-black/5"
                    style={{ backgroundColor: badge.color }}
                >
                    {badge.label}
                </span>
                ))}
            </div>
           )}
        </div>

        {/* Bio Card with Tooltip */}
        <TooltipProvider>
           <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg mb-4 border border-blue-100 min-h-[80px] cursor-help">
                    <p className="text-slate-700 text-sm leading-relaxed line-clamp-3" style={{ wordBreak: 'break-word' }}>
                        {therapist.bio || 'Tidak ada deskripsi.'}
                    </p>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px] bg-slate-900 text-white">
                 <p className="text-sm">{therapist.bio}</p>
              </TooltipContent>
           </Tooltip>
        </TooltipProvider>

        <div className="mt-auto space-y-4">
          <div className="bg-white rounded-lg p-3 space-y-2 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1e3a8a] uppercase tracking-wider justify-center">
              <Clock className="w-3.5 h-3.5" /> Jadwal Praktik
            </div>
            <div className="space-y-1 text-center min-h-[60px] flex flex-col justify-center">
              {loadingHours ? (
                 <div className="text-xs text-slate-400 italic">Memuat jadwal...</div>
              ) : errorHours ? (
                 <div className="flex flex-col items-center gap-1">
                    <div className="text-xs text-red-400 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Gagal memuat
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); fetchHours(); }}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Coba lagi
                    </button>
                 </div>
              ) : practiceHours.length > 0 ? (
                practiceHours.map((schedule, idx) => (
                  <div key={idx} className="text-xs text-slate-600 font-medium">
                    {schedule}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic">Jam praktek belum diatur</div>
              )}
            </div>
          </div>

          <Button 
            className={cn(
              "w-full h-10 font-bold transition-all duration-300 rounded-full",
              isSelected 
                ? "bg-[#1e3a8a] hover:bg-[#172554] text-white" 
                : "bg-white text-[#1e3a8a] border-2 border-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white"
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

export default TherapistCard;