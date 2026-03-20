import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Award, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TherapistProfileCard = ({ therapist, isSelected, onSelect, showSelectButton = false }) => {
  const navigate = useNavigate();
  const [showBioModal, setShowBioModal] = useState(false);
  
  const bioText = therapist.bio || 'Profesional berpengalaman dalam menangani berbagai kondisi muskuloskeletal dan rehabilitasi fisik.';
  const isLongBio = bioText.length > 100;

  const handleAction = (e) => {
    e?.stopPropagation();
    if (onSelect && typeof onSelect === 'function') {
      onSelect(therapist.id);
    } else {
      navigate(`/booking?therapist_id=${therapist.id}`);
    }
  };

  const handleOpenBio = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBioModal(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className={`
          relative group overflow-hidden rounded-xl border-2 transition-all duration-300 h-full flex flex-col
          ${isSelected
            ? 'border-blue-500 bg-gradient-to-b from-blue-50 to-white shadow-xl ring-2 ring-blue-200' 
            : 'border-white bg-white/60 hover:border-blue-200 hover:shadow-lg backdrop-blur-sm'
          }
        `}
      >
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-all duration-300 pointer-events-none z-0" />
        
        {/* Top Section */}
        <div className="p-6 pb-2 flex flex-col items-center text-center relative z-10">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-teal-400 shadow-md">
              <Avatar className="w-full h-full border-2 border-white">
                <AvatarImage src={therapist.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-slate-100 text-slate-400">
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
            </div>
            {isSelected && (
              <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in">
                <Award className="w-4 h-4" />
              </div>
            )}
          </div>

          <h3 className="font-bold text-lg text-slate-900 mb-1">{therapist.name}</h3>
          <p className="text-blue-600 font-medium text-sm">{therapist.specialization || 'Fisioterapis'}</p>

          {/* Badges */}
          {Array.isArray(therapist.badges) && therapist.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
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

        {/* Bio Section with Dialog Trigger */}
        <div className="px-6 flex-grow relative z-10 flex flex-col items-center w-full">
          <div className="bg-slate-50/80 rounded-lg p-3 w-full mb-5 flex-grow">
            <div className="cursor-help" onClick={(e) => isLongBio && handleOpenBio(e)}>
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed text-center">
                {bioText}
              </p>
            </div>

            {isLongBio && (
              <div className="mt-2 text-center">
                <button 
                  className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline transition-all font-medium cursor-pointer"
                  onClick={handleOpenBio}
                >
                  Lihat selengkapnya…
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Button Section - Conditionally Rendered */}
        {showSelectButton && (
          <div className="p-6 pt-0 mt-auto relative z-10">
            <Button 
              variant={isSelected ? "default" : "outline"} 
              className={`w-full rounded-lg transition-all ${isSelected ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200' : 'hover:border-blue-300 hover:text-blue-600'}`}
              onClick={handleAction}
            >
              {isSelected ? 'Terapis Terpilih' : 'Pilih Terapis Ini'}
              {!isSelected && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Bio Modal Dialog */}
      <Dialog open={showBioModal} onOpenChange={setShowBioModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none rounded-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-center">
             <div className="w-24 h-24 rounded-full p-1 bg-white/20 shadow-xl mx-auto mb-4">
                <Avatar className="w-full h-full border-4 border-blue-200">
                  <AvatarImage src={therapist.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 text-slate-400">
                    <User className="w-10 h-10" />
                  </AvatarFallback>
                </Avatar>
             </div>
             <DialogTitle className="text-white text-xl font-bold mb-1">{therapist.name}</DialogTitle>
             <p className="text-blue-100 font-medium">{therapist.specialization || 'Fisioterapis'}</p>
          </div>
          
          <div className="p-6">
             <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100 text-slate-600 text-sm leading-relaxed text-justify shadow-sm">
                {bioText}
             </div>

             {Array.isArray(therapist.badges) && therapist.badges.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">Keahlian & Sertifikasi</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {therapist.badges.map((badge, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-3 py-1 rounded-full font-medium border shadow-sm"
                      style={{ backgroundColor: badge.color, borderColor: 'rgba(0,0,0,0.05)' }}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
             
             <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6 font-bold text-base shadow-lg hover:shadow-blue-200/50 transition-all"
                onClick={(e) => {
                   setShowBioModal(false);
                   handleAction(e);
                }}
             >
                Pilih Terapis Ini <ArrowRight className="w-5 h-5 ml-2" />
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TherapistProfileCard;