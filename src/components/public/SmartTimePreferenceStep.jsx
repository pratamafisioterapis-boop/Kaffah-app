import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WHEN_OPTIONS, TIME_WINDOWS } from '@/lib/complaintTags';

const SmartTimePreferenceStep = ({ initialData, onBack, onNext }) => {
  const [whenId, setWhenId] = useState(initialData?.whenId || '');
  const [customDate, setCustomDate] = useState(initialData?.customDate || '');
  const [windowId, setWindowId] = useState(initialData?.windowId || '');
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!whenId) return setError('Pilih kapan Anda ingin melakukan terapi.');
    if (whenId === 'custom' && !customDate) return setError('Pilih tanggal khusus terlebih dahulu.');
    if (!windowId) return setError('Pilih waktu yang Anda inginkan.');
    setError('');
    onNext({ whenId, customDate: whenId === 'custom' ? customDate : null, windowId });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Waktu yang Diinginkan</h2>
              <p className="text-blue-100 text-sm mt-0.5">Langkah 3 dari 3 — kami cari jadwal terbaik untuk Anda</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-7 sm:space-y-8">
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Kapan Anda ingin terapi?</Label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {WHEN_OPTIONS.map(opt => {
                const isSelected = whenId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setWhenId(opt.id); setError(''); }}
                    className={cn(
                      "relative text-left px-4 py-3.5 rounded-2xl border transition-all",
                      isSelected
                        ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-md shadow-blue-900/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-[#1e3a8a]/30 hover:bg-white"
                    )}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 bg-white/20 rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <span className="block font-semibold text-sm">{opt.label}</span>
                    <span className={cn("block text-xs mt-0.5", isSelected ? "text-blue-100" : "text-slate-400")}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {whenId === 'custom' && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                <Input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={customDate}
                  onChange={(e) => { setCustomDate(e.target.value); setError(''); }}
                  className="h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Jam berapa yang Anda inginkan?</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {TIME_WINDOWS.map(win => {
                const isSelected = windowId === win.id;
                return (
                  <button
                    key={win.id}
                    type="button"
                    onClick={() => { setWindowId(win.id); setError(''); }}
                    className={cn(
                      "text-center px-3 py-3.5 rounded-2xl border transition-all",
                      isSelected
                        ? "bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-md shadow-blue-900/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-[#1e3a8a]/30 hover:bg-white"
                    )}
                  >
                    <span className="block font-semibold text-sm">{win.label}</span>
                    <span className={cn("block text-[11px] mt-0.5", isSelected ? "text-blue-100" : "text-slate-400")}>{win.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          <Button
            onClick={handleContinue}
            className="w-full h-12 sm:h-13 text-base sm:text-lg font-bold rounded-full bg-[#1e3a8a] hover:bg-[#172554] shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Cari Rekomendasi <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default SmartTimePreferenceStep;
