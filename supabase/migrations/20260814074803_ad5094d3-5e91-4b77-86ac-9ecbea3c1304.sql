CREATE TABLE public.bot_user_prefs (
  telegram_user_id BIGINT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'am',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.bot_user_prefs TO service_role;

ALTER TABLE public.bot_user_prefs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_bot_user_prefs_updated_at
BEFORE UPDATE ON public.bot_user_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();