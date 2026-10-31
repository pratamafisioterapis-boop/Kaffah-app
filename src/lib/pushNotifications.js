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

    // Pendaftaran lewat fungsi SQL register_fcm_token (SECURITY DEFINER): satu perangkat /
    // satu token hanya terikat ke satu pengguna. Pembersihan token milik pengguna LAIN
    // (perangkat dipakai gantian akun, atau token FCM identik setelah reinstall PWA) tidak
    // bisa lagi dilakukan klien karena RLS fcm_tokens hanya mengizinkan baris milik sendiri.
    let { error } = await supabase.rpc("register_fcm_token", {
      p_device_id: deviceId,
      p_token: token,
    });

    // Cadangan bila fungsi SQL belum terpasang di database (migrasi RLS tahap 1 belum dijalankan).
    if (error && (error.code === "PGRST202" || error.code === "42883")) {
      await supabase
        .from("fcm_tokens")
        .delete()
        .eq("device_id", deviceId)
        .neq("user_id", userId);

      await supabase
        .from("fcm_tokens")
        .delete()
        .eq("token", token)
        .neq("user_id", userId);

      ({ error } = await supabase
        .from("fcm_tokens")
        .upsert(
          {
            user_id: userId,
            device_id: deviceId,
            token,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" }
        ));
    }

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

    onMessage(messaging, async (payload) => {
      console.log("Foreground Message:", payload);

      const title =
        payload?.notification?.title ||
        payload?.data?.title ||
        "NO TITLE";

      const body =
        payload?.notification?.body ||
        payload?.data?.body ||
        "NO BODY";

      const icon = payload?.data?.icon_url || "/clinara-icon-app.png";
      const data = {
        url: payload?.data?.url,
        appointment_date: payload?.data?.appointment_date,
        appointment_id: payload?.data?.appointment_id,
      };

      // Di Android/Chrome PWA, `new Notification()` yang dipanggil langsung
      // dari halaman dilarang ("Illegal constructor"), jadi notifikasi
      // foreground gagal tampil secara silent walau app sedang dibuka.
      // Harus lewat ServiceWorkerRegistration.showNotification() supaya
      // konsisten dengan yang dipakai firebase-messaging-sw.js untuk pesan
      // background.
      const registration = await navigator.serviceWorker.getRegistration(
        "/firebase-messaging-sw.js"
      );

      if (registration) {
        registration.showNotification(title, { body, icon, data });
      } else {
        new Notification(title, { body, icon, data });
      }
    });
  } catch (err) {
    console.error(err);
  }
};