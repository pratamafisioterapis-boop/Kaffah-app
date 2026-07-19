import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Stethoscope, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COMPLAINT_TAGS } from '@/lib/complaintTags';

const SmartComplaintStep = ({ initialSelection, initialNote, onBack, onNext }) => {
  const [selected, setSelected] = useState(initialSelection || []);
  const [note, setNote] = useState(initialNote || '');
  const [error, setError] = useState('');

  const toggle = (slug) => {
    setError('');
    setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      setError('Pilih minimal satu keluhan agar kami bisa merekomendasikan terapis yang tepat.');
      return;
    }
    if (!note.trim()) {
      setError('Mohon ceritakan keluhan Anda lebih detail.');
      return;
    }
    onNext(selected, note.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4 pb-28"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Keluhan yang Dirasakan</h2>
              <p className="text-blue-100 text-sm mt-0.5">Langkah 2 dari 3 — boleh pilih lebih dari satu</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {COMPLAINT_TAGS.map(tag => {
              const isSelected = selected.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => toggle(tag.slug)}
                  className={cn(
                    "relative flex items-center justify-center text-center gap-1.5 px-3 py-4 rounded-2xl border text-sm font-semibold transition-all min-h-[64px]",
                    isSelected
                      ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-md shadow-blue-900/20"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-[#1e3a8a]/30 hover:bg-white"
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 bg-white/20 rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  {tag.label}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mt-5">{error}</p>
          )}

          <div className="mt-6">
            <label htmlFor="complaint-note" className="block text-sm font-semibold text-slate-700 mb-2">
              Ceritakan lebih detail
            </label>
            <textarea
              id="complaint-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: nyeri punggung sejak 2 minggu terakhir, terasa lebih parah saat duduk lama..."
              rows={4}
              maxLength={500}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/40 transition-all resize-none"
            />
            <p className="text-right text-[11px] text-slate-400 mt-1">{note.length}/500</p>
          </div>
        </div>
      </div>

      {/* Floating CTA */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 transition-all duration-300",
          selected.length > 0 ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-15px_40px_-15px_rgba(15,30,61,0.2)]">
          <div
            className="max-w-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          >
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{selected.length} keluhan dipilih</p>
            </div>
            <Button
              onClick={handleContinue}
              className="h-12 sm:h-14 px-6 sm:px-10 rounded-full bg-gradient-to-r from-[#0f1e3d] to-[#1e3a8a] hover:from-[#0b1830] hover:to-[#172554] text-white font-bold shrink-0 flex items-center gap-2 shadow-lg shadow-[#0f1e3d]/30 text-sm sm:text-lg"
            >
              Lanjutkan <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SmartComplaintStep;
