-- Paket yatim: rekap yang awalnya diinput sebagai "beli paket" otomatis membuat package_tracking
-- (trigger create_package_on_recap_update). Bila admin lalu memperbaiki rekap itu (mis. pasien
-- diganti ke pemilik paket sharing, atau paket diganti), paket yang sudah terbentuk tidak ikut
-- hilang dan tampil di Package Recaps sebagai paket aktif yang tak pernah dipakai
-- (kasus Bu Maryani, paket sharing Pak Muhajirin, 24 Nov 2026).
--
-- Pengaman: saat package_tracking_id sebuah rekap berpindah, paket LAMA dihapus bila benar-benar
-- kosong (tidak ada rekap lain, tidak ada pembayaran, sesi terpakai 0).

CREATE OR REPLACE FUNCTION public.cleanup_orphan_package_on_recap_repoint()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.package_tracking_id IS NULL
     OR NEW.package_tracking_id IS NOT DISTINCT FROM OLD.package_tracking_id THEN
    RETURN NEW;
  END IF;

  DELETE FROM package_tracking pt
  WHERE pt.id = OLD.package_tracking_id
    AND COALESCE(pt.sessions_used, 0) = 0
    AND pt.purchase_payment_id IS NULL
    AND COALESCE(pt.purchase_only, false) = false
    AND NOT EXISTS (SELECT 1 FROM daily_recaps d WHERE d.package_tracking_id = pt.id)
    AND NOT EXISTS (SELECT 1 FROM package_payments pp WHERE pp.package_tracking_id = pt.id);

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_orphan_package_on_recap_repoint() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cleanup_orphan_package_on_repoint ON public.daily_recaps;
CREATE TRIGGER trg_cleanup_orphan_package_on_repoint
  AFTER UPDATE OF package_tracking_id ON public.daily_recaps
  FOR EACH ROW
  WHEN (OLD.package_tracking_id IS NOT NULL
        AND NEW.package_tracking_id IS DISTINCT FROM OLD.package_tracking_id)
  EXECUTE FUNCTION public.cleanup_orphan_package_on_recap_repoint();

-- Backfill: paket 6x Maryani (Praxis) yang tersisa dari kasus di atas.
DELETE FROM package_tracking pt
WHERE pt.id = 'bca81f45-f2f2-4252-9382-9b9504fc3fdd'
  AND COALESCE(pt.sessions_used, 0) = 0
  AND pt.purchase_payment_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM daily_recaps d WHERE d.package_tracking_id = pt.id)
  AND NOT EXISTS (SELECT 1 FROM package_payments pp WHERE pp.package_tracking_id = pt.id);
