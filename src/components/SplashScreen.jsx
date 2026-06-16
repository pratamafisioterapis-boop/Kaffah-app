import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";

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

export default function SplashScreen({ onFinish }) {
  const { userDetails } = useAuth();
  const [visible, setVisible] = useState(false);

  const quote =
    dailyQuotes[
      new Date().getDate() % dailyQuotes.length
    ];

  useEffect(() => {
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);

      setTimeout(() => {
        onFinish?.();
      }, 300);

    }, 2600);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`
        fixed inset-0 z-[99999]
        flex flex-col items-center justify-center
        bg-gradient-to-b from-white via-slate-50 to-slate-100
        transition-opacity duration-300
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <img
        src="/logo192.png"
        alt="Kaffah"
        className="
          w-28 h-28
          animate-[logoEntrance_.8s_cubic-bezier(.22,1,.36,1)]
        "
      />

      <h1
        className="
          mt-6
          text-xl
          font-semibold
          text-slate-800
          text-center
          px-6
          animate-[textEntrance_.6s_ease-out_.3s_both]
        "
      >
        Assalamu'alaikum, {userDetails?.full_name} 👋
      </h1>

      <p
        className="
          mt-4
          text-sm
          text-slate-500
          text-center
          max-w-sm
          px-8
          leading-relaxed
          animate-[textEntrance_.6s_ease-out_.5s_both]
        "
      >
        {quote}
      </p>
    </div>
  );
}