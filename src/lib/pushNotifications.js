import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebaseApp } from "./firebase";
import { supabase } from "@/lib/customSupabaseClient";

const VAPID_KEY =
  "BOXDIUQjh2T-88iUbT5_jGzVTJeFIdxmygdxjH7zy3Et9OkV5SDoHuShHpHvFizZiQZt4SMYfyj_UlBQH8hWycA";

const DEVICE_ID_KEY = "fcm_device_id";

const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

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

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return null;
    }

    const deviceId = getDeviceId();

    // Hapus token milik user LAIN yang kebetulan pakai device_id sama
    // (device di-pakai gantian akun tanpa clear storage) supaya push
    // tidak nyasar/dobel ke device ini
    await supabase
      .from("fcm_tokens")
      .delete()
      .eq("device_id", deviceId)
      .neq("user_id", userId);

    const { error } = await supabase
  .from("fcm_tokens")
  .upsert(
    {
      user_id: userId,
      device_id: deviceId,
      token,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,device_id",
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