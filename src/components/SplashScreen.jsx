import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/customSupabaseClient";

const dailyQuotes = [
  "🤲 Semoga Allah mudahkan setiap ikhtiar hari ini.",
  "🌿 Hari yang baik dimulai dengan niat yang baik.",
  "✨ Sedikit demi sedikit, hasil besar akan mengikuti.",
  "💙 Senyum yang tulus adalah awal pelayanan terbaik.",
  "🌙 Awali dengan doa, akhiri dengan syukur.",
  "🤍 Semoga setiap langkah hari ini bernilai ibadah.",
  "☀️ Semoga hari ini lebih baik dari kemarin.",
  "🌸 Kebaikan kecil dapat memberi dampak yang besar.",
  "🌿 Bekerja dengan hati, melayani dengan empati.",
  "✨ Semoga dimudahkan dalam setiap urusan.",
  "🤲 Rezeki terbaik datang bersama keberkahan.",
  "💙 Jadilah alasan seseorang merasa lebih baik hari ini.",
  "🌙 Tetap rendah hati dalam setiap pencapaian.",
  "🌿 Kesabaran adalah kekuatan yang tidak terlihat.",
  "✨ Fokus pada proses, hasil akan mengikuti.",
  "🌾 Padi menguning di tengah sawah, semoga hari ini penuh berkah.",
  "🕊️ Burung terbang ke atas awan, semoga urusan dimudahkan Tuhan.",
  "🌿 Jalan pagi melihat embun, semoga hati selalu tenang dan santun.",
  "☀️ Matahari terbit memberi cahaya, semoga lancar segala upaya.",
  "🌸 Bunga mekar di tepi taman, semoga hari ini penuh kenyamanan.",
  "🌊 Ombak tenang di laut biru, semoga rezeki datang bertemu.",
  "🍃 Angin sejuk berhembus pelan, semoga pekerjaan berjalan nyaman.",
  "🌙 Bulan bersinar ditemani bintang, semoga langkah hari ini semakin gemilang.",
  "🌱 Menanam benih dengan sabar, hasil baik akan datang menyebar.",
  "🕌 Awali hari dengan doa, semoga Allah menjaga setiap langkah kita.",
  "🤲 Niat baik membawa manfaat, kerja ikhlas membawa keberkahan.",
  "✨ Jangan lelah berbuat baik, karena kebaikan selalu menemukan jalannya.",
  "💙 Senyum sederhana bisa menjadi penyemangat bagi banyak orang.",
  "🌿 Setiap pelayanan yang tulus adalah bentuk amal yang bernilai.",
  "☀️ Hari baru adalah kesempatan baru untuk menjadi lebih baik."
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat Pagi";
  if (hour >= 11 && hour < 15) return "Selamat Siang";
  if (hour >= 15 && hour < 18) return "Selamat Sore";
  return "Selamat Malam";
};

const getTodayQuote = () => {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return dailyQuotes[dayOfYear % dailyQuotes.length];
};

export default function SplashScreen({ onDone }) {
  const { userDetails, clinicName } = useAuth();
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchLogo = async () => {
      if (!userDetails?.clinic_id) return;
      const { data } = await supabase.from('clinics').select('logo_url').eq('id', userDetails.clinic_id).single();
      if (active) setLogoUrl(data?.logo_url || null);
    };
    fetchLogo();
    return () => { active = false; };
  }, [userDetails?.clinic_id]);

  const greeting = getGreeting();
  const quote = getTodayQuote();
  const name = userDetails?.full_name?.split(' ')[0] || userDetails?.name?.split(' ')[0] || '';
  const role = userDetails?.role;
  const roleLabel = role === 'owner' ? 'Pemilik Klinik' : role === 'admin' ? 'Admin' : role === 'therapist' ? 'Fisioterapis' : '';

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        transition: 'opacity 0.5s ease',
        opacity: fadeOut ? 0 : 1,
      }}
      className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center px-8"
    >
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">

        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={clinicName || "Clinic Logo"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full animate-pulse bg-white/10" />
          )}
        </div>

        {/* Greeting */}
        {userDetails && (
          <>
            <p className="text-white/60 text-sm font-medium">{greeting}</p>
            <h1 className="text-white text-3xl font-black mt-1 leading-tight">{name}</h1>
          </>
        )}

        {/* Quote */}
        <div className="mt-8 px-4 py-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-white/70 text-sm leading-relaxed">{quote}</p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5 mt-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}