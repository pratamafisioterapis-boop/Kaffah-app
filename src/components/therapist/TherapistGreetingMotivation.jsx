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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
      <div className="absolute left-0 bottom-0 -mb-4 -ml-4 h-20 w-20 rounded-full bg-white/10 blur-lg"></div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-100 mb-1">
             <GreetingIcon className="w-5 h-5" />
             <span className="text-sm font-medium uppercase tracking-wider opacity-90">{greeting}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Halo, {therapistName || 'Terapis'}!
          </h1>
        </div>
        
        <div className="flex items-start gap-3 bg-white/10 p-3 rounded-lg border border-white/10 max-w-lg">
           <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
           <p className="text-sm md:text-base font-medium leading-relaxed italic text-blue-50">
             "{motivation}"
           </p>
        </div>
      </div>
    </motion.div>
  );
};

export default TherapistGreetingMotivation;