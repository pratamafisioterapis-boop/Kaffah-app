import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import HeroClock from '@/components/shared/HeroClock';
import { cn } from '@/lib/utils';
import { fmtClock } from '@/lib/soapReminder';

const MOTIVATIONS = [
  'Setiap sentuhan menyembuhkan, setiap kata memberi harapan. Semangat!',
  'Your dedication moves mountains, one patient at a time. 🌟',
  'Jalan kesembuhan pasien dimulai dari senyum tulus Anda.',
  'Berakit-rakit ke hulu, berenang ke tepian. Lelah Anda hari ini, senyum pasien kemudian.',
  'Healing is a journey, and you are the trusted guide.',
  'Keikhlasan Anda adalah obat paling mujarab bagi mereka yang sakit.',
  'Make today amazing! Your skills transform lives.',
  'Satu pasien sembuh, seribu kebahagiaan tumbuh di keluarganya.',
  'Pagi-pagi minum jamu, pasien semangat karena melihat kamu! 🌿',
  'Fokus pada proses, hasil yang baik akan mengikuti.',
  "Great things never came from comfort zones. You're doing great!",
  'Buah mangga buah kedondong, terapis kita memang kece dong! 😎',
  'Keahlian tangan Anda adalah harapan bagi pemulihan mereka.',
  'Every session counts. Make this one the best yet.',
  'Lelah boleh, menyerah jangan. Pasien menunggu sentuhan ajaibmu.',
];

const greetingFor = (hour) => {
  if (hour >= 5 && hour < 11) return 'Selamat Pagi';
  if (hour >= 11 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
};

// Motivasi sama untuk semua terapis pada hari yang sama (diputar per hari dalam setahun).
const motivationToday = () => {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return MOTIVATIONS[dayOfYear % MOTIVATIONS.length];
};

const statusOf = (s, now) => {
  if (s.endedAt) return 'done';
  if (s.slot && now >= s.slot.end) return 'late';
  if (s.startedAt || (s.slot && now >= s.slot.start)) return 'now';
  return 'next';
};

const STATUS_LABEL = { done: 'Selesai', now: 'Berlangsung', late: 'Belum diakhiri', next: 'Menunggu' };

const Kpi = ({ value, label }) => (
  <div className="rounded-app border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
    <b className="block text-lg font-extrabold leading-tight tabular-nums sm:text-2xl">{value}</b>
    <span className="block text-[11.5px] leading-tight text-white/85 sm:text-xs">{label}</span>
  </div>
);

// Banner dashboard terapis: sapaan, angka kunci hari ini, dan strip agenda sesi (slot asli).
const TherapistHero = ({ therapistName, today }) => {
  const { clinicName } = useAuth();
  const navigate = useNavigate();
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);
  const motivation = useMemo(motivationToday, []);
  const sessions = today?.sessions || [];
  const now = today?.now || Date.now();
  const soapActive = !!today?.soapActive;
  const shortName = String(therapistName || 'Terapis').split(',')[0].trim();

  const rows = sessions.map((s) => ({ ...s, st: statusOf(s, now) }));
  const done = rows.filter((s) => s.st === 'done').length;
  const soapPending = rows.filter((s) => !s.soapDone).length;
  const nextUp = rows.find((s) => s.st === 'now') || rows.find((s) => s.st === 'next');

  const openSession = (s) => {
    if (!s.patientId) return;
    navigate(`/therapist/records/new/${s.patientId}?date=${today.today}&dailyRecapId=${s.id}`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-app-accent-hover via-app-accent to-app-accent-bright p-4 text-white shadow-lg sm:p-6"
      aria-label="Ringkasan hari ini"
    >
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/20 blur-3xl motion-safe:animate-pulse" aria-hidden="true" />

      <div className="relative flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            {clinicName && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 break-words">{clinicName}</p>
            )}
            <p className="text-xs font-semibold text-white/80"><HeroClock /></p>
            <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              {greeting}, {shortName}
            </h1>
            <p className="mt-1 flex items-start gap-1.5 text-[13px] italic leading-snug text-white/90 sm:text-sm">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1 sm:line-clamp-none">{motivation}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[26rem] lg:shrink-0">
            <Kpi value={rows.length} label="Pasien hari ini" />
            <Kpi value={`${done}/${rows.length}`} label="Sesi selesai" />
            {soapActive
              ? <Kpi value={soapPending} label="SOAP belum diisi" />
              : <Kpi value={rows.length - done} label="Sesi menunggu" />}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <b className="text-sm font-extrabold">Agenda hari ini</b>
            <span className="min-w-0 truncate text-white/85">
              {nextUp ? `Berikutnya ${nextUp.slot ? fmtClock(nextUp.slot.start) : ''} ${nextUp.name}`.replace('  ', ' ') : rows.length ? 'Semua sesi selesai' : 'Belum ada sesi'}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-app border border-white/20 bg-white/10 px-3 py-4 text-center text-sm text-white/85">
              Belum ada sesi terjadwal hari ini.
            </p>
          ) : (
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {rows.map((s, i) => (
                <motion.button
                  key={s.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.05, duration: 0.4 }}
                  onClick={() => openSession(s)}
                  disabled={!s.patientId}
                  className={cn(
                    'relative min-w-[8.6rem] flex-1 snap-start overflow-hidden rounded-app border px-2.5 pb-2.5 pt-3 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-default sm:min-w-[10.5rem] sm:px-3',
                    s.st === 'now' || s.st === 'late'
                      ? 'border-transparent bg-white text-slate-900 shadow-lg'
                      : 'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20',
                  )}
                >
                  <span className={cn('absolute inset-x-0 top-0 h-1', s.st === 'done' ? 'bg-emerald-300' : s.st === 'now' || s.st === 'late' ? 'bg-amber-400' : 'bg-white/25')} />
                  <span className="block font-mono text-[13px] font-bold tabular-nums sm:text-sm">
                    {s.slot ? `${fmtClock(s.slot.start)}–${fmtClock(s.slot.end)}` : 'Tanpa jadwal'}
                  </span>
                  <b className="mt-1 block truncate text-sm leading-tight">{s.name}</b>
                  <small className={cn('block truncate text-xs', s.st === 'now' || s.st === 'late' ? 'text-slate-500' : 'text-white/75')}>{s.diagnosis || 'Belum ada diagnosa'}</small>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', s.st === 'now' || s.st === 'late' ? 'bg-amber-400 text-amber-950' : 'bg-white/20')}>
                      {s.st === 'done' && <Check className="h-3 w-3" />}
                      {STATUS_LABEL[s.st]}
                    </span>
                    {soapActive && s.st !== 'next' && (
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', s.soapDone ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700')}>
                        {s.soapDone ? 'SOAP terisi' : 'SOAP belum'}
                      </span>
                    )}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default TherapistHero;
