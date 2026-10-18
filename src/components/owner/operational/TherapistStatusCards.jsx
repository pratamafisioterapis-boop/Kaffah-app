import React, { useState } from 'react';
import { Check, Zap, Stethoscope, X, CalendarOff, AlertCircle, Users, Repeat2, UserCheck, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import FinanceTile from '@/components/owner/finance/FinanceTile';

const formatShortDate = (dateStr) => {
  try {
    return format(parseISO(dateStr), 'dd MMM', { locale: idLocale });
  } catch {
    return dateStr;
  }
};

// Gelar sering ditulis tanpa spasi setelah koma ("Pratama,S.Fis.,Ftr"); beri spasi
// supaya nama bisa turun baris di batas gelar, bukan terpotong di tengah kata.
const formatName = (name = '') => name.replace(/,(?=\S)/g, ', ');

const LEAVE_LABELS = {
  cuti: 'Cuti',
  sakit: 'Sakit',
  libur: 'Libur',
  training: 'Training',
  izin: 'Izin Pribadi',
  organisasi: 'Kegiatan Organisasi',
  event: 'Event',
  lainnya: 'Lainnya'
};

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'available', label: 'Available' },
  { key: 'busy', label: 'Busy' },
  { key: 'leave', label: 'Cuti/Libur' },
  { key: 'off', label: 'Non aktif' },
];

