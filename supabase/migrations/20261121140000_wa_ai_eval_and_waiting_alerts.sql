-- (A) Uji regresi AI WhatsApp: soal tetap + hasil per jalan.
-- (D) Peringatan slot kosong untuk waiting list (dikirim ke Telegram owner, bukan ke pasien).

BEGIN;

-- ---------------------------------------------------------------- waiting list alerts
CREATE TABLE IF NOT EXISTS public.waiting_list_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiting_list_id  uuid NOT NULL REFERENCES public.waiting_list(id) ON DELETE CASCADE,
  therapist_id     uuid NOT NULL,
  slot_date        date NOT NULL,
  slot_time        text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waiting_list_id, therapist_id, slot_date, slot_time)
);
ALTER TABLE public.waiting_list_alerts ENABLE ROW LEVEL SECURITY;
-- Tanpa kebijakan: hanya service role.

-- ---------------------------------------------------------------- uji regresi
CREATE TABLE IF NOT EXISTS public.wa_ai_eval_cases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title          text NOT NULL,
  wa_id          text,
  transcript     text NOT NULL,                       -- boleh memakai {{D+1}}, {{TGL+1}}, {{HARI+1}}
  expected       text NOT NULL,                       -- jawaban/tindakan yang benar (dari admin/owner)
  expected_kind  text NOT NULL DEFAULT 'reply' CHECK (expected_kind IN ('reply', 'silent', 'handoff', 'booking')),
  source         text NOT NULL DEFAULT 'manual',      -- manual | correction | log
  source_ref     uuid,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wa_ai_eval_cases_source_ref
  ON public.wa_ai_eval_cases (source_ref) WHERE source_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.wa_ai_eval_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  label          text,
  knowledge_md5  text,
  status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done')),
  total          int NOT NULL DEFAULT 0,
  ok             int NOT NULL DEFAULT 0,
  part           int NOT NULL DEFAULT 0,
  bad            int NOT NULL DEFAULT 0,
  pct            int,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.wa_ai_eval_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES public.wa_ai_eval_runs(id) ON DELETE CASCADE,
  case_id     uuid NOT NULL REFERENCES public.wa_ai_eval_cases(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
  draft       text,
  actions     jsonb,
  verdict     text,                                   -- sesuai | sebagian | tidak | error
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_ai_eval_results_pending ON public.wa_ai_eval_results (status, created_at);
CREATE INDEX IF NOT EXISTS wa_ai_eval_results_run ON public.wa_ai_eval_results (run_id);

ALTER TABLE public.wa_ai_eval_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ai_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ai_eval_results ENABLE ROW LEVEL SECURITY;
-- Tanpa kebijakan: hanya service role.

-- Mulai satu jalan uji: satu baris hasil 'pending' per soal aktif. Bila masih ada jalan berjalan, pakai itu.
CREATE OR REPLACE FUNCTION public.wa_ai_eval_start(p_clinic uuid, p_label text DEFAULT 'manual')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run uuid; v_total int;
BEGIN
  SELECT id INTO v_run FROM wa_ai_eval_runs WHERE clinic_id = p_clinic AND status = 'running' LIMIT 1;
  IF v_run IS NOT NULL THEN RETURN v_run; END IF;
  INSERT INTO wa_ai_eval_runs (clinic_id, label, knowledge_md5)
  SELECT p_clinic, p_label, md5(coalesce(knowledge_override, '')) FROM wa_ai_settings WHERE clinic_id = p_clinic
  RETURNING id INTO v_run;
  IF v_run IS NULL THEN RETURN NULL; END IF;
  INSERT INTO wa_ai_eval_results (run_id, case_id)
  SELECT v_run, id FROM wa_ai_eval_cases WHERE clinic_id = p_clinic AND active ORDER BY created_at LIMIT 80;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  UPDATE wa_ai_eval_runs SET total = v_total WHERE id = v_run;
  RETURN v_run;
END $$;

-- Jalan otomatis bila pengetahuan berubah sejak jalan terakhir (jeda minimal 60 menit).
CREATE OR REPLACE FUNCTION public.wa_ai_eval_autostart(p_clinic uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_md5 text; v_last record;
BEGIN
  IF EXISTS (SELECT 1 FROM wa_ai_eval_runs WHERE clinic_id = p_clinic AND status = 'running') THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM wa_ai_eval_cases WHERE clinic_id = p_clinic AND active) THEN RETURN NULL; END IF;
  SELECT md5(coalesce(knowledge_override, '')) INTO v_md5 FROM wa_ai_settings WHERE clinic_id = p_clinic;
  SELECT knowledge_md5, started_at INTO v_last FROM wa_ai_eval_runs WHERE clinic_id = p_clinic ORDER BY started_at DESC LIMIT 1;
  IF v_last.started_at IS NOT NULL AND (v_last.knowledge_md5 = v_md5 OR v_last.started_at > now() - interval '60 minutes') THEN
    RETURN NULL;
  END IF;
  RETURN wa_ai_eval_start(p_clinic, 'otomatis: pengetahuan berubah');
END $$;

REVOKE ALL ON FUNCTION public.wa_ai_eval_start(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_ai_eval_autostart(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
