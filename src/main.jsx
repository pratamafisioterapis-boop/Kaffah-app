import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AppointmentStateProvider } from '@/contexts/AppointmentStateContext';
// Global Error Handler for non-React errors (e.g., syntax errors, script failures)
window.onerror = function(message, source, lineno, colno, error) {
  console.error("GLOBAL ERROR CAUGHT:", message, source, lineno, colno, error);
  // Optional: You could update the DOM here to show a fatal error if React fails completely
  return false;
};

// Global Promise Rejection Handler
window.onunhandledrejection = function(event) {
  console.error("UNHANDLED PROMISE REJECTION:", event.reason);
};

console.log("System initializing... React version:", React.version);

try {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error("FATAL: Root element 'root' not found in document.");
  }

  ReactDOM.createRoot(rootElement).render(
    <>
      <AppointmentStateProvider>
        <App />
      </AppointmentStateProvider>
    </>
  );
  
  console.log("React render call completed successfully.");
} catch (err) {
  console.error("FATAL RENDERING ERROR:", err);
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;">
    <h1>Critical Initialization Error</h1>
    <p>${err.toString()}</p>
  </div>`;
}
// Register Service Worker (caching + FCM push, satu file supaya tidak rebutan scope '/')
if ('serviceWorker' in navigator) {
  let refreshing = false;

  // Lacak interaksi dengan <input type="file"> di seluruh app (klik utk buka
  // native picker, atau file baru saja dipilih). Sama seperti alasan kita
  // sengaja tidak cek update SW di 'visibilitychange' (lihat bawah): kembali
  // dari native file/camera picker juga memicu tab jadi visible lagi, dan
  // kalau tepat saat itu SW baru selesai aktif lalu controllerchange me-reload
  // halaman, file yang baru dipilih user langsung hilang tanpa pesan error.
  let fileInputGraceUntil = 0;
  const FILE_INPUT_GRACE_MS = 20000;
  const markFileInputActivity = (e) => {
    if (e.target?.matches?.('input[type="file"]')) {
      fileInputGraceUntil = Date.now() + FILE_INPUT_GRACE_MS;
    }
  };
  document.addEventListener('click', markFileInputActivity, true);
  document.addEventListener('change', markFileInputActivity, true);

  // Begitu SW baru ambil alih kontrol tab ini, reload otomatis 1x — kecuali
  // sedang dalam masa tenggang interaksi file input, supaya tidak menimpa
  // file yang baru saja dipilih user. Update tetap akan terpakai di reload
  // berikutnya karena SW baru sudah aktif walau kita skip reload sekarang.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    if (Date.now() < fileInputGraceUntil) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    // Bersihkan registrasi /sw.js lama yang masih tersisa di device user
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        if (reg.active && reg.active.scriptURL.endsWith('/sw.js')) {
          reg.unregister();
        }
      });
    });

    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        // Sengaja TIDAK cek update di 'visibilitychange': tab kembali visible juga terjadi
        // saat user baru kembali dari native file/camera picker (mis. upload dokumen Drive),
        // dan reload otomatis di titik itu akan menghapus file yang baru saja dipilih.
        // Cek update berkala tiap 60 detik selama tab terbuka sudah cukup.
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}