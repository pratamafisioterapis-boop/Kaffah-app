import { supabase } from '@/lib/customSupabaseClient';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch((err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
}

// Check permission and subscribe
export async function subscribeUserToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push messaging is not supported');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  
  // VAPID Public Key - In a real app, this comes from your backend/env
  // For this self-contained demo, we'll simulate the subscription object structure
  // that would be sent to Supabase.
  try {
     const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BJg4XpQ9wZ8g_example_VAPID_key_replace_with_yours') 
      // NOTE: Users must generate their own VAPID keys for real push notifications
    };

    // This will fail without a real VAPID key, so we wrap in try/catch to not break the app flow
    // const subscription = await registration.pushManager.subscribe(subscribeOptions);
    
    // START SIMULATION FOR DEMO
    console.log("Simulating Push Subscription...");
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint",
      keys: {
        p256dh: "fake-p256dh-key",
        auth: "fake-auth-key"
      }
    };
    // END SIMULATION

    // Save subscription to Supabase 'push_subscriptions' table (needs to be created)
    if (userId) {
       await saveSubscriptionToDb(userId, subscription);
    }
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe the user: ', error);
    return null;
  }
}

async function saveSubscriptionToDb(userId, subscription) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ 
      user_id: userId, 
      subscription: subscription,
      updated_at: new Date()
    });
    
  if (error) console.error('Error saving subscription to DB:', error);
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}