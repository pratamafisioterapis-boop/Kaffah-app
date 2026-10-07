-- Owner dapat menunjuk terapis yang ada sebagai "terapis kepala".
ALTER TABLE public.physiotherapists
  ADD COLUMN IF NOT EXISTS is_head_therapist boolean NOT NULL DEFAULT false;

-- Hanya owner / super_admin (atau service role / SQL langsung) yang boleh mengubah flag ini.
CREATE OR REPLACE FUNCTION public.guard_is_head_therapist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_head_therapist IS DISTINCT FROM OLD.is_head_therapist
     AND auth.uid() IS NOT NULL
     AND get_my_role() NOT IN ('owner', 'super_admin') THEN
    NEW.is_head_therapist := OLD.is_head_therapist;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_is_head_therapist ON public.physiotherapists;
CREATE TRIGGER trg_guard_is_head_therapist
  BEFORE UPDATE ON public.physiotherapists
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_head_therapist();
