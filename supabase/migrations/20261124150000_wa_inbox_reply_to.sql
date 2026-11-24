-- ID pesan WhatsApp yang dikutip (fitur "balas") oleh pesan masuk; dipakai asisten AI
-- untuk tahu pasien menjawab pesan klinik yang mana (mis. "Oke kak" pada daftar jadwal).
ALTER TABLE public.wa_inbox_messages
  ADD COLUMN IF NOT EXISTS reply_to_wa_message_id text;
