import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebaseApp } from "./firebase";
import { supabase } from "@/lib/customSupabaseClient";

const VAPID_KEY =
  "BOXDIUQjh2T-88iUbT5_jGzVTJeFIdxmygdxjH7zy3Et9OkV5SDoHuShHpHvFizZiQZt4SMYfyj_UlBQH8hWycA";

export const registerPushNotifications = async (userId) => {
  try {
    alert("STEP 1 - REGISTER START");

    if (!userId) {
      alert("ERROR: USER ID KOSONG");
      return null;
    }

    const permission = await Notification.requestPermission();

    alert("PERMISSION = " + permission);

    if (permission !== "granted") {
      alert("NOTIFICATION DITOLAK");
      return null;
    }

    alert("STEP 2 - GET MESSAGING");

    const messaging = getMessaging(firebaseApp);

    alert("STEP 3 - REGISTER SERVICE WORKER");

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    alert("STEP 4 - GET TOKEN");

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    alert("STEP 5 - TOKEN RESULT");

    if (!token) {
      alert("TOKEN NULL");
      return null;
    }

    alert("TOKEN BERHASIL");
    alert(token.substring(0, 60));

    console.log("FCM TOKEN:", token);

    alert("STEP 6 - SAVE DATABASE");

    const { error } = await supabase
      .from("fcm_tokens")
      .upsert({
        user_id: userId,
        token,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      alert("DB ERROR");
      alert(JSON.stringify(error));
      console.error(error);
      return null;
    }

    alert("TOKEN TERSIMPAN");

    return token;
  } catch (err) {
    console.error("FCM ERROR:", err);

    alert("FCM ERROR");

    try {
      alert(err?.message || JSON.stringify(err));
    } catch {
      alert("UNKNOWN ERROR");
    }

    return null;
  }
};

export const listenForegroundNotifications = () => {
  try {
    const messaging = getMessaging(firebaseApp);

    onMessage(messaging, (payload) => {
      console.log("Foreground Message:", payload);

      if (payload?.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: "/logo192.png",
        });
      }
    });
  } catch (err) {
    console.error(err);
  }
};