import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListChecks, Check, Loader2, PartyPopper, MessageSquarePlus, Check as CheckSaved } from 'lucide-react';
import { getTodayAdminChecklist, toggleAdminChecklistItem, updateAdminChecklistNote } from '@/lib/api';

const NoteField = ({ item, onSave }) => {
  const [value, setValue] = useState(item.note || '');
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setValue(item.note || '');
  }, [item.id]);

  const handleBlur = async () => {
    if (value === (item.note || '')) return;
    await onSave(item.id, value);
    setSaved(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSaved(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mt-2.5 relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          placeholder="Catatan / laporan singkat (opsional)... contoh: 12 pasien di-follow up, kunjungan kemarin 34 pasien"
          rows={2}
          className="w-full text-xs sm:text-sm bg-white/[0.06] border border-white/10 focus:border-[#b8935f]/50 focus:bg-white/[0.09] rounded-xl px-3.5 py-2.5 text-slate-200 placeholder:text-slate-500 outline-none resize-none transition-colors"
        />
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 right-2 flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
            >
              <CheckSaved className="w-2.5 h-2.5" /> Tersimpan
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const AdminDailyChecklistWidget = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState([]);

  const fetchChecklist = async () => {
    setLoading(true);
    const { data, error } = await getTodayAdminChecklist();
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const handleToggle = async (item) => {
    setTogglingId(item.id);
    const newValue = !item.is_done;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: newValue } : i));
    if (newValue) {
      setExpandedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
    }

    const { error } = await toggleAdminChecklistItem(item.id, newValue);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: !newValue } : i));
    }
    setTogglingId(null);
  };

  const handleSaveNote = async (itemId, note) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, note } : i));
    await updateAdminChecklistNote(itemId, note);
  };

  const toggleExpand = (itemId) => {
    setExpandedIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  };

  const total = items.length;
  const doneCount = items.filter(i => i.is_done).length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  if (loading || total === 0) {
    return null; // Tidak tampil sama sekali kalau owner belum setup checklist, atau saat masih memuat data
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0f1e3d] via-[#132348] to-[#0f1e3d] border border-white/5 shadow-[0_25px_60px_-25px_rgba(15,30,61,0.5)]">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#b8935f]/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#1e3a8a]/20 rounded-full blur-3xl" />

      <div className="relative z-10 p-5 sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#b8935f] to-[#d4b378] flex items-center justify-center shadow-lg shadow-[#b8935f]/20 shrink-0">
              <ListChecks className="w-5 h-5 text-[#0f1e3d]" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">Checklist Admin Harian</h3>
              <p className="text-slate-400 text-xs sm:text-sm">Tugas operasional yang wajib diselesaikan hari ini</p>
            </div>
          </div>

          {total > 0 && (
            <div className="hidden sm:flex flex-col items-end shrink-0">
              <span className="text-2xl font-black text-white leading-none">{percent}%</span>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5">{doneCount}/{total} selesai</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mb-6">
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${allDone ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-[#b8935f] to-[#d4b378]'}`}
              />
            </div>
            <div className="flex sm:hidden justify-between mt-2">
              <span className="text-xs text-slate-400 font-medium">{doneCount}/{total} selesai</span>
              <span className="text-xs text-white font-bold">{percent}%</span>
            </div>
          </div>
        )}

        {/* List */}
        {allDone ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center mb-3 ring-1 ring-emerald-400/30">
              <PartyPopper className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-white font-bold text-sm sm:text-base">Semua tugas hari ini selesai 🎉</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Kerja bagus, pertahankan konsistensinya.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const isExpanded = expandedIds.includes(item.id);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`w-full rounded-2xl border transition-all duration-200 ${
                      item.is_done
                        ? 'bg-white/[0.04] border-white/5'
                        : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.09] hover:border-[#b8935f]/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3.5 sm:p-4">
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={togglingId === item.id}
                        className={`flex items-center justify-center w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 transition-all duration-200 ${
                          item.is_done
                            ? 'bg-gradient-to-br from-[#b8935f] to-[#d4b378] border-transparent'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {togglingId === item.id ? (
                          <Loader2 className="w-3 h-3 text-white animate-spin" />
                        ) : item.is_done ? (
                          <Check className="w-3.5 h-3.5 text-[#0f1e3d]" strokeWidth={3} />
                        ) : null}
                      </button>

                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleToggle(item)}
                      >
                        <p className={`font-semibold text-sm sm:text-[15px] leading-snug transition-colors ${
                          item.is_done ? 'text-slate-500 line-through' : 'text-white'
                        }`}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className={`text-xs sm:text-sm mt-0.5 leading-relaxed ${
                            item.is_done ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            {item.description}
                          </p>
                        )}
                        {!isExpanded && item.note && (
                          <p className="text-xs text-[#d4b378] mt-1.5 italic line-clamp-1">"{item.note}"</p>
                        )}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                        title="Tambah catatan"
                        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                          item.note ? 'text-[#d4b378]' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <MessageSquarePlus className="w-4 h-4" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 -mt-1">
                          <NoteField item={item} onSave={handleSaveNote} />
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDailyChecklistWidget;