import React from 'react';
import { Check, Zap, Stethoscope, X, CalendarOff } from 'lucide-react';

const isPWA = (() => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  } catch { return false; }
})();

const TherapistStatusCards = ({
  therapists = [],
  therapistSessions = {},
  isLoading = false
}) => {

  const getStatusData = (therapist) => {
    const sessions = therapistSessions[therapist.id] || 0;
    const totalSlots = therapist.total_slots || 0;
    const percentage = totalSlots > 0 ? Math.round((sessions / totalSlots) * 100) : 0;

    if (!therapist.is_active) return { label: 'Non Aktif', icon: X, color: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', percentage, sessions, totalSlots };
    if (therapist.leave_status && ['cuti','sakit'].includes(therapist.leave_status.toLowerCase())) return { label: therapist.leave_status, icon: Stethoscope, color: 'bg-slate-500', ring: 'ring-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', percentage, sessions, totalSlots };
    if (totalSlots === 0) return { label: 'Tidak Ada Jadwal', icon: CalendarOff, color: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300', percentage, sessions, totalSlots };
    if (percentage > 75) return { label: 'Busy', icon: Zap, color: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', percentage, sessions, totalSlots };
    return { label: 'Available', icon: Check, color: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', percentage, sessions, totalSlots };
  };

  const getInitials = (name = '') =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-36 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!therapists.length) {
    return (
      <div className="p-10 text-center bg-slate-50 rounded-2xl border text-slate-400 text-sm">
        Tidak ada data terapis
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Status Terapis Hari Ini</h3>
        <span className="text-xs text-slate-400 font-medium">{therapists.length} terapis aktif</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {therapists.map((therapist) => {
          const { label, icon: Icon, color, ring, text, badge, bar, percentage, sessions, totalSlots } = getStatusData(therapist);

          return (
            <div
              key={therapist.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              {/* ── Desktop: layout vertikal lebih besar ── */}
              {!isPWA ? (
                <>
                  {/* ── Header card: putih bersih ── */}
                  <div className="p-5 flex items-center gap-4">
                    {/* Avatar dengan ring warna status */}
                    <div className={`relative shrink-0`}>
                      <div className={`w-16 h-16 rounded-2xl overflow-hidden ring-2 ${ring}`}>
                        {therapist.avatar_url ? (
                          <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center font-bold text-lg text-white ${color}`}>
                            {getInitials(therapist.name)}
                          </div>
                        )}
                      </div>
                      {/* Status dot */}
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${color} border-2 border-white flex items-center justify-center shadow-sm`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">{therapist.name}</h4>
                        <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${badge}`}>{label}</span>
                      </div>
                      <p className="text-xs text-slate-400">{therapist.specialization || 'Physiotherapist'}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 mx-5" />

                  {/* Stats */}
                  <div className="p-5 pt-4">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center bg-slate-50 rounded-xl py-3 px-2">
                        <p className="text-2xl font-black text-slate-900 leading-none">{sessions}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1.5 uppercase tracking-wider">Sesi</p>
                      </div>
                      <div className="text-center bg-slate-50 rounded-xl py-3 px-2">
                        <p className={`text-2xl font-black leading-none ${text}`}>{percentage}%</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1.5 uppercase tracking-wider">Load</p>
                      </div>
                      <div className="text-center bg-slate-50 rounded-xl py-3 px-2">
                        <p className="text-2xl font-black text-slate-900 leading-none">{totalSlots}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1.5 uppercase tracking-wider">Slot</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1.5">
                        <span>Load Capacity</span>
                        <span className={`font-bold ${text}`}>{percentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${bar}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* ── PWA: layout horizontal compact ── */}
                  <div className="flex items-center gap-3 p-4">
                    <div className={`relative shrink-0 ring-2 ${ring} rounded-xl`}>
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                        {therapist.avatar_url ? (
                          <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center font-bold text-sm text-white ${color}`}>
                            {getInitials(therapist.name)}
                          </div>
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${color} border-2 border-white flex items-center justify-center`}>
                        <Icon className="w-2 h-2 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{therapist.name}</h4>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-black text-slate-900">{sessions} <span className="font-medium text-slate-400">sesi</span></span>
                        <span className={`text-xs font-black ${text}`}>{percentage}%</span>
                        <span className="text-xs font-black text-slate-900">{totalSlots} <span className="font-medium text-slate-400">slot</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TherapistStatusCards;