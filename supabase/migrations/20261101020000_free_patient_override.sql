-- Kaffah (SOAP-first): status pasien FREE wajib persetujuan owner.
-- Admin mengajukan lewat soap_first_request_override (kind 'free_patient'); trigger recap hanya mengizinkan
-- special_type = 'free' bila owner sudah menyetujui pengajuan untuk recap tersebut (pola sama dengan
-- 'manual_discount'). Owner/super_admin langsung boleh. Fungsi dipatch dari definisi yang aktif.

ALTER TABLE public.soap_overrides DROP CONSTRAINT IF EXISTS soap_overrides_kind_check;
ALTER TABLE public.soap_overrides ADD CONSTRAINT soap_overrides_kind_check
  CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust', 'manual_discount', 'vitals_edit', 'recovery_outside_package', 'discount_adjust', 'recap_delete', 'package_change', 'package_release', 'free_patient'));

DO $patch$
DECLARE
  d text;
  d2 text;
BEGIN
  -- 1) soap_first_request_override: kenali kind 'free_patient'
  d := pg_get_functiondef('public.soap_first_request_override(text,uuid,text,jsonb,uuid)'::regprocedure);
  d2 := replace(d, '''recovery_outside_package'', ''discount_adjust'') THEN', '''recovery_outside_package'', ''discount_adjust'', ''free_patient'') THEN');
  IF d2 = d THEN RAISE EXCEPTION 'patch request_override (daftar kind) gagal'; END IF;
  d := d2;
  d2 := replace(d, 'WHEN ''discount_adjust'' THEN ''Ubah diskon (invoice terbit)''', 'WHEN ''discount_adjust'' THEN ''Ubah diskon (invoice terbit)''' || E'\n    WHEN ''free_patient'' THEN ''Pasien FREE''');
  IF d2 = d THEN RAISE EXCEPTION 'patch request_override (label) gagal'; END IF;
  EXECUTE d2;

  -- 2) trg_ab_soap_first_prepare: Free wajib persetujuan owner bila diubah admin
  d := pg_get_functiondef('public.trg_ab_soap_first_prepare()'::regprocedure);
  d2 := replace(d,
    '      RAISE EXCEPTION ''Alasan pasien Free wajib diisi.'';' || E'\n    END IF;',
    '      RAISE EXCEPTION ''Alasan pasien Free wajib diisi.'';' || E'\n    END IF;' || E'\n' ||
    '    IF NEW.special_type = ''free'' AND NOT v_owner AND NOT v_rpc AND NOT EXISTS (' || E'\n' ||
    '      SELECT 1 FROM soap_overrides o WHERE o.recap_id = NEW.id AND o.kind = ''free_patient'' AND o.status = ''approved''' || E'\n' ||
    '    ) THEN' || E'\n' ||
    '      RAISE EXCEPTION ''Pasien Free wajib disetujui owner. Ajukan persetujuan terlebih dahulu.'';' || E'\n' ||
    '    END IF;');
  IF d2 = d THEN RAISE EXCEPTION 'patch trg_ab_soap_first_prepare gagal'; END IF;
  EXECUTE d2;
END
$patch$;
