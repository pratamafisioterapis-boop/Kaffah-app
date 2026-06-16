import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Check, 
  Zap, 
  AlertTriangle, 
  Stethoscope, 
  X,
  User 
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';

const TherapistStatusCards = ({ therapists = [], therapistSessions = {}, isLoading = false }) => {
  
  // Helper to determine status and styling
  const getStatusData = (therapist) => {
    const sessions = therapistSessions[therapist.id] || 0;
    const totalSlots = therapist.total_slots || 0;
    // Calculate load percentage (0 if no slots to avoid division by zero)
    // If sessions > 0 but slots = 0, technically infinite load, cap at 100% or treat as overload
    // 🔥 sementara: pakai session saja (karena totalSlots belum valid)
let percentage = 0;

if (sessions === 0) {
  percentage = 0;
} else if (sessions <= 2) {
  percentage = 40;
} else if (sessions <= 4) {
  percentage = 70;
} else {
  percentage = 100;
}

    // 1. NON ACTIVE
    if (!therapist.is_active) {
      return {
        rank: 5,
        label: 'NON ACTIVE',
        gradient: 'from-gray-600 to-gray-700', // #4B5563 -> #374151
        icon: X,
        percentage,
        sessions,
        totalSlots
      };
    }

    // 2. CUTI/SAKIT
    // Check if leave_status exists and is not 'aktif' or null
    if (therapist.leave_status && ['cuti', 'sakit'].includes(therapist.leave_status.toLowerCase())) {
      return {
        rank: 4,
        label: therapist.leave_status.toUpperCase(),
        gradient: 'from-gray-400 to-gray-500', // #9CA3AF -> #6B7280
        icon: Stethoscope,
        percentage,
        sessions,
        totalSlots
      };
    }

    // 3. OVERLOAD (> 100%)
    if (percentage > 100) {
      return {
        rank: 3,
        label: 'OVERLOAD',
        gradient: 'from-red-500 to-red-600', // #EF4444 -> #DC2626
        icon: AlertTriangle,
        percentage,
        sessions,
        totalSlots
      };
    }

    // 4. BUSY (> 75% and <= 100%)
    if (percentage > 75) {
      return {
        rank: 2,
        label: 'BUSY',
        gradient: 'from-amber-500 to-amber-600', // #F59E0B -> #D97706
        icon: Zap,
        percentage,
        sessions,
        totalSlots
      };
    }

    // 5. AVAILABLE (<= 75%)
    return {
      rank: 1,
      label: 'AVAILABLE',
      gradient: 'from-emerald-500 to-emerald-600', // #10B981 -> #059669
      icon: Check,
      percentage,
      sessions,
      totalSlots
    };
  };

  // Sort therapists logic
  const sortedTherapists = [...therapists].map(t => ({
    ...t,
    statusData: getStatusData(t)
  })).sort((a, b) => {
    // Primary Sort: Rank (1 to 5)
    if (a.statusData.rank !== b.statusData.rank) {
      return a.statusData.rank - b.statusData.rank;
    }
    // Secondary Sort: Name Alphabetical
    return a.name.localeCompare(b.name);
  });

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="w-full py-16">
        <h3 className="text-lg font-bold text-slate-800 mb-6 px-1">Status Terapis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
             <Card key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse border-none shadow-none" />
          ))}
        </div>
      </div>
    );
  }

  if (!therapists || therapists.length === 0) {
    return (
       <div className="py-16 text-center text-slate-500 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
          No therapists found.
       </div>
    );
  }

  return (
    <div className="w-full py-8">
      <h3 className="text-xl font-bold text-slate-800 mb-6 px-1">Status Terapis</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 px-1">
        {sortedTherapists.map((therapist) => {
          const { statusData } = therapist;
          const { label, gradient, icon: Icon, percentage, sessions, totalSlots } = statusData;

          return (
            <Card 
  key={therapist.id} 
  className={cn(
  "relative overflow-hidden rounded-3xl border-0 shadow-xl cursor-pointer transition-all duration-300 active:scale-[0.98] group",
  "h-[150px] sm:h-[190px] lg:h-[210px]",
  `bg-gradient-to-br ${gradient}`
)}
>
              <CardContent className="p-4 flex flex-col h-full text-white relative z-10">
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-3xl -translate-y-8 translate-x-8" />

<div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl translate-y-6 -translate-x-6" />
                {/* Top Row: Avatar & Status Icon */}
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm font-bold border border-white/30 shadow-inner">
                      {therapist.avatar_url ? (
                        <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{getInitials(therapist.name)}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4
  className="font-bold text-[12px] sm:text-[15px] leading-tight truncate max-w-[70px] sm:max-w-none"
  title={therapist.name}
>
  {therapist.name}
</h4>

<span
  className="hidden sm:block text-[11px] opacity-80 font-medium"
>
  {therapist.specialization || 'Physiotherapist'}
</span>
                    </div>
                  </div>
                  
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
  <Icon className="w-5 h-5 text-white" />
</div>
                </div>

                {/* Middle Row: Metrics */}
                <div className="mb-4">
                   <div className="flex items-end gap-2 mb-1">
                      <div className="mb-5">
  <div className="flex items-center justify-between mb-3">
    <div>
      <div className="text-[34px] font-extrabold leading-none">
        {sessions}
      </div>
      <div className="text-xs opacity-80 mt-1">
        Total Sesi Hari Ini
      </div>
    </div>

    <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold border border-white/20">
      {label}
    </div>
  </div>

  <div className="text-sm opacity-90">
    Load Kerja: {Math.round(percentage)}%
  </div>
</div>
                      <span className="text-sm font-medium opacity-80 mb-1.5">
                        / {totalSlots} Sesi
                      </span>
                   </div>
                </div>

                {/* Bottom: Progress Bar */}
                <div className="w-full">
                  <div className="space-y-2">
  <div className="flex justify-between text-xs font-medium">
    <span>Load Capacity</span>
    <span>{Math.round(percentage)}%</span>
  </div>

  <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
    <div
      className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(255,255,255,0.7)]"
      style={{ width: `${Math.min(100, percentage)}%` }}
    />
  </div>
</div>
                </div>

              </CardContent>
              
              {/* Decorative background element */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TherapistStatusCards;