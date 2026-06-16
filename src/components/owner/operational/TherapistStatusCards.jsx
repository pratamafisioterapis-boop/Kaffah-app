import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Check,
  Zap,
  AlertTriangle,
  Stethoscope,
  X
} from 'lucide-react';

const TherapistStatusCards = ({
  therapists = [],
  therapistSessions = {},
  isLoading = false
}) => {

  const getStatusData = (therapist) => {
    const sessions = therapistSessions[therapist.id] || 0;
    const totalSlots = therapist.total_slots || 0;

    let percentage = 0;

    if (sessions === 0) percentage = 0;
    else if (sessions <= 2) percentage = 40;
    else if (sessions <= 4) percentage = 70;
    else percentage = 100;

    if (!therapist.is_active) {
      return {
        label: 'NON ACTIVE',
        icon: X,
        color: 'bg-gray-600',
        percentage,
        sessions,
        totalSlots
      };
    }

    if (
      therapist.leave_status &&
      ['cuti', 'sakit'].includes(
        therapist.leave_status.toLowerCase()
      )
    ) {
      return {
        label: therapist.leave_status.toUpperCase(),
        icon: Stethoscope,
        color: 'bg-gray-500',
        percentage,
        sessions,
        totalSlots
      };
    }

    if (percentage > 75) {
      return {
        label: 'BUSY',
        icon: Zap,
        color: 'bg-amber-500',
        percentage,
        sessions,
        totalSlots
      };
    }

    return {
      label: 'AVAILABLE',
      icon: Check,
      color: 'bg-emerald-500',
      percentage,
      sessions,
      totalSlots
    };
  };

  const getInitials = (name = '') =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const sortedTherapists = [...therapists].map((t) => ({
    ...t,
    statusData: getStatusData(t)
  }));

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-44 rounded-3xl bg-slate-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!therapists.length) {
    return (
      <div className="p-10 text-center bg-slate-50 rounded-2xl border">
        Tidak ada data terapis
      </div>
    );
  }

  return (
    <div className="w-full">

      <h3 className="text-2xl font-bold text-slate-800 mb-5">
        Status Terapis
      </h3>

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          xl:grid-cols-2
          2xl:grid-cols-3
          gap-4
        "
      >
        {sortedTherapists.map((therapist) => {

          const {
            label,
            icon: Icon,
            color,
            percentage,
            sessions,
            totalSlots
          } = therapist.statusData;

          return (
            <Card
  key={therapist.id}
  className="
    overflow-hidden
    border-0
    rounded-3xl
    shadow-lg
    bg-white
    h-auto min-h-[210px]
  "
>
              <CardContent className="p-0">

                <div className="flex h-full">

                  {/* FOTO */}

                  <div
                    className={`
                      ${color}
                      w-24 md:w-32
                      min-h-[170px]
                      flex
                      flex-col
                      items-center
                      justify-center
                      text-white
                      p-4
                    `}
                  >

                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20">

                      {therapist.avatar_url ? (
                        <img
                          src={therapist.avatar_url}
                          alt={therapist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xl">
                          {getInitials(therapist.name)}
                        </div>
                      )}

                    </div>

                    <div className="mt-3">

                      <Icon className="w-6 h-6" />

                    </div>

                  </div>

                  {/* KONTEN */}

                  <div className="flex-1 p-5">

                    <div className="flex justify-between items-start gap-3">

                      <div className="flex-1 min-w-0">

                        <h4
  className="
    text-lg
    font-bold
    text-slate-800
    leading-snug
    break-words
    line-clamp-2
  "
>
                          {therapist.name}
                        </h4>

                        <div className="text-sm text-slate-500 mt-1">
                          {therapist.specialization ||
                            'Physiotherapist'}
                        </div>

                      </div>

                      <div
  className={`
    ${color}
    text-white
    px-2
    md:px-3
    py-1
    rounded-full
    text-[10px]
    md:text-xs
    font-bold
    shrink-0
    max-w-[90px]
    truncate
  `}
>
                        {label}
                      </div>

                    </div>

                    <div className="
mt-5
grid
grid-cols-2
sm:grid-cols-3
gap-3
">

                      <div>
                        <div className="text-3xl font-bold text-slate-900">
                          {sessions}
                        </div>

                        <div className="text-xs text-slate-500">
                          Sesi Hari Ini
                        </div>
                      </div>

                      <div>
                        <div className="text-3xl font-bold text-slate-900">
                          {percentage}%
                        </div>

                        <div className="text-xs text-slate-500">
                          Load
                        </div>
                      </div>

                      <div>
                        <div className="text-3xl font-bold text-slate-900">
                          {totalSlots}
                        </div>

                        <div className="text-xs text-slate-500">
                          Slot
                        </div>
                      </div>

                    </div>

                    <div className="mt-5">

                      <div className="flex justify-between text-xs mb-2 text-slate-500">

                        <span>Load Capacity</span>

                        <span>{percentage}%</span>

                      </div>

                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                        <div
                          className={`h-full ${color}`}
                          style={{
                            width: `${Math.min(
                              percentage,
                              100
                            )}%`
                          }}
                        />

                      </div>

                    </div>

                  </div>

                </div>

              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
};

export default TherapistStatusCards;