const getInitials = (name = '') =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const TherapistStatusCards = ({
  therapists = [],
  therapistSessions = {},
  isLoading = false,
  unfilledSoapCounts = {},
  isLoadingSoap = false,
  patientMetrics = {},
  isLoadingPatientMetrics = false,
  dateRange,
  className
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  // Terapis yang barisnya dibuka (tampilan HP).
  const [expandedId, setExpandedId] = useState(null);

  const getStatusData = (therapist) => {
    const sessions = therapistSessions[therapist.id] || 0;
    const totalSlots = therapist.total_slots || 0;
    const percentage = totalSlots > 0 ? Math.round((sessions / totalSlots) * 100) : 0;

    if (!therapist.is_active) return { kind: 'off', label: 'Non Aktif', icon: X, color: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', percentage, sessions, totalSlots };
    if (therapist.leave_status) return { kind: 'leave', label: LEAVE_LABELS[therapist.leave_status.toLowerCase()] || 'Libur', icon: Stethoscope, color: 'bg-slate-500', ring: 'ring-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', percentage, sessions, totalSlots };
    if (totalSlots === 0) return { kind: 'off', label: 'Tidak Ada Jadwal', icon: CalendarOff, color: 'bg-slate-400', ring: 'ring-slate-200', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300', percentage, sessions, totalSlots };
    if (percentage > 75) return { kind: 'busy', label: 'Busy', icon: Zap, color: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', percentage, sessions, totalSlots };
    return { kind: 'available', label: 'Available', icon: Check, color: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', percentage, sessions, totalSlots };
  };

  // Urutan: aktif & bertugas (0) -> Non Aktif (1) -> Cuti/Ijin (2, paling akhir)
  // Di dalam grup "aktif & bertugas", urutkan dari persentase load capacity terendah ke tertinggi (full booked di ujung).
  const getPriority = (therapist) => {
    if (therapist.leave_status) return 2;
    if (!therapist.is_active) return 1;
    return 0;
  };

  const getLoadPercentage = (therapist) => {
    const sessions = therapistSessions[therapist.id] || 0;
    const totalSlots = therapist.total_slots || 0;
    return totalSlots > 0 ? (sessions / totalSlots) * 100 : 0;
  };

  const sortedTherapists = [...therapists].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return getLoadPercentage(a) - getLoadPercentage(b);
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? sortedTherapists.length : sortedTherapists.filter(t => getStatusData(t).kind === f.key).length;
    return acc;
  }, {});
  const visible = filter === 'all' ? sortedTherapists : sortedTherapists.filter(t => getStatusData(t).kind === filter);

  const goToSchedule = () => navigate('/owner/appointments');

  const periodLabel = dateRange?.startDate && dateRange?.endDate
    ? `Periode ${formatShortDate(dateRange.startDate)} – ${formatShortDate(dateRange.endDate)}`
    : null;

  const header = {
    tone: 'acc',
    icon: UserCheck,
    title: 'Status Terapis Hari Ini',
    className,
  };

  if (isLoading) {
    return (
      <FinanceTile {...header}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </FinanceTile>
    );
  }

  if (!therapists.length) {
    return (
      <FinanceTile {...header}>
        <p className="py-8 text-center text-sm text-slate-500">Tidak ada data terapis</p>
      </FinanceTile>
    );
  }

  const soapCount = (t) => unfilledSoapCounts[t.id] || 0;

  return (
    <FinanceTile
      {...header}
      action={<span className="text-xs text-slate-500 font-medium whitespace-nowrap">{therapists.length} terapis aktif</span>}
    >
      {periodLabel && (
        <p className="text-xs text-slate-500 -mt-1 mb-3" title="SOAP & data pasien mengikuti periode ini">{periodLabel}</p>
      )}

      {/* Filter status */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
              filter === f.key ? 'bg-app-ink text-white border-app-ink' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            {f.label} {counts[f.key]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-2xl">Tidak ada terapis pada status ini</p>
      )}

      {/* ── Tablet & desktop: kartu lengkap ── */}
      <div className="hidden sm:grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {visible.map((therapist) => {
          const { label, icon: Icon, color, ring, text, badge, bar, percentage, sessions, totalSlots } = getStatusData(therapist);
          const { uniquePatients = 0, returningPatients = 0 } = patientMetrics[therapist.id] || {};
          const returnRate = uniquePatients > 0 ? Math.round((returningPatients / uniquePatients) * 100) : 0;
          const unfilled = soapCount(therapist);

          return (
            <div
              key={therapist.id}
              role="link"
              tabIndex={0}
              aria-label={`Lihat jadwal ${therapist.name || 'terapis'}`}
              onClick={goToSchedule}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  goToSchedule();
                }
              }}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-bright focus-visible:ring-offset-2 bg-white rounded-2xl border border-slate-100 shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg transition-[box-shadow,transform] duration-200 ease-out overflow-hidden cursor-pointer active:scale-[0.98] min-w-0"
            >
              <div className="p-4 flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-2xl overflow-hidden ring-2 ${ring}`}>
                    {therapist.avatar_url ? (
                      <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-bold text-lg text-white ${color}`}>
                        {getInitials(therapist.name)}
                      </div>
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${color} border-2 border-white flex items-center justify-center shadow-sm`}>
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="min-w-0 font-bold text-slate-900 text-sm leading-snug break-words">{formatName(therapist.name)}</h3>
                    <span className={`shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-1 rounded-full ${badge}`}>{label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{therapist.specialization || 'Physiotherapist'}</p>
                </div>
              </div>

              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center bg-slate-50 rounded-xl py-2.5 px-2">
                    <p className="text-xl font-black text-slate-900 leading-none">{sessions}</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">Sesi</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-xl py-2.5 px-2">
                    <p className={`text-xl font-black leading-none ${text}`}>{percentage}%</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">Load</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-xl py-2.5 px-2">
                    <p className="text-xl font-black text-slate-900 leading-none">{totalSlots}</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">Slot</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium mb-1.5">
                    <span>Load Capacity</span>
                    <span className={`font-bold ${text}`}>{percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${bar}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retensi Pasien</span>
                    <span className="text-sm font-black text-indigo-700">
                      {isLoadingPatientMetrics ? '…' : `${returnRate}%`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                      style={{ width: `${isLoadingPatientMetrics ? 0 : Math.min(returnRate, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                      <Users className="w-3.5 h-3.5" />
                      {isLoadingPatientMetrics ? '…' : uniquePatients}
                      <span className="font-medium text-slate-500">patient</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-violet-600">
                      <Repeat2 className="w-3.5 h-3.5" />
                      {isLoadingPatientMetrics ? '…' : returningPatients}
                      <span className="font-medium text-slate-500">returning</span>
                    </span>
                  </div>
                </div>

                <div className={cn('flex items-center justify-between rounded-xl px-3 py-2 border', unfilled > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100')}>
                  <span className={cn('flex items-center gap-1.5 text-xs font-semibold', unfilled > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    <AlertCircle className="w-3.5 h-3.5" /> SOAP belum diisi
                  </span>
                  <span className={cn('text-sm font-black', unfilled > 0 ? 'text-rose-700' : 'text-emerald-700')}>
                    {isLoadingSoap ? '…' : unfilled}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── HP: baris ringkas yang bisa dibuka ── */}
      <div className="sm:hidden divide-y divide-slate-100">
        {visible.map((therapist) => {
          const { label, icon: Icon, color, text, badge, bar, percentage, sessions, totalSlots } = getStatusData(therapist);
          const { uniquePatients = 0, returningPatients = 0 } = patientMetrics[therapist.id] || {};
          const returnRate = uniquePatients > 0 ? Math.round((returningPatients / uniquePatients) * 100) : 0;
          const unfilled = soapCount(therapist);
          const open = expandedId === therapist.id;

          return (
            <div key={therapist.id}>
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : therapist.id)}
                aria-expanded={open}
                className="w-full grid grid-cols-[40px_1fr_auto] items-center gap-3 px-1 py-3 text-left"
              >
                <span className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold text-white overflow-hidden ${color}`}>
                  {therapist.avatar_url
                    ? <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : getInitials(therapist.name)}
                  <span className={`absolute -right-1 -bottom-1 w-4 h-4 rounded-full ${color} border-2 border-white flex items-center justify-center`}>
                    <Icon className="w-2 h-2 text-white" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-900 break-words">
                    {formatName(therapist.name)}
                    {unfilled > 0 && <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-1.5 align-middle" title="SOAP belum diisi" />}
                  </span>
                  <span className="block h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                    <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className={`inline-block whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{label}</span>
                  <small className="block text-[11px] text-slate-500 mt-1">{sessions}/{totalSlots} · {percentage}%</small>
                </span>
              </button>

              {open && (
                <div className="pl-[52px] pr-1 pb-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    {[['Sesi', sessions, 'text-slate-900'], ['Load', `${percentage}%`, text], ['Slot', totalSlots, 'text-slate-900']].map(([l, v, c]) => (
                      <div key={l} className="text-center bg-slate-50 rounded-xl py-2">
                        <p className={`text-lg font-black leading-none ${c}`}>{v}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Retensi Pasien</span>
                      <span className="text-sm font-black text-indigo-700">{isLoadingPatientMetrics ? '…' : `${returnRate}%`}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-200/80 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${isLoadingPatientMetrics ? 0 : Math.min(returnRate, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1 text-indigo-600"><Users className="w-3 h-3" />{isLoadingPatientMetrics ? '…' : uniquePatients} <span className="font-medium text-slate-500">patient</span></span>
                      <span className="flex items-center gap-1 text-violet-600"><Repeat2 className="w-3 h-3" />{isLoadingPatientMetrics ? '…' : returningPatients} <span className="font-medium text-slate-500">returning</span></span>
                    </div>
                  </div>
                  <div className={cn('flex items-center justify-between rounded-xl px-3 py-2 border', unfilled > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100')}>
                    <span className={cn('flex items-center gap-1.5 text-xs font-semibold', unfilled > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      <AlertCircle className="w-3.5 h-3.5" /> SOAP belum diisi
                    </span>
                    <span className={cn('text-sm font-black', unfilled > 0 ? 'text-rose-700' : 'text-emerald-700')}>{isLoadingSoap ? '…' : unfilled}</span>
                  </div>
                  <button
                    type="button"
                    onClick={goToSchedule}
                    className="w-full inline-flex items-center justify-center gap-1 h-10 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-transform"
                  >
                    Lihat jadwal <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </FinanceTile>
  );
};

export default TherapistStatusCards;
