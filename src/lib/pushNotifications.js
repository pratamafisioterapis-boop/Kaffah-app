import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebaseApp } from "./firebase";
import { supabase } from "@/lib/customSupabaseClient";

const VAPID_KEY =
  "BOXDIUQjh2T-88iUbT5_jGzVTJeFIdxmygdxjH7zy3Et9OkV5SDoHuShHpHvFizZiQZt4SMYfyj_UlBQH8hWycA";

export const registerPushNotifications = async (userId) => {
  try {
    if (!userId) return null;

    alert("DEBUG 1: mulai registerPushNotifications, userId=" + userId);

    const permission = await Notification.requestPermission();

    alert("DEBUG 2: permission = " + permission);

    if (permission !== "granted") {
      return null;
    }

    const messaging = getMessaging(firebaseApp);

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    alert("DEBUG 3: SW registered, scope = " + registration.scope);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    alert("DEBUG 4: token = " + (token ? token.substring(0, 20) + "..." : "NULL/KOSONG"));

    if (!token) {
      return null;
    }

    const { error } = await supabase
  .from("fcm_tokens")
  .upsert(
    {
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,token",
    }
  );

    if (error) {
      alert("DEBUG 5: FCM DB ERROR: " + JSON.stringify(error));
      return null;
    }

    alert("DEBUG 6: FCM TOKEN SAVED SUKSES");

    return token;
  } catch (err) {
    alert("DEBUG CATCH ERROR: " + err.message + " | " + JSON.stringify(err));
    return null;
  }
};

export const listenForegroundNotifications = () => {
  try {
    const messaging = getMessaging(firebaseApp);

    onMessage(messaging, (payload) => {
      console.log("Foreground Message:", payload);

      const title =
        payload?.notification?.title ||
        payload?.data?.title ||
        "NO TITLE";

      const body =
        payload?.notification?.body ||
        payload?.data?.body ||
        "NO BODY";

      new Notification(title, {
        body,
        icon: "/logo192.png",
      });
    });
  } catch (err) {
    console.error(err);
  }
};