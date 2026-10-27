-- Guard periode MOU supaya tidak salah input lagi (kasus: MOU tahun ke-2 dibuat
-- 28 Jun 2026 tapi periode kontraknya masih terisi tanggal tahun ke-1,
-- 28 Jun 2025 - 27 Jun 2026). MOU 'external' (MOU lama di luar aplikasi) hanya
-- penanda riwayat, jadi dikecualikan dari pengecekan tanggal perjanjian & tumpang tindih.

CREATE OR REPLACE FUNCTION public.validate_mou_period()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_conflict record;
BEGIN
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'Periode selesai MOU harus setelah periode mulai'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Masa kontrak MOU tahunan: sekitar 1 tahun (11-13 bulan).
  IF (NEW.period_end + 1) < (NEW.period_start + interval '11 months')::date
     OR (NEW.period_end + 1) > (NEW.period_start + interval '13 months')::date THEN
    RAISE EXCEPTION 'Masa kontrak MOU harus sekitar 1 tahun (%-%)', NEW.period_start, NEW.period_end
      USING ERRCODE = 'check_violation';
  END IF;

  -- Urutan tahun ke- harus sesuai urutan tanggal (berlaku juga untuk MOU external).
  SELECT period_number, period_start INTO v_conflict
  FROM therapist_mou_documents m
  WHERE m.physiotherapist_id = NEW.physiotherapist_id
    AND m.id IS DISTINCT FROM NEW.id
    AND ((m.period_start < NEW.period_start AND m.period_number >= NEW.period_number)
      OR (m.period_start > NEW.period_start AND m.period_number <= NEW.period_number)
      OR m.period_number = NEW.period_number)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Tahun ke-% tidak sesuai urutan: sudah ada MOU tahun ke-% mulai %',
      NEW.period_number, v_conflict.period_number, v_conflict.period_start
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM 'external' THEN
    -- Tanggal perjanjian (pembuatan MOU) harus dekat dengan awal periode kontrak.
    IF abs(NEW.agreement_date - NEW.period_start) > 60 THEN
      RAISE EXCEPTION 'Tanggal perjanjian (%) terlalu jauh dari periode mulai MOU (%). Periksa kembali periode kontrak.',
        NEW.agreement_date, NEW.period_start
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT period_number, period_start INTO v_conflict
    FROM therapist_mou_documents m
    WHERE m.physiotherapist_id = NEW.physiotherapist_id
      AND m.id IS DISTINCT FROM NEW.id
      AND m.status <> 'external'
      AND m.period_start <= NEW.period_end
      AND m.period_end >= NEW.period_start
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Periode MOU bertabrakan dengan MOU tahun ke-% (mulai %)',
        v_conflict.period_number, v_conflict.period_start
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_validate_mou_period ON public.therapist_mou_documents;
CREATE TRIGGER trg_validate_mou_period
  BEFORE INSERT OR UPDATE OF period_number, period_start, period_end, agreement_date, status, physiotherapist_id
  ON public.therapist_mou_documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_mou_period();
