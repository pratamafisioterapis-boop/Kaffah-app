import { getMessaging, getToken, deleteToken, onMessage } from "firebase/messaging";
import { firebaseApp } from "./firebase";
import { supabase } from "@/lib/customSupabaseClient";

const VAPID_KEY =
  "BOXDIUQjh2T-88iUbT5_jGzVTJeFIdxmygdxjH7zy3Et9OkV5SDoHuShHpHvFizZiQZt4SMYfyj_UlBQH8hWycA";

export const registerPushNotifications = async (userId) => {
  try {
    if (!userId) return null;

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return null;
    }

    const messaging = getMessaging(firebaseApp);

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    // Buang token lama yang mungkin sudah UNREGISTERED di sisi Firebase,
    // supaya getToken() dipaksa bikin subscription baru yang benar-benar fresh
    try {
      await deleteToken(messaging);
    } catch (e) {
      console.warn("deleteToken skipped:", e);
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

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
      console.error("FCM DB ERROR:", error);
      return null;
    }

    console.log("FCM TOKEN SAVED");

    return token;
  } catch (err) {
    console.error("FCM ERROR:", err);
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