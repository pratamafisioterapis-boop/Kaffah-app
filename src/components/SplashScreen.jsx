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

// Time-of-day scene: background tint + the celestial body drifting behind
// the content. Mirrors the hour ranges in getGreeting().
const getPeriod = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
};

const SCENES = {
  pagi: {
    bg: 'radial-gradient(ellipse 130% 60% at 50% 100%, #5b3b30 0%, #1d2347 48%, #0c0f1e 100%)',
    glow: 'rgba(255,196,110,.22)',
  },
  siang: {
    bg: 'radial-gradient(ellipse 120% 70% at 75% 0%, #2a4580 0%, #121a3d 55%, #08090f 100%)',
    glow: 'rgba(255,226,140,.2)',
  },
  sore: {
    bg: 'radial-gradient(ellipse 130% 60% at 50% 100%, #6e3b3d 0%, #2b2149 50%, #0c0f1e 100%)',
    glow: 'rgba(255,150,90,.2)',
  },
  malam: {
    bg: 'radial-gradient(ellipse 120% 70% at 30% 8%, #1b2244 0%, #0c0f1e 55%, #08090f 100%)',
    glow: 'rgba(212,175,55,.18)',
  },
};

const STARS = [
  [8, 12, 2], [22, 6, 1.5], [36, 18, 2], [52, 8, 1.5], [66, 15, 2],
  [80, 7, 1.5], [92, 20, 2], [14, 30, 1.5], [44, 34, 1.5], [74, 36, 2], [90, 40, 1.5],
];

// Seven vertebrae, tapering top (cervical) to bottom (lumbar). bx/br are the
// "bent" starting offset and tilt each one straightens out of.
const VERTEBRAE = [
  { w: 18, bx: -9, br: -14 },
  { w: 20, bx: -14, br: -10 },
  { w: 22, bx: -8, br: -4 },
  { w: 24, bx: 6, br: 8 },
  { w: 26, bx: 12, br: 12 },
  { w: 28, bx: 8, br: 6 },
  { w: 30, bx: -4, br: -3 },
];

