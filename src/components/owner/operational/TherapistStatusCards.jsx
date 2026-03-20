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
    let percentage = 0;
    if (totalSlots > 0) {
      percentage = (sessions / totalSlots) * 100;
    } else if (sessions > 0) {
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
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {sortedTherapists.map((therapist) => {
          const { statusData } = therapist;
          const { label, gradient, icon: Icon, percentage, sessions, totalSlots } = statusData;

          return (
            <Card 
              key={therapist.id} 
              className={cn(
                "relative overflow-hidden rounded-xl border-0 shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group",
                `bg-gradient-to-br ${gradient}`
              )}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col h-full justify-between text-white">
                
                {/* Top Row: Avatar & Status Icon */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm font-bold border border-white/30 shadow-inner">
                      {therapist.avatar_url ? (
                        <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{getInitials(therapist.name)}</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="font-bold text-[16px] md:text-[17px] leading-tight line-clamp-1" title={therapist.name}>
                        {therapist.name}
                      </h4>
                      <span className="text-[10px] opacity-90 font-medium tracking-wider uppercase">
                        {therapist.specialization || 'Physiotherapist'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-1.5 rounded-full bg-white/20 backdrop-blur-md shadow-sm">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Middle Row: Metrics */}
                <div className="mb-4">
                   <div className="flex items-end gap-2 mb-1">
                      <span className="text-[28px] md:text-[32px] font-bold leading-none">
                        {sessions}
                      </span>
                      <span className="text-sm font-medium opacity-80 mb-1.5">
                        / {totalSlots} Sesi
                      </span>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 border border-white/20 uppercase tracking-wide">
                        {label}
                      </span>
                      <span className="text-xs font-medium opacity-90">
                        {Math.round(percentage)}% Load
                      </span>
                   </div>
                </div>

                {/* Bottom: Progress Bar */}
                <div className="w-full">
                  <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000 ease-out rounded-full"
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
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