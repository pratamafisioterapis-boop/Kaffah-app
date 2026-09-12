import React, { useMemo, useState } from 'react';
import { Search, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const getInitials = (name) => {
  if (!name) return 'TH';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

/**
 * Shared therapist picker used by Jadwal, Jadwal Pengganti & Cuti tabs. Only
 * shows active therapists (inactive ones have nothing to schedule/take leave
 * for here).
 */
const TherapistPickerGrid = ({ therapists, selectedId, onSelect, emptyLabel = 'Belum ada terapis aktif.' }) => {
  const [search, setSearch] = useState('');

  const activeTherapists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (therapists || [])
      .filter(t => t.is_active)
      .filter(t => !q || t.name?.toLowerCase().includes(q) || t.specialization?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [therapists, search]);

  return (
    <div className="space-y-3">
      {therapists?.filter(t => t.is_active).length > 6 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama terapis..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      )}

      {activeTherapists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
          <User className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm font-medium">{emptyLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {activeTherapists.map((t) => {
            const selected = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className={cn(
                  "group flex items-center gap-3.5 p-4 rounded-2xl border bg-white text-left transition-all",
                  selected
                    ? "border-blue-400 bg-blue-50/60 shadow-sm ring-1 ring-blue-200"
                    : "border-slate-200 hover:border-blue-200 hover:shadow-md"
                )}
              >
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm bg-slate-100">
                  {t.avatar_url ? (
                    <img
                      src={t.avatar_url}
                      alt={t.name}
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'high-quality' }}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className={cn(
                      "w-full h-full flex items-center justify-center font-bold text-base",
                      selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {getInitials(t.name)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-bold leading-snug truncate",
                    selected ? "text-blue-700" : "text-slate-800"
                  )}>
                    {t.name}
                  </p>
                  {t.specialization && (
                    <p className="text-xs text-slate-400 truncate">{t.specialization}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full", t.is_active ? "bg-emerald-500" : "bg-slate-300")} />
                    <span className="text-[11px] font-medium text-slate-400">
                      {t.is_active ? 'Aktif' : 'Non Aktif'}
                    </span>
                  </div>
                </div>

                <ChevronRight className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  selected ? "text-blue-500" : "text-slate-300 group-hover:text-slate-400"
                )} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TherapistPickerGrid;
