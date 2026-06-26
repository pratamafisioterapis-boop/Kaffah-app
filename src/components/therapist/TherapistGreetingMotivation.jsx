import React, { useState, useEffect } from 'react';
import { Sparkles, Sun, Moon, CloudSun } from 'lucide-react';
import { motion } from 'framer-motion';

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

  const hour = new Date().getHours();
  const timeOfDay = hour >= 5 && hour < 12 ? 'pagi' : hour >= 12 && hour < 15 ? 'siang' : hour >= 15 && hour < 18 ? 'sore' : 'malam';
  const gradients = {
    pagi: 'from-amber-400 via-orange-400 to-rose-400',
    siang: 'from-sky-500 via-blue-500 to-indigo-500',
    sore: 'from-orange-500 via-rose-500 to-pink-500',
    malam: 'from-indigo-600 via-violet-600 to-purple-600',
  };
  const currentGradient = gradients[timeOfDay];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${currentGradient} p-0 text-white shadow-lg`}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 h-24 w-24 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          
          {/* Left: Greeting */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner border border-white/30 shrink-0">
              <GreetingIcon className="w-7 h-7 text-white drop-shadow" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-0.5">
                {greeting}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                {therapistName || 'Terapis'} 
                <span className="ml-2 text-2xl">👋</span>
              </h1>
              <p className="text-sm text-white/70 mt-1 font-medium">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Right: Motivation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex items-start gap-3 bg-white/15 backdrop-blur-sm p-4 rounded-xl border border-white/20 max-w-md"
          >
            <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5 drop-shadow" />
            <p className="text-sm font-medium leading-relaxed text-white/90 italic">
              "{motivation}"
            </p>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
};

export default TherapistGreetingMotivation;