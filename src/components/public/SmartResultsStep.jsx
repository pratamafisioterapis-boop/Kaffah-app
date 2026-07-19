import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowLeft, Sparkles, Loader2, AlertTriangle, MessageCircle, CalendarDays, User, ShieldCheck, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { findSmartRecommendations } from '@/lib/smartBookingMatcher';
import { complaintLabel } from '@/lib/complaintTags';

const SmartResultsStep = ({ therapists, complaintSlugs, timePreference, preferredTherapistIds = [], onBack, onSelectSlot }) => {
  const [loading, setLoading] = useState(true);
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    findSmartRecommendations({
      therapists,
      complaintSlugs,
      whenId: timePreference.whenId,
      customDate: timePreference.customDate ? new Date(timePreference.customDate) : null,
      windowId: timePreference.windowId,
      preferredTherapistIds
    }).then(res => {
      if (isMounted) {
        setSearchResult(res);
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWhatsAppFallback = () => {
    const message = `Halo Admin Kaffah Physiotherapy,\n\nSaya sudah mencoba Smart Booking tapi belum menemukan jadwal yang cocok.\nKeluhan: ${complaintSlugs.map(complaintLabel).join(', ')}\n\nMohon bantuannya mencarikan jadwal. Terima kasih.`;
    window.open(`https://wa.me/6281233339435?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-4xl mx-auto px-4 py-2 sm:py-4 pb-16"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Ubah Kriteria
      </Button>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-blue-200/40 blur-xl" />
            <Loader2 className="w-11 h-11 animate-spin text-[#1e3a8a] relative" />
          </div>
          <p className="text-slate-500 font-semibold">Mencari terapis &amp; jadwal terbaik untuk Anda...</p>
        </div>
      ) : !searchResult || searchResult.results.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-amber-100">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Belum Ada Jadwal Tersedia</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Kami sudah mencoba mencari hingga 2 minggu ke depan tapi belum menemukan slot yang cocok. Admin kami akan bantu carikan jadwal terbaik untuk Anda.
          </p>
          <Button onClick={handleWhatsAppFallback} className="gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 h-12 px-6">
            <MessageCircle className="w-4 h-4" /> Hubungi Admin via WhatsApp
          </Button>
        </div>
      ) : (
        <>
          {(() => {
            const allSameDate = searchResult.results.every(
              r => r.date.toDateString() === searchResult.results[0].date.toDateString()
            );
            const first = searchResult.results[0];
            return (
              <div className={cn(
                "rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3",
                searchResult.exactMatch ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
              )}>
                {searchResult.exactMatch ? (
                  <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn("font-bold text-sm", searchResult.exactMatch ? "text-emerald-800" : "text-amber-800")}>
                    {searchResult.exactMatch ? 'Sesuai permintaan Anda!' : 'Waktu pilihan Anda penuh — ini alternatif terdekat'}
                  </p>
                  <p className={cn("text-sm mt-0.5 flex items-center gap-1.5 flex-wrap", searchResult.exactMatch ? "text-emerald-700" : "text-amber-700")}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    {allSameDate
                      ? `${format(first.date, 'EEEE, dd MMMM yyyy', { locale: idLocale })} · ${first.window.label} (${first.window.desc})`
                      : `Beberapa pilihan tanggal · ${first.window.label} (${first.window.desc})`}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {searchResult.results.map((r) => (
              <div
                key={`${r.therapist.id}_${r.date.toDateString()}_${r.window.id}`}
                className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_10px_30px_-20px_rgba(15,30,61,0.15)] p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-12 h-12 border-2 border-white shadow ring-1 ring-slate-100">
                    <AvatarImage src={r.therapist.avatar_url} className="object-cover" />
                    <AvatarFallback className="bg-slate-100 text-slate-400"><User className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0f1e3d] text-sm truncate">{r.therapist.name}</p>
                    <p className="text-xs text-slate-400 truncate">{r.therapist.specialization || 'Fisioterapis'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#1e3a8a]" />
                  {format(r.date, 'EEEE, dd MMM', { locale: idLocale })}
                </div>

                {r.isPreferred && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold mb-1.5">
                    <History className="w-3.5 h-3.5" /> Pernah menangani Anda
                  </div>
                )}

                {Array.isArray(r.therapist.complaint_tags) && r.therapist.complaint_tags.some(t => complaintSlugs.includes(t)) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#b8935f] font-semibold mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> Ahli menangani keluhan Anda
                  </div>
                )}

                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Pilih Jam</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {r.slots.map(slot => (
                    <button
                      key={`${r.therapist.id}_${slot.slot_start}`}
                      onClick={() => onSelectSlot(r.therapist, r.date, slot)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white hover:border-[#1e3a8a] transition-all"
                    >
                      {(slot.slot_start || '').slice(0, 5)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default SmartResultsStep;
