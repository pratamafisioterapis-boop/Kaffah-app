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

    // Hapus baris lain manapun yang kebetulan sudah pakai TOKEN FCM yang sama
    // (browser bisa mengembalikan token identik walau device_id beda, mis.
    // setelah reinstall PWA / clear storage) — supaya 1 token cuma terikat
    // ke 1 user dan notifikasi tidak bocor ke akun/klinik lain
    await supabase
      .from("fcm_tokens")
      .delete()
      .eq("token", token)
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

      const icon = payload?.data?.icon_url || "/logo192.png?v=kaffahtech1";
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