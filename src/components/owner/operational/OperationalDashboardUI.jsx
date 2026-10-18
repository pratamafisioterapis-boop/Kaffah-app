import React, { useState } from 'react';
import {
  Users, Activity, Calendar, Clock,
  CheckCircle, XCircle, PlayCircle, UserCheck,
  UserPlus, UserCog, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile from '@/components/owner/finance/FinanceTile';
import AnimatedNumber from '@/components/owner/finance/AnimatedNumber';
import { TONES } from '@/components/owner/finance/financeTheme';
import SlotUtilizationChart from './SlotUtilizationChart';

const formatInt = (v) => Math.round(v).toLocaleString('id-ID');
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Komponen ini mengembalikan fragment: tiap kotak menjadi anak langsung dari grid
// bento di OwnerDashboard (span kolomnya diatur lewat className masing-masing).
const OperationalDashboardUI = ({
  totalSessions = 0,
  totalPatients = 0,
  totalPackages = 0,
  todaySessions = 0,
  ongoingSessions = 0,
  completedSessions = 0,
  cancelledAppointments = 0,
  activeTherapists = 0,
  emptySlots = 0,
  newPatientsToday = 0,
  returningPatientsToday = 0,
  isLoading = false
}) => {
  // Kartu Hari Ini yang diketuk menampilkan persentasenya dari total.
  const [selected, setSelected] = useState(null);

  const periodKPIs = [
    { label: 'Total Sesi', value: totalSessions, badge: 'Periode', icon: Activity, tone: 'acc' },
    { label: 'Total Pasien', value: totalPatients, badge: 'Unik', icon: Users, tone: 'ind' },
    { label: 'Total Paket', value: totalPackages, badge: 'Aktif', icon: Package, tone: 'vio' },
  ];

  const patientsToday = newPatientsToday + returningPatientsToday;
  const todayKPIs = [
    { key: 'sess', label: 'Sesi Hari Ini', value: todaySessions, icon: Calendar, tone: 'pos', detail: `Selesai ${completedSessions}, berjalan ${ongoingSessions}` },
    { key: 'ongoing', label: 'Sedang Berjalan', value: ongoingSessions, icon: PlayCircle, tone: 'warn', detail: `${pct(ongoingSessions, todaySessions)}% dari sesi hari ini` },
    { key: 'done', label: 'Selesai', value: completedSessions, icon: CheckCircle, tone: 'pos', detail: `${pct(completedSessions, todaySessions)}% dari sesi hari ini` },
    { key: 'cancel', label: 'Dibatalkan', value: cancelledAppointments, icon: XCircle, tone: 'neg', valueCls: 'text-rose-600', detail: `${pct(cancelledAppointments, todaySessions)}% dari sesi hari ini` },
    { key: 'therapists', label: 'Terapis Aktif', value: activeTherapists, icon: UserCheck, tone: 'acc', detail: 'Bertugas hari ini' },
    { key: 'empty', label: 'Slot Kosong', value: emptySlots, icon: Clock, tone: 'warn', valueCls: 'text-orange-600', detail: 'Masih bisa diisi hari ini' },
    { key: 'new', label: 'Pasien Baru', value: newPatientsToday, icon: UserPlus, tone: 'sky', detail: `${pct(newPatientsToday, patientsToday)}% pasien hari ini` },
    { key: 'old', label: 'Pasien Lama', value: returningPatientsToday, icon: UserCog, tone: 'ind', detail: `${pct(returningPatientsToday, patientsToday)}% pasien hari ini` },
  ];

  if (isLoading) {
    return (
      <>
        <div className="col-span-2 md:col-span-4 lg:col-span-6 h-40 rounded-[22px] bg-slate-100 animate-pulse" />
        <div className="col-span-2 md:col-span-4 lg:col-span-4 h-56 rounded-[22px] bg-slate-100 animate-pulse" />
        <div className="col-span-2 md:col-span-4 lg:col-span-2 h-56 rounded-[22px] bg-slate-100 animate-pulse" />
      </>
    );
  }

  return (
    <>
      {/* Ringkasan periode */}
      <FinanceTile tone="acc" icon={Activity} title="Ringkasan Periode" className="col-span-2 md:col-span-4 lg:col-span-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          {periodKPIs.map(({ label, value, badge, icon: Icon, tone }) => {
            const t = TONES[tone];
            return (
              <div key={label} className={cn('rounded-2xl border border-slate-100 p-3 md:p-4 min-w-0', t.tint)}>
                <div className="flex items-center justify-between gap-1 mb-2 md:mb-3">
                  <span className={cn('w-7 h-7 md:w-9 md:h-9 rounded-[10px] flex items-center justify-center', t.icon)}>
                    <Icon className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
                  </span>
                  <span className={cn('hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold', t.soft, t.text)}>{badge}</span>
                </div>
                <p className="text-2xl md:text-4xl font-black tabular-nums leading-none text-slate-900">
                  <AnimatedNumber value={value} format={formatInt} />
                </p>
                <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 break-words">{label}</p>
              </div>
            );
          })}
        </div>
      </FinanceTile>

      {/* Hari ini */}
      <FinanceTile
        tone="pos"
        icon={Calendar}
        title="Hari Ini"
        className="col-span-2 md:col-span-4 lg:col-span-4"
        action={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-emerald-600">
            <span className="w-[7px] h-[7px] rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" /> LIVE
          </span>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {todayKPIs.map(({ key, label, value, icon: Icon, tone, valueCls, detail }) => {
            const t = TONES[tone];
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(active ? null : key)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-2xl text-left min-w-0 border transition-[transform,border-color] active:scale-[0.97]',
                  t.soft, t.text, active ? 'border-current' : 'border-transparent'
                )}
              >
                <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="min-w-0">
                  <b className={cn('block text-2xl font-black leading-none tabular-nums', valueCls || 'text-slate-900')}>{formatInt(value)}</b>
                  <span className="block text-xs font-medium mt-1 break-words">{label}</span>
                  {active && <span className="block text-[10.5px] opacity-80 mt-0.5 break-words">{detail}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </FinanceTile>

      {/* Utilisasi slot hari ini */}
      <SlotUtilizationChart className="col-span-2 md:col-span-4 lg:col-span-2" />
    </>
  );
};

export default OperationalDashboardUI;
