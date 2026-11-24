-- Pasien FREE: begitu owner menyetujui pengajuan 'free_patient', status Free + alasannya
-- langsung dipasang ke recap (tanpa admin perlu membuka form dan menyimpan manual).
-- Alasan diambil dari payload.free_reason (dikirim form recap), cadangan: alasan pengajuan.
-- Bila pemasangan otomatis gagal, persetujuan tetap berjalan (admin masih bisa menyimpan manual).
-- Fungsi dipatch dari definisi yang aktif.
DO $patch$
DECLARE
  d text;
  d2 text;
BEGIN
  d := pg_get_functiondef('public.soap_first_decide_override(uuid,boolean,text)'::regprocedure);
  IF position('free_patient' IN d) > 0 THEN
    RETURN; -- sudah dipatch
  END IF;
  d2 := replace(d,
    '    ELSIF o.kind = ''recap_delete'' THEN',
    '    ELSIF o.kind = ''free_patient'' THEN' || E'\n' ||
    '      BEGIN' || E'\n' ||
    '        UPDATE daily_recaps' || E'\n' ||
    '        SET special_type = ''free'',' || E'\n' ||
    '            free_reason = COALESCE(NULLIF(btrim(o.payload ->> ''free_reason''), ''''), o.reason),' || E'\n' ||
    '            updated_at = now()' || E'\n' ||
    '        WHERE id = o.recap_id AND clinic_id = o.clinic_id AND invoice_created_at IS NULL;' || E'\n' ||
    '      EXCEPTION WHEN others THEN' || E'\n' ||
    '        RAISE WARNING ''free_patient auto-apply gagal: %'', SQLERRM;' || E'\n' ||
    '      END;' || E'\n' ||
    '    ELSIF o.kind = ''recap_delete'' THEN');
  IF d2 = d THEN RAISE EXCEPTION 'patch soap_first_decide_override (free_patient) gagal'; END IF;
  EXECUTE d2;
END
$patch$;
