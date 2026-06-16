import React, { useState, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
import { Button } from '@/components/ui/button';
import { Download, Bell } from 'lucide-react';
import { subscribeUserToPush } from '@/lib/pwaUtils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotifRequest, setShowNotifRequest] = useState(false);
  const { user } = useAuth();

    useEffect(() => {
  if (!user) return;

  // ❗ cek apakah sudah install (PWA mode)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return; // ❗ kalau sudah install, jangan tampilkan

  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setShowInstall(true);
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  };
}, [user]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  const handleEnableNotifications = async () => {
    const sub = await subscribeUserToPush(user?.id);
    if (sub) {
      toast({
        title: "Notifikasi Aktif",
        description: "Anda akan menerima notifikasi untuk update penting."
      });
      setShowNotifRequest(false);
    } else {
       // If failed or blocked, just hide the prompt to not annoy
       setShowNotifRequest(false);
    }
  };
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

if (isStandalone) {
  return <SplashScreen />;
}
  if (!showInstall && !showNotifRequest) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {/* Install PWA Prompt */}
      {showInstall && (
        <div className="bg-slate-900 text-white p-4 rounded-lg shadow-xl border border-slate-700 max-w-xs animate-in slide-in-from-bottom-5">
          <p className="text-sm font-medium mb-3">Install aplikasi untuk akses lebih cepat dan offline mode.</p>
          <div className="flex gap-2">
             <Button size="sm" variant="secondary" onClick={() => setShowInstall(false)}>Nanti</Button>
             <Button size="sm" onClick={handleInstallClick} className="bg-blue-600 hover:bg-blue-500 text-white">
               <Download className="w-4 h-4 mr-2" /> Install App
             </Button>
          </div>
        </div>
      )}

      {/* Notification Request */}
      {showNotifRequest && (
        <div className="bg-white text-slate-900 p-4 rounded-lg shadow-xl border border-slate-200 max-w-xs animate-in slide-in-from-bottom-5">
          <p className="text-sm font-medium mb-3">Aktifkan notifikasi untuk mendapatkan update pasien baru?</p>
          <div className="flex gap-2">
             <Button size="sm" variant="ghost" onClick={() => setShowNotifRequest(false)}>Jangan</Button>
             <Button size="sm" onClick={handleEnableNotifications} className="bg-emerald-600 hover:bg-emerald-700 text-white">
               <Bell className="w-4 h-4 mr-2" /> Aktifkan
             </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PWAInstallPrompt;