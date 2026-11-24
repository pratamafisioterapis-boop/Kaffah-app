-- Praxis: kunjungan pertama pasien yang paketnya masih "pending" ikut tertaut ke paket.
--
-- Bug: trg_appointment_confirmed_to_recap (membuat recap saat appointment dikonfirmasi) hanya
-- mencari paket 'aktif'. Paket yang baru dibeli lewat "Tambah Paket" berstatus 'pending', jadi recap
-- dibuat dengan package_tracking_id & package_type NULL. Trigger auto_assign_package_on_* (yang
-- sudah mengenali paket pending, 20261116050000) tidak jalan karena butuh package_type terisi dan
-- hanya terpicu saat package_type/pasien berubah. Akibatnya Riwayat Penggunaan Paket kosong dan
-- sisa sesi tidak berkurang (kasus RM00082, 24/11/2026).
--
-- Perbaikan: fungsi yang sama, ditambah fallback ke paket 'pending' khusus klinik Praxis.
-- Isi fungsi selain blok fallback tidak berubah dari 20261028010000.

CREATE OR REPLACE FUNCTION public.trg_appointment_confirmed_to_recap()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_therapist_name  text;
  v_clinic_id       uuid;
  v_pkg_tracking_id uuid;
  v_package_type    text;
  v_recap_date      date;
  v_today           date;
BEGIN

  -- Hanya homecare_time_type yang berubah: tidak ada yang perlu di-upsert ulang ke rekap.
  IF TG_OP = 'UPDATE'
     AND NEW.homecare_time_type IS DISTINCT FROM OLD.homecare_time_type
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date
     AND NEW.therapist_id IS NOT DISTINCT FROM OLD.therapist_id
     AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
     AND NEW.guest_name IS NOT DISTINCT FROM OLD.guest_name
     AND NEW.guest_phone IS NOT DISTINCT FROM OLD.guest_phone
     AND NEW.is_homecare IS NOT DISTINCT FROM OLD.is_homecare THEN
    RETURN NEW;
  END IF;

  v_recap_date := (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
  v_today      := (NOW() AT TIME ZONE 'Asia/Makassar')::date;

  IF NEW.status NOT IN ('confirmed', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF v_recap_date > v_today THEN
    RETURN NEW;
  END IF;

  -- Kalau recap utk appointment ini sudah ada, sudah ke-link paket, punya pasien
  -- yang sama, DAN tanggal recap-nya tidak berubah (reschedule cuma geser jam /
  -- ganti terapis di hari yang sama) -- pertahankan link itu, jangan dicari ulang.
  -- Kalau tanggalnya beneran pindah hari, biarkan dicari ulang di bawah karena
  -- rentang validitas paket bisa beda utk tanggal baru.
  SELECT dr.package_tracking_id, dr.package_type
  INTO v_pkg_tracking_id, v_package_type
  FROM daily_recaps dr
  WHERE dr.appointment_id = NEW.id
    AND dr.patient_id IS NOT DISTINCT FROM NEW.patient_id
    AND dr.recap_date = v_recap_date;

  IF v_pkg_tracking_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT pt.id, pt.package_name
    INTO v_pkg_tracking_id, v_package_type
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND pt.status = 'aktif'
      AND pt.sessions_remaining > 0
      AND v_recap_date BETWEEN pt.start_date
      AND COALESCE(pt.extended_until, pt.end_date)
    ORDER BY pt.start_date DESC
    LIMIT 1;
  END IF;

  -- Praxis: paket "pending" (dibayar di muka lewat Tambah Paket, belum pernah dipakai)
  -- juga harus tertaut. Tanpa ini recap kunjungan pertama dibuat tanpa paket
  -- (package_tracking_id & package_type NULL), dan trigger auto_assign_* tidak bisa
  -- menolong karena butuh package_type terisi. Paket diaktifkan oleh
  -- recalculate_package_sessions setelah recap tertaut (lihat 20261116050000).
  IF v_pkg_tracking_id IS NULL AND NEW.patient_id IS NOT NULL
     AND NEW.clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid THEN
    SELECT pt.id, pt.package_name
    INTO v_pkg_tracking_id, v_package_type
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND pt.clinic_id = NEW.clinic_id
      AND pt.status = 'pending'
      AND pt.sessions_remaining > 0
    ORDER BY pt.created_at ASC
    LIMIT 1;
  END IF;

  IF v_pkg_tracking_id IS NULL THEN
    v_package_type := NULL;
  END IF;

  -- ambil nama therapist + clinic_id
  SELECT name, clinic_id
  INTO v_therapist_name, v_clinic_id
  FROM physiotherapists
  WHERE id = NEW.therapist_id;

  -- fallback kalau clinic_id therapist kosong
  IF v_clinic_id IS NULL THEN
    SELECT id INTO v_clinic_id FROM clinics LIMIT 1;
  END IF;

  INSERT INTO daily_recaps (
    id,
    appointment_id,
    patient_id,
    therapist_id,
    therapist_name,
    patient_type,
    recap_date,
    created_at,
    updated_at,
    status,
    package_tracking_id,
    package_type,
    payment_method,
    guest_name,
    guest_phone,
    clinic_id
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    CASE WHEN NEW.patient_id IS NOT NULL THEN NEW.patient_id ELSE NULL END,
    NEW.therapist_id,
    v_therapist_name,
    CASE WHEN NEW.patient_id IS NOT NULL THEN 'registered' ELSE 'guest' END,
    v_recap_date,
    NOW(),
    NOW(),
    NEW.status,
    v_pkg_tracking_id,
    v_package_type,
    CASE WHEN v_pkg_tracking_id IS NOT NULL THEN 'Package' ELSE NULL END,
    NEW.guest_name,
    NEW.guest_phone,
    v_clinic_id
  )
  ON CONFLICT (appointment_id)
  DO UPDATE SET
    therapist_id      = EXCLUDED.therapist_id,
    therapist_name     = EXCLUDED.therapist_name,
    guest_name        = EXCLUDED.guest_name,
    guest_phone       = EXCLUDED.guest_phone,
    status            = EXCLUDED.status,
    updated_at        = NOW(),
    package_tracking_id = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_tracking_id ELSE EXCLUDED.package_tracking_id END,
    package_type      = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_type ELSE EXCLUDED.package_type END,
    payment_method    = CASE
      WHEN daily_recaps.prepaid_at IS NOT NULL THEN daily_recaps.payment_method
      WHEN EXCLUDED.package_tracking_id IS NOT NULL THEN 'Package'
      ELSE NULL
    END,
    clinic_id         = COALESCE(daily_recaps.clinic_id, EXCLUDED.clinic_id);

  RETURN NEW;
END;
$fn$;

-- Backfill satu recap yang sudah terlanjur tidak tertaut (RM00082, kunjungan 24/11/2026).
-- Dijaga: hanya jalan bila recap masih tanpa paket dan paket masih pending/belum terpakai.
UPDATE public.daily_recaps dr
SET package_tracking_id = '1c24eaba-1980-4c16-ba00-da423349e572',
    package_type        = 'Paket Fisioterapi 6x',
    payment_method      = COALESCE(dr.payment_method, 'Package'),
    updated_at          = NOW()
WHERE dr.id = 'd69fbeb1-a789-4c78-b9e2-e1faf5df8d21'
  AND dr.package_tracking_id IS NULL
  AND EXISTS (SELECT 1 FROM public.package_tracking pt
              WHERE pt.id = '1c24eaba-1980-4c16-ba00-da423349e572'
                AND pt.patient_id = dr.patient_id
                AND pt.status = 'pending' AND pt.sessions_used = 0);
