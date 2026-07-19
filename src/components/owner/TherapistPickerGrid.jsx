import React, { useMemo, useState } from 'react';
import { Search, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const getInitials = (name) => {
  if (!name) return 'TH';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

/**
 * Shared therapist picker used by Jadwal & Cuti tabs. Only shows active
 * therapists (inactive ones have nothing to schedule/take leave for here).
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {activeTherapists.map((t) => {
            const selected = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className={cn(
                  "group flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center",
                  selected
                    ? "border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-200"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
                )}
              >
                <div className="relative shrink-0">
                  <div className={cn(
                    "w-14 h-14 rounded-full overflow-hidden ring-2 transition-all",
                    selected ? "ring-blue-500" : "ring-white group-hover:ring-blue-100"
                  )}>
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn(
                        "w-full h-full flex items-center justify-center font-bold text-sm",
                        selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {getInitials(t.name)}
                      </div>
                    )}
                  </div>
                  {selected && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-blue-600 text-white rounded-full p-0.5 shadow ring-2 ring-white">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-semibold leading-snug line-clamp-2",
                  selected ? "text-blue-700" : "text-slate-700"
                )}>
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TherapistPickerGrid;
