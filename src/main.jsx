import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AppointmentStateProvider } from '@/contexts/AppointmentStateContext';

alert("DEPLOY CHECK: versi kode terbaru AKTIF - " + new Date().toISOString());
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
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}