import React, { useState, useEffect } from 'react';
import { Sparkles, Sun, Moon, CloudSun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MOTIVATIONS = [
  "Setiap sentuhan menyembuhkan, setiap kata memberi harapan. Semangat!",
  "Your dedication moves mountains, one patient at a time. 🌟",
  "Jalan kesembuhan pasien dimulai dari senyum tulus Anda.",
  "Berakit-rakit ke hulu, berenang ke tepian. Lelah Anda hari ini, senyum pasien kemudian.",
  "Healing is a journey, and you are the trusted guide.",
  "Keikhlasan Anda adalah obat paling mujarab bagi mereka yang sakit.",
  "Make today amazing! Your skills transform lives.",
  "Satu pasien sembuh, seribu kebahagiaan tumbuh di keluarganya.",
  "Pagi-pagi minum jamu, pasien semangat karena melihat kamu! 🌿",
  "Fokus pada proses, hasil yang baik akan mengikuti.",
  "Great things never came from comfort zones. You're doing great!",
  "Buah mangga buah kedondong, terapis kita memang kece dong! 😎",
  "Keahlian tangan Anda adalah harapan bagi pemulihan mereka.",
  "Every session counts. Make this one the best yet.",
  "Lelah boleh, menyerah jangan. Pasien menunggu sentuhan ajaibmu."
];

const TherapistGreetingMotivation = ({ therapistName }) => {
  const { clinicName } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [motivation, setMotivation] = useState('');
  const [GreetingIcon, setGreetingIcon] = useState(Sun);

  useEffect(() => {
    // 1. Determine Greeting based on hour
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) {
        setGreeting('Selamat Pagi');
        setGreetingIcon(Sun);
    } else if (hour >= 11 && hour < 15) {
        setGreeting('Selamat Siang');
        setGreetingIcon(Sun); // Or distinctive sun
    } else if (hour >= 15 && hour < 18) {
        setGreeting('Selamat Sore');
        setGreetingIcon(CloudSun);
    } else {
        setGreeting('Selamat Malam');
        setGreetingIcon(Moon);
    }

    // 2. Deterministic Motivation (Same for all users on same day)
    const today = new Date();
    // Use day of year to rotate
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const index = dayOfYear % MOTIVATIONS.length;
    setMotivation(MOTIVATIONS[index]);

  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/50"
    >
      {/* Premium texture + glow accents */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />

      {/* Gold hairline accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          {/* Left: Greeting */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm flex items-center justify-center shadow-inner border border-amber-300/30 shrink-0">
              <GreetingIcon className="w-7 h-7 text-amber-300 drop-shadow" />
            </div>
            <div className="min-w-0">
              {clinicName && (
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80 mb-1 truncate">
                  {clinicName}
                </p>
              )}
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-0.5">
                {greeting}
              </p>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight break-words">
                {therapistName || 'Terapis'}
                <span className="ml-2 text-2xl">👋</span>
              </h1>
              <p className="text-sm text-white/50 mt-1 font-medium">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Right: Motivation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative flex items-start gap-3 bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-amber-300/20 max-w-md shadow-lg"
          >
            <Sparkles className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5 drop-shadow" />
            <p className="text-sm font-medium leading-relaxed text-white/90 italic min-w-0">
              "{motivation}"
            </p>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
};

export default TherapistGreetingMotivation;