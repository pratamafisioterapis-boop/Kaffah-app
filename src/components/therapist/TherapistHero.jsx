import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtClock, reminderLevel } from '@/lib/soapReminder';

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

const dateLabel = (d) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

// Jam HH:mm, berdetak per menit (titik dua berkedip).
const Clock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return <>{hh}<i className="tv2-blink not-italic">:</i>{mm}</>;
};

const Kpi = ({ value, label }) => (
  <div className="rounded-[14px] border border-white/20 bg-white/[.12] px-2.5 py-[7px] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/20 lg:px-3 lg:py-[9px]">
    <b className="tv2-display block text-[clamp(1.0625rem,4.6vw,1.625rem)] font-extrabold leading-[1.1] tabular-nums lg:text-[26px]">{value}</b>
    <span className="block text-[11.5px] leading-tight opacity-85 lg:text-xs">{label}</span>
  </div>
);

// Banner dashboard terapis: sapaan, angka kunci hari ini, dan strip agenda sesi (slot asli).
const TherapistHero = ({ therapistName, today }) => {
  const navigate = useNavigate();
  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);
  const motivation = useMemo(motivationToday, []);
  const sessions = today?.sessions || [];
  const now = today?.now || Date.now();
  // Alur SOAP-sebelum-pembayaran hanya ada di klinik tertentu. Di klinik lain status SOAP tidak
  // tercatat, jadi semua penanda dan tautan SOAP disembunyikan.
  const soapActive = !!today?.soapActive;
  const soapLoaded = !!today?.soapLoaded;
  const shortName = String(therapistName || 'Terapis').split(',')[0].trim();

  const rows = sessions.map((s) => ({ ...s, st: statusOf(s, now) }));
  const done = rows.filter((s) => s.st === 'done').length;
  const soapPending = rows.filter((s) => !s.soapDone).length;
  const nextUp = rows.find((s) => s.st === 'now') || rows.find((s) => s.st === 'next');

  const openSession = (s) => {
    if (!soapActive || !s.patientId) return;
    navigate(`/therapist/records/new/${s.patientId}?date=${today.today}&dailyRecapId=${s.id}`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#0A5A8A,#0C86A3_62%,#14A5A4)] px-3.5 py-3.5 text-white lg:px-[26px] lg:py-5"
      aria-label="Ringkasan hari ini"
    >
      <motion.div
        className="pointer-events-none absolute -right-[120px] -top-[210px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,.22),transparent)]"
        animate={{ x: [0, -60], y: [0, 50], scale: [1, 1.2] }}
        transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-[11px] lg:gap-3.5">
        <div className="flex flex-col gap-[11px] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-6">
          <div className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.14em] opacity-80">{dateLabel(new Date(now))}</span>
            <h1 className="tv2-display mt-1 break-words text-[clamp(1.375rem,6.1vw,2.375rem)] font-extrabold leading-[1.1] tracking-[-0.025em] lg:text-[38px]">
              {greeting}, {shortName}
            </h1>
            <p className="mt-1 line-clamp-1 max-w-[48ch] text-[13px] opacity-90 lg:mt-2 lg:line-clamp-none lg:text-sm">{motivation}</p>
          </div>
          <div className="flex flex-col gap-[11px] lg:items-end lg:gap-2.5">
            <div className="tv2-display hidden text-[40px] font-extrabold leading-none tabular-nums tracking-[-0.02em] lg:block"><Clock /></div>
            <div className="grid grid-cols-3 gap-2 lg:w-full">
              <Kpi value={rows.length} label="Pasien hari ini" />
              <Kpi value={`${done}/${rows.length}`} label="Sesi selesai" />
              {!soapLoaded
                ? <Kpi value="–" label="Sesi menunggu" />
                : soapActive
                  ? <Kpi value={soapPending} label="SOAP belum diisi" />
                  : <Kpi value={rows.length - done} label="Sesi menunggu" />}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-0.5 flex items-baseline justify-between gap-2.5 text-[12.5px] lg:text-[13px]">
            <b className="tv2-display whitespace-nowrap text-[14.5px] font-extrabold lg:text-[15px]">Agenda hari ini</b>
            <span className="min-w-0 truncate text-right opacity-90">
              {nextUp ? `Berikutnya ${nextUp.slot ? fmtClock(nextUp.slot.start) : ''} ${nextUp.name}`.replace('  ', ' ') : rows.length ? 'Semua sesi selesai' : 'Belum ada sesi'}
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-[14px] border border-white/20 bg-white/[.12] px-3 py-4 text-center text-sm opacity-90">
              Belum ada sesi terjadwal hari ini.
            </p>
          ) : (
            <div className="-mx-0.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 pb-1.5 pt-1 [scrollbar-width:none] lg:gap-2.5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {rows.map((s, i) => {
                const live = s.st === 'now' || s.st === 'late';
                const remaining = s.slot ? Math.ceil((s.slot.end - now) / 60000) : null;
                const showSoap = soapActive && s.st !== 'next' && s.st !== 'done';
                const lvl = remaining === null ? 'info' : reminderLevel(remaining);
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.05, duration: 0.4 }}
                    onClick={() => openSession(s)}
                    disabled={!soapActive || !s.patientId}
                    className={cn(
                      'relative snap-start overflow-hidden rounded-[14px] border px-2.5 pb-2.5 pt-[9px] text-left transition enabled:hover:-translate-y-0.5 disabled:cursor-default lg:min-w-0 lg:max-w-[22rem] lg:flex-1 lg:px-3 lg:pb-3 lg:pt-[11px]',
                      live ? 'min-w-[12.75rem] lg:min-w-0' : 'min-w-[8.6rem] lg:min-w-0',
                      live
                        ? 'border-transparent bg-white/95 text-[#10242F] shadow-[0_14px_30px_-14px_rgba(0,0,0,.5)]'
                        : 'border-white/20 bg-white/[.12] text-white enabled:hover:bg-white/20',
                    )}
                  >
                    <span className={cn('absolute inset-x-0 top-0 h-1', s.st === 'done' ? 'bg-[#5FD6A0]' : live ? 'bg-[#F2A93B]' : 'bg-white/25')} />
                    <span className="tv2-display flex items-center gap-[7px] whitespace-nowrap text-base font-extrabold tabular-nums lg:text-[17px]">
                      {live && <i className="tv2-live h-[9px] w-[9px] shrink-0 rounded-full bg-[#F2A93B]" />}
                      {s.slot ? `${fmtClock(s.slot.start)}–${fmtClock(s.slot.end)}` : 'Tanpa jadwal'}
                      {showSoap && !s.soapDone && remaining !== null && (
                        <span className={cn('ml-auto shrink-0 rounded-full px-[7px] py-0.5 font-sans text-[11px] font-bold', lvl === 'crit' ? 'bg-[#C5432F] text-white' : 'bg-[#F2A93B] text-[#3A2504]')}>
                          {remaining > 0 ? `${remaining} mnt` : 'habis'}
                        </span>
                      )}
                    </span>
                    <b className="mt-1 block truncate text-sm leading-tight lg:mt-1.5 lg:text-[14.5px]">{s.name}</b>
                    <small className={cn('block truncate text-xs', live ? 'text-slate-500' : 'opacity-80')}>{s.diagnosis || 'Belum ada diagnosa'}</small>
                    <span
                      className={cn(
                        'mt-1.5 inline-flex max-w-full items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold',
                        showSoap
                          ? (s.soapDone ? 'bg-[#DDF3E8] text-[#1E8A5F]' : lvl === 'crit' ? 'bg-[#C5432F] text-white' : 'bg-[#F2A93B] text-[#3A2504]')
                          : live ? 'bg-[#F2A93B] text-[#3A2504]' : 'bg-white/[.18]',
                      )}
                    >
                      {s.st === 'done' && <Check className="h-3 w-3" />}
                      {showSoap
                        ? (s.soapDone ? 'SOAP terisi' : 'SOAP belum diisi')
                        : s.st === 'done' ? 'Selesai' : s.st === 'late' ? 'Belum diakhiri' : s.st === 'now' ? 'Berlangsung' : 'Menunggu'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default TherapistHero;
