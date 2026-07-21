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
  const { userDetails } = useAuth();
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    let active = true;

    const resolveAvatar = async () => {
      if (!userDetails) { if (active) setAvatarUrl(null); return; }

      // Custom photo set by the account owner always wins.
      if (userDetails.avatar_url) {
        if (active) setAvatarUrl(userDetails.avatar_url);
        return;
      }

      // Otherwise fall back to a sensible default per role.
      if ((userDetails.role === 'owner' || userDetails.role === 'admin') && userDetails.clinic_id) {
        const { data } = await supabase
          .from('clinics')
          .select('logo_url')
          .eq('id', userDetails.clinic_id)
          .single();
        if (active) setAvatarUrl(data?.logo_url || null);
      } else if (userDetails.role === 'therapist') {
        const { data } = await supabase
          .from('physiotherapists')
          .select('avatar_url')
          .eq('user_id', userDetails.id)
          .maybeSingle();
        if (active) setAvatarUrl(data?.avatar_url || null);
      } else {
        if (active) setAvatarUrl(null);
      }
    };

    resolveAvatar();
    return () => { active = false; };
  }, [userDetails]);

  const greeting = getGreeting();
  const quote = getTodayQuote();
  const name = userDetails?.full_name?.split(' ')[0] || userDetails?.name?.split(' ')[0] || '';
  const role = userDetails?.role;
  const roleLabel = role === 'owner' ? 'Pemilik Klinik' : role === 'admin' ? 'Admin' : role === 'therapist' ? 'Fisioterapis' : '';
  const monogram = (name || roleLabel || 'K').charAt(0).toUpperCase();

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
        background: 'radial-gradient(ellipse 120% 70% at 30% 8%, #1b2244 0%, #0c0f1e 55%, #08090f 100%)',
      }}
      className="splash-root flex flex-col items-center justify-center px-8"
    >
      {/* Ambient glow */}
      <div className="splash-glow absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,.18), transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">

        {userDetails && (
          <>
            {/* Monogram badge with drawing ring */}
            <div className="relative w-[74px] h-[74px] mb-5">
              <svg viewBox="0 0 100 100" className="splash-ring absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50" cy="50" r="46"
                  fill="none" stroke="#d4af37" strokeWidth="1.4" strokeLinecap="round"
                  style={{ strokeDasharray: 289 }}
                />
              </svg>
              <div
                className="splash-badge absolute inset-[5px] rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg,#2a2f4a,#161a2e)',
                  border: '1px solid rgba(212,175,55,.5)',
                  color: '#d4af37',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '26px',
                  fontWeight: 700,
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  monogram
                )}
              </div>
            </div>

            <p className="splash-anim text-white/50 text-xs font-medium tracking-[2px] uppercase" style={{ '--d': '0.5s' }}>{greeting}</p>
            <h1
              className="splash-anim text-white text-3xl font-bold mt-1 leading-tight"
              style={{ '--d': '0.68s', fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {name}
            </h1>
            {roleLabel && (
              <span
                className="splash-anim mt-4 text-[10px] font-bold tracking-[1.2px] px-4 py-1.5 rounded-full uppercase"
                style={{
                  '--d': '0.86s',
                  border: '1px solid rgba(212,175,55,.5)',
                  color: '#d4af37',
                  background: 'rgba(212,175,55,.08)',
                }}
              >
                {roleLabel}
              </span>
            )}
          </>
        )}

        {/* Quote */}
        <div
          className="splash-anim mt-8 px-4 py-4 rounded-2xl"
          style={{ '--d': userDetails ? '1.05s' : '0.3s', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(212,175,55,.2)' }}
        >
          <p className="text-white/70 text-sm leading-relaxed italic">{quote}</p>
        </div>
      </div>

      {/* Shimmer progress bar */}
      <div className="splash-bar absolute left-10 right-10 bottom-8 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
        <div className="splash-bar-fill absolute inset-0 w-2/5" style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />
      </div>

      <style>{`
        .splash-glow { animation: splash-glow-pulse 5s ease-in-out infinite; }
        @keyframes splash-glow-pulse { 0%, 100% { opacity: .7; } 50% { opacity: 1; } }

        .splash-ring circle { stroke-dashoffset: 289; animation: splash-draw 1.1s cubic-bezier(.4,0,.2,1) .15s forwards; }
        @keyframes splash-draw { to { stroke-dashoffset: 0; } }

        .splash-badge { opacity: 0; transform: scale(.6); animation: splash-badge-in .6s cubic-bezier(.34,1.4,.64,1) .1s forwards; }
        @keyframes splash-badge-in { to { opacity: 1; transform: scale(1); } }

        .splash-anim { opacity: 0; transform: translateY(10px); animation: splash-up .6s ease-out forwards; animation-delay: var(--d); }
        @keyframes splash-up { to { opacity: 1; transform: translateY(0); } }

        .splash-bar-fill { animation: splash-shimmer 1.6s ease-in-out infinite; }
        @keyframes splash-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(280%); } }

        @media (prefers-reduced-motion: reduce) {
          .splash-glow, .splash-badge, .splash-anim, .splash-bar-fill { animation: none !important; }
          .splash-badge, .splash-anim { opacity: 1 !important; transform: none !important; }
          .splash-ring circle { stroke-dashoffset: 0 !important; }
        }
      `}</style>
    </div>
  );
}
