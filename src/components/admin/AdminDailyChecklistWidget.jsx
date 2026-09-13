import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Check, Loader2, PartyPopper, MoreVertical, Clock,
  MessageCircle, Landmark, Camera, Database, Users, FileText, CheckCircle2
} from 'lucide-react';
import { getTodayAdminChecklist, toggleAdminChecklistItem, updateAdminChecklistNote } from '@/lib/api';

const getItemVisual = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('whatsapp') || t.includes('reminder')) {
    return { Icon: MessageCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' };
  }
  if (t.includes('recap') || t.includes('pembukuan') || t.includes('cocokkan') || t.includes('bank')) {
    return { Icon: Landmark, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' };
  }
  if (t.includes('pembayaran') || t.includes('cash')) {
    return { Icon: Camera, iconBg: 'bg-red-100', iconColor: 'text-red-500' };
  }
  if (t.includes('kosong') || t.includes('data')) {
    return { Icon: Database, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' };
  }
  if (t.includes('follow up') || t.includes('pasien')) {
    return { Icon: Users, iconBg: 'bg-teal-100', iconColor: 'text-teal-600' };
  }
  if (t.includes('laporan') || t.includes('owner')) {
    return { Icon: FileText, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' };
  }
  return { Icon: ClipboardList, iconBg: 'bg-slate-100', iconColor: 'text-slate-500' };
};

const formatTime = (isoString) => {
  if (!isoString) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(isoString));
  } catch {
    return '-';
  }
};

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
          className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl px-3.5 py-2.5 text-slate-700 placeholder:text-slate-400 outline-none resize-none transition-colors"
        />
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
            >
              <Check className="w-2.5 h-2.5" /> Tersimpan
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

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: newValue, completed_at: newValue ? new Date().toISOString() : null } : i));

    const { error } = await toggleAdminChecklistItem(item.id, newValue);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: !newValue, completed_at: item.completed_at } : i));
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
    <div className="relative overflow-hidden rounded-[28px] bg-white border border-slate-100 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.2)]">
      <div className="relative z-10 p-5 sm:p-7">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-slate-900 font-extrabold text-lg sm:text-xl tracking-tight">Checklist Admin Harian</h3>
              <p className="text-slate-400 text-xs sm:text-sm">Tugas operasional yang wajib diselesaikan hari ini</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="min-w-[170px]">
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <span className="text-xs sm:text-sm text-slate-500 font-semibold whitespace-nowrap">Progress Hari Ini</span>
                <span className="text-xs sm:text-sm text-slate-400 font-medium whitespace-nowrap">{doneCount} / {total} selesai</span>
              </div>
              <div className="h-2.5 w-full sm:w-48 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full ${allDone ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-blue-400'}`}
                />
              </div>
            </div>

            <div className="text-3xl sm:text-4xl font-black text-slate-900 leading-none">{percent}%</div>

            <div className="flex items-center gap-2.5 bg-blue-50 rounded-2xl px-4 py-2.5">
              <span className="text-xl leading-none">{allDone ? '🎉' : '☀️'}</span>
              <div className="leading-tight">
                <p className="text-blue-600 font-bold text-xs sm:text-sm">{allDone ? 'Semua beres!' : 'Sedikit lagi!'}</p>
                <p className="text-blue-500/80 text-[11px] sm:text-xs font-medium">Tetap semangat 🙌</p>
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        {allDone ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3 ring-1 ring-emerald-200">
              <PartyPopper className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-slate-900 font-bold text-sm sm:text-base">Semua tugas hari ini selesai 🎉</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Kerja bagus, pertahankan konsistensinya.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const isExpanded = expandedIds.includes(item.id);
                const { Icon, iconBg, iconColor } = getItemVisual(item.title);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="w-full rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/70 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4">
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={togglingId === item.id}
                        className={`flex items-center justify-center w-6 h-6 rounded-lg border-2 shrink-0 transition-all duration-200 ${
                          item.is_done
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {togglingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        ) : item.is_done ? (
                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        ) : null}
                      </button>

                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                      </div>

                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleToggle(item)}
                      >
                        <p className="font-bold text-sm sm:text-[15px] leading-snug text-slate-900">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs sm:text-sm mt-0.5 leading-relaxed text-slate-400">
                            {item.description}
                          </p>
                        )}
                        {!isExpanded && item.note && (
                          <p className="text-xs text-blue-500 mt-1.5 italic line-clamp-1">"{item.note}"</p>
                        )}
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        {item.is_done ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 font-semibold text-xs px-3 py-1.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 text-white" />
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-400 font-semibold text-xs px-3 py-1.5 rounded-full">
                            <Clock className="w-3.5 h-3.5" />
                            Belum dikerjakan
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">{item.is_done ? formatTime(item.completed_at) : '-'}</span>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                        title="Tambah catatan"
                        className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical className="w-4.5 h-4.5" />
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
