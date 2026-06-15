import { getToken } from "firebase/messaging";
import { messaging } from "./firebase";
import { supabase } from "@/lib/customSupabaseClient";

const VAPID_KEY =
"BOXDIUQjh2T-88iUbT5_jGzVTJeFIdxmygdxjH7zy3Et9OkV5SDoHuShHpHvFizZiQZt4SMYfyj_UlBQH8hWycA";

export const registerPushNotifications = async (userId) => {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("NOTIFICATION DENIED");
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY
    });

    alert("TOKEN=" + token);

    if (!token) {
      alert("TOKEN NULL");
      return;
    }

    const result = await supabase
      .from("fcm_tokens")
      .upsert({
        user_id: userId,
        token,
        updated_at: new Date().toISOString()
      });

    alert(JSON.stringify(result));

  } catch (err) {
    alert(err.message);
  }
};