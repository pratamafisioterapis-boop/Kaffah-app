-- Pemakaian API Claude per hari dan model (dicatat wa-ai-reply; tampil di /status Telegram).
CREATE TABLE IF NOT EXISTS public.wa_ai_usage (
  day            date   NOT NULL,
  model          text   NOT NULL,
  calls          int    NOT NULL DEFAULT 0,
  input_tokens   bigint NOT NULL DEFAULT 0,
  cache_read     bigint NOT NULL DEFAULT 0,
  cache_write    bigint NOT NULL DEFAULT 0,
  output_tokens  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, model)
);
ALTER TABLE public.wa_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wa_ai_usage_add(p_day date, p_model text, p_in bigint, p_cr bigint, p_cw bigint, p_out bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO wa_ai_usage (day, model, calls, input_tokens, cache_read, cache_write, output_tokens)
  VALUES (p_day, p_model, 1, p_in, p_cr, p_cw, p_out)
  ON CONFLICT (day, model) DO UPDATE SET
    calls = wa_ai_usage.calls + 1,
    input_tokens = wa_ai_usage.input_tokens + EXCLUDED.input_tokens,
    cache_read = wa_ai_usage.cache_read + EXCLUDED.cache_read,
    cache_write = wa_ai_usage.cache_write + EXCLUDED.cache_write,
    output_tokens = wa_ai_usage.output_tokens + EXCLUDED.output_tokens;
$$;
REVOKE ALL ON FUNCTION public.wa_ai_usage_add(date, text, bigint, bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;
