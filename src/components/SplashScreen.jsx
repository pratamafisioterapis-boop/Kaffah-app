import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";

export default function SplashScreen({ onFinish }) {
  const { userDetails } = useAuth();

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);

      setTimeout(() => {
        onFinish?.();
      }, 250);

    }, 900);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 bg-white z-[99999] flex flex-col items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <img
        src="/logo192.png"
        alt="Kaffah"
        className="w-20 h-20 animate-logo"
      />

      <h1 className="mt-5 text-lg font-semibold text-slate-800 animate-greeting">
        Assalamu'alaikum, {userDetails?.full_name || "User"} 👋
      </h1>
    </div>
  );
}