const SkyDecor = ({ period }) => {
  if (period === 'malam') {
    return (
      <div className="splash-sky absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {STARS.map(([x, y, s], i) => (
          <span
            key={i}
            className="splash-star absolute rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, background: '#f6e7b0', '--sd': `${(i % 5) * 0.45}s` }}
          />
        ))}
        <span className="splash-moon absolute" style={{ top: '9%', right: '12%' }} />
      </div>
    );
  }

  const sun = {
    pagi: { style: { left: '50%', bottom: -30, marginLeft: -42 }, anim: 'splash-rise', color: '#ffd27a' },
    siang: { style: { right: '10%', top: '7%' }, anim: 'splash-sun-in', color: '#ffe48a' },
    sore: { style: { left: '50%', bottom: -34, marginLeft: -42 }, anim: 'splash-sink', color: '#ff9a5c' },
  }[period];

  return (
    <div className="splash-sky absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute" style={{ ...sun.style, width: 84, height: 84, animation: `${sun.anim} 3.3s cubic-bezier(.2,.7,.2,1) both` }}>
        <span className="splash-rays absolute inset-[-34px] rounded-full" />
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 40% 35%, #fff4cf, ${sun.color} 55%, transparent 72%)`, boxShadow: `0 0 50px 14px ${sun.color}55` }}
        />
      </div>
    </div>
  );
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
  const [ownerRoleLabel, setOwnerRoleLabel] = useState(null);
  const [relawanNama, setRelawanNama] = useState(null);

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

  useEffect(() => {
    let active = true;

    const resolveOwnerRoleLabel = async () => {
      if (userDetails?.role !== 'owner' || !userDetails.clinic_id) { if (active) setOwnerRoleLabel(null); return; }
      const { data } = await supabase
        .from('clinics')
        .select('owner_role_label')
        .eq('id', userDetails.clinic_id)
        .single();
      if (active) setOwnerRoleLabel(data?.owner_role_label || null);
    };

    resolveOwnerRoleLabel();
    return () => { active = false; };
  }, [userDetails]);

  useEffect(() => {
    let active = true;

    const resolveRelawan = async () => {
      if (!userDetails?.id) { if (active) setRelawanNama(null); return; }
      const { data } = await supabase
        .from('pemilih_relawan')
        .select('nama')
        .eq('user_id', userDetails.id)
        .maybeSingle();
      if (active) setRelawanNama(data?.nama || null);
    };

    resolveRelawan();
    return () => { active = false; };
  }, [userDetails]);

  const greeting = getGreeting();
  const quote = getTodayQuote();
  const name = relawanNama?.split(' ')[0] || userDetails?.full_name?.split(' ')[0] || userDetails?.name?.split(' ')[0] || '';
  const role = userDetails?.role;
  const roleLabel = relawanNama ? 'Tim Pemenangan' : role === 'owner' ? (ownerRoleLabel || 'Pemilik Klinik') : role === 'admin' ? 'Admin' : role === 'therapist' ? 'Fisioterapis' : '';
  const monogram = (name || roleLabel || 'K').charAt(0).toUpperCase();

  const [period] = useState(getPeriod);
  const scene = SCENES[period];

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2800);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3300);
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
        background: scene.bg,
      }}
      className="splash-root flex flex-col items-center justify-center px-8"
    >
      {/* Time-of-day sky (sun / moon / stars) */}
      <SkyDecor period={period} />

      {/* Ambient glow */}
      <div className="splash-glow absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${scene.glow}, transparent 70%)` }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">

        {/* Spine straightening: vertebrae start bent, align one by one, then a glow runs down */}
        <svg viewBox="0 0 60 96" className="splash-spine h-[92px] w-auto mb-4" aria-hidden="true">
          <line className="splash-cord" x1="30" y1="4" x2="30" y2="92" stroke="#d4af37" strokeWidth="1" strokeLinecap="round" />
          {VERTEBRAE.map((v, i) => (
            <rect
              key={i}
              className="splash-vert"
              x={30 - v.w / 2} y={4 + i * 13} width={v.w} height="8" rx="4"
              style={{ '--i': i, '--bx': `${v.bx}px`, '--br': `${v.br}deg` }}
            />
          ))}
        </svg>

        {userDetails && (
          <>
            {/* Monogram badge with drawing ring */}
            <div className="relative w-[128px] h-[128px] mb-6">
              <svg viewBox="0 0 100 100" className="splash-ring absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50" cy="50" r="46"
                  fill="none" stroke="#d4af37" strokeWidth="1.4" strokeLinecap="round"
                  style={{ strokeDasharray: 289 }}
                />
              </svg>
              <div
                className="splash-badge absolute inset-[7px] rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg,#2a2f4a,#161a2e)',
                  border: '1px solid rgba(212,175,55,.5)',
                  color: '#d4af37',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '44px',
                  fontWeight: 700,
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  monogram
                )}
              </div>
            </div>

            <p className="splash-anim text-white/50 text-sm font-medium tracking-[2px] uppercase" style={{ '--d': '0.9s' }}>{greeting}</p>
            <h1
              className="splash-anim text-white text-5xl font-bold mt-2 leading-tight"
              style={{ '--d': '1.06s', fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {name}
            </h1>
            {roleLabel && (
              <span
                className="splash-anim mt-5 text-xs font-bold tracking-[1.2px] px-5 py-2 rounded-full uppercase"
                style={{
                  '--d': '1.22s',
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
          className="splash-anim mt-8 px-4 py-4 rounded-app-lg"
          style={{ '--d': userDetails ? '1.4s' : '1s', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(212,175,55,.2)' }}
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

        .splash-cord { stroke-opacity: .35; stroke-dasharray: 88; stroke-dashoffset: 88; animation: splash-cord-draw .9s ease-out .7s forwards; }
        @keyframes splash-cord-draw { to { stroke-dashoffset: 0; } }

        .splash-vert {
          fill: rgba(212,175,55,.14); stroke: #d4af37; stroke-width: 1.2;
          transform-box: fill-box; transform-origin: center;
          animation:
            splash-vert-align 1.1s cubic-bezier(.3,1.25,.5,1) calc(var(--i) * .08s) both,
            splash-vert-glow .7s ease-in-out calc(1s + var(--i) * .07s) both;
        }
        @keyframes splash-vert-align {
          0%   { opacity: 0; transform: translate(var(--bx), -8px) rotate(var(--br)) scale(.6); }
          35%  { opacity: 1; transform: translate(var(--bx), 0) rotate(var(--br)) scale(1); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes splash-vert-glow {
          0%   { fill: rgba(212,175,55,.14); }
          50%  { fill: rgba(212,175,55,.8); }
          100% { fill: rgba(212,175,55,.28); }
        }

        .splash-star { opacity: 0; animation: splash-twinkle 2.2s ease-in-out var(--sd) infinite; }
        @keyframes splash-twinkle { 0%, 100% { opacity: .15; transform: scale(.8); } 50% { opacity: .95; transform: scale(1.15); } }

        .splash-moon {
          width: 44px; height: 44px; border-radius: 50%;
          box-shadow: inset -11px -4px 0 0 #f3e9c4, 0 0 28px 2px rgba(243,233,196,.25);
          opacity: 0; animation: splash-fade-in 1.2s ease-out .2s forwards;
        }
        @keyframes splash-fade-in { to { opacity: .9; } }

        .splash-rays {
          background: repeating-conic-gradient(rgba(255,226,150,.2) 0 5deg, transparent 5deg 18deg);
          -webkit-mask: radial-gradient(circle, transparent 38%, #000 46%, transparent 72%);
          mask: radial-gradient(circle, transparent 38%, #000 46%, transparent 72%);
          animation: splash-spin 24s linear infinite;
        }
        @keyframes splash-spin { to { transform: rotate(360deg); } }

        @keyframes splash-rise { from { opacity: 0; transform: translateY(90px); } to { opacity: .9; transform: translateY(0); } }
        @keyframes splash-sun-in { from { opacity: 0; transform: translateY(-16px) scale(.8); } to { opacity: .9; transform: none; } }
        @keyframes splash-sink { from { opacity: .95; transform: translateY(-34px); } to { opacity: .8; transform: translateY(8px); } }

        .splash-ring circle { stroke-dashoffset: 289; animation: splash-draw 1.1s cubic-bezier(.4,0,.2,1) .55s forwards; }
        @keyframes splash-draw { to { stroke-dashoffset: 0; } }

        .splash-badge { opacity: 0; transform: scale(.6); animation: splash-badge-in .6s cubic-bezier(.34,1.4,.64,1) .5s forwards; }
        @keyframes splash-badge-in { to { opacity: 1; transform: scale(1); } }

        .splash-anim { opacity: 0; transform: translateY(10px); animation: splash-up .6s ease-out forwards; animation-delay: var(--d); }
        @keyframes splash-up { to { opacity: 1; transform: translateY(0); } }

        .splash-bar-fill { animation: splash-shimmer 1.6s ease-in-out infinite; }
        @keyframes splash-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(280%); } }

        @media (prefers-reduced-motion: reduce) {
          .splash-glow, .splash-badge, .splash-anim, .splash-bar-fill,
          .splash-vert, .splash-cord, .splash-star, .splash-moon, .splash-rays,
          .splash-sky > div { animation: none !important; }
          .splash-badge, .splash-anim { opacity: 1 !important; transform: none !important; }
          .splash-ring circle, .splash-cord { stroke-dashoffset: 0 !important; }
          .splash-vert { fill: rgba(212,175,55,.28); }
          .splash-star { opacity: .6; }
          .splash-moon { opacity: .9; }
        }
      `}</style>
    </div>
  );
}
