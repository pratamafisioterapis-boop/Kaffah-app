import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AppointmentStateProvider } from '@/contexts/AppointmentStateContext';
import { supabase } from '@/lib/customSupabaseClient';
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
// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
  console.log('SW registered:', registration);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'ISI_NANTI_VAPID_PUBLIC_KEY'
  });

  console.log('Push Subscription:', JSON.stringify(subscription));

const { error } = await supabase
  .from('push_subscriptions')
  .insert([
    {
      subscription: subscription,
      created_at: new Date().toISOString()
    }
  ]);

if (error) {
  alert('ERROR SAVE: ' + JSON.stringify(error));
  console.error(error);
} else {
  alert('Subscription saved!');
}
})
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
// Request Notification Permission
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    console.log('Notification permission:', permission);
  });
}