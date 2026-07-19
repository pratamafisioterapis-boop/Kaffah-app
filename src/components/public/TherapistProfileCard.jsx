import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Award, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getTherapistPracticeHoursGrouped } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TherapistProfileCard = ({ therapist, isSelected, onSelect, showSelectButton = false }) => {
  const navigate = useNavigate();
  const [showBioModal, setShowBioModal] = useState(false);
  const [practiceHours, setPracticeHours] = useState([]);

  useEffect(() => {
    if (!therapist?.id) return;
    let isMounted = true;

    getTherapistPracticeHoursGrouped(therapist.id).then(({ data }) => {
      if (!isMounted || !data) return;
      setPracticeHours(
        data
          .filter(g => g.day_range)
          .map(g => `${g.day_range}: ${g.display_start_time?.slice(0, 5)} - ${g.display_end_time?.slice(0, 5)}`)
      );
    });

    return () => { isMounted = false; };
  }, [therapist?.id]);

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
        whileHover={{ scale: 1.015 }}
        transition={{ duration: 0.25 }}
        className={`
          relative group overflow-hidden rounded-2xl transition-all duration-300 h-full flex flex-col
          ${isSelected
            ? 'border border-[#b8935f]/40 bg-gradient-to-b from-[#0f1e3d]/[0.03] to-white shadow-[0_25px_60px_-25px_rgba(15,30,61,0.4)] ring-1 ring-[#b8935f]/30'
            : 'border border-slate-200/70 bg-white shadow-[0_10px_30px_-20px_rgba(15,30,61,0.15)] hover:border-[#0f1e3d]/15 hover:shadow-[0_20px_45px_-22px_rgba(15,30,61,0.25)]'
          }
        `}
      >
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#b8935f] via-[#0f1e3d] to-[#b8935f]" />
        )}

        {/* Top Section */}
        <div className="p-6 pb-2 flex flex-col items-center text-center relative z-10">
          <div className="relative mb-4">
            <div className={`w-24 h-24 rounded-full p-1 shadow-md ${isSelected ? 'bg-gradient-to-tr from-[#0f1e3d] to-[#b8935f]' : 'bg-gradient-to-tr from-slate-200 to-slate-100'}`}>
              <Avatar className="w-full h-full border-2 border-white">
                <AvatarImage src={therapist.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-slate-100 text-slate-400">
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
            </div>
            {isSelected && (
              <div className="absolute -bottom-2 -right-2 bg-[#0f1e3d] text-[#e8c98a] p-1.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in">
                <Award className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#b8935f]" />
            <span className="text-[10px] font-bold tracking-[0.12em] text-[#b8935f] uppercase">Certified Therapist</span>
          </div>

          <h3 className="font-bold text-lg text-[#0f1e3d] mb-1">{therapist.name}</h3>
          <p className="text-slate-500 font-medium text-sm">{therapist.specialization || 'Fisioterapis'}</p>

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

        {/* Bio & Practice Hours Section */}
        <div className="px-6 flex-grow relative z-10 flex flex-col items-center w-full gap-3">
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 w-full min-h-[64px] flex flex-col justify-center">
            <div className="cursor-help" onClick={(e) => isLongBio && handleOpenBio(e)}>
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed text-center">
                {bioText}
              </p>
            </div>

            {isLongBio && (
              <div className="mt-2 text-center">
                <button
                  className="text-[11px] text-[#0f1e3d] hover:text-[#b8935f] hover:underline transition-all font-semibold cursor-pointer"
                  onClick={handleOpenBio}
                >
                  Lihat selengkapnya…
                </button>
              </div>
            )}
          </div>

          {practiceHours.length > 0 && (
            <div className="w-full bg-[#b8935f]/[0.06] border border-[#b8935f]/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 justify-center text-[10px] font-bold text-[#b8935f] uppercase tracking-wider mb-1.5">
                <Clock className="w-3 h-3" /> Jam Praktek
              </div>
              <div className="space-y-0.5">
                {practiceHours.slice(0, 2).map((schedule, idx) => (
                  <p key={idx} className="text-xs text-slate-600 font-medium text-center">
                    {schedule}
                  </p>
                ))}
                {practiceHours.length > 2 && (
                  <p className="text-[10px] text-slate-400 text-center pt-0.5">
                    +{practiceHours.length - 2} jadwal lainnya
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Button Section */}
        {showSelectButton && (
          <div className="p-6 pt-0 mt-auto relative z-10">
            <Button
              className={`w-full rounded-xl transition-all font-semibold ${
                isSelected
                  ? 'bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] hover:from-[#0b1830] hover:to-[#172554] text-white shadow-md shadow-[#0f1e3d]/25'
                  : 'bg-white border border-slate-200 text-[#0f1e3d] hover:border-[#b8935f]/40 hover:bg-[#0f1e3d]/[0.02]'
              }`}
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
          <div className="bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] p-6 text-center">
             <div className="w-24 h-24 rounded-full p-1 bg-white/10 shadow-xl mx-auto mb-4 ring-1 ring-[#b8935f]/40">
                <Avatar className="w-full h-full border-4 border-white/20">
                  <AvatarImage src={therapist.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 text-slate-400">
                    <User className="w-10 h-10" />
                  </AvatarFallback>
                </Avatar>
             </div>
             <DialogTitle className="text-white text-xl font-bold mb-1">{therapist.name}</DialogTitle>
             <p className="text-[#e8c98a] font-medium text-sm">{therapist.specialization || 'Fisioterapis'}</p>
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
                className="w-full bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] hover:from-[#0b1830] hover:to-[#172554] rounded-xl py-6 font-bold text-base shadow-lg hover:shadow-[#0f1e3d]/30 transition-all"
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