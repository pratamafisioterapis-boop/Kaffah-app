-- Tombol "Kirim" manual pada reminder terapi (halaman Follow Up).
--
-- Sebelumnya tombol itu membuka wa.me dengan teks bebas, jadi pasien tidak
-- menerima template reminder_terapi_konfirmasi (tanpa tombol Hadir/Reschedule/
-- Cancel) dan balasannya tidak tercatat. Fungsi ini mengirim lewat jalur yang
-- sama dengan cron: send_follow_up_whatsapp().
--
-- SECURITY DEFINER karena send_follow_up_whatsapp() membaca wa_settings.api_key
-- dan memakai pg_net, yang tidak boleh diakses langsung oleh role authenticated.
-- Karena itu pemeriksaan hak akses dilakukan di sini:
--   - pemanggil harus owner / admin / super_admin dengan clinic_id terisi,
--   - baris antrean harus milik klinik pemanggil,
--   - hanya follow_up_type = 'therapy_reminder' yang boleh dikirim lewat fungsi ini.
-- Hanya mengirim baris berstatus pending (dijaga send_follow_up_whatsapp sendiri),
-- jadi menekan tombol dua kali tidak mengirim dua pesan.

CREATE OR REPLACE FUNCTION public.send_therapy_reminder_now(p_queue_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_role   text;
    v_clinic uuid;
    v_q      RECORD;
BEGIN
    SELECT role, clinic_id INTO v_role, v_clinic
    FROM users
    WHERE id = auth.uid();

    IF v_role IS NULL OR v_clinic IS NULL
       OR v_role NOT IN ('owner', 'admin', 'super_admin') THEN
        RETURN json_build_object('success', false, 'message', 'Tidak punya akses');
    END IF;

    SELECT clinic_id, follow_up_type INTO v_q
    FROM follow_up_queue
    WHERE id = p_queue_id;

    IF NOT FOUND OR v_q.clinic_id IS DISTINCT FROM v_clinic THEN
        RETURN json_build_object('success', false, 'message', 'Data tidak ditemukan');
    END IF;

    IF v_q.follow_up_type <> 'therapy_reminder' THEN
        RETURN json_build_object('success', false, 'message', 'Hanya untuk reminder terapi');
    END IF;

    RETURN send_follow_up_whatsapp(p_queue_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.send_therapy_reminder_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_therapy_reminder_now(uuid) TO authenticated, service_role;
