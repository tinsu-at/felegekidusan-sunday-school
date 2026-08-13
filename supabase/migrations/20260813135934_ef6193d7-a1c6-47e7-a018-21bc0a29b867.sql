CREATE SEQUENCE public.registration_number_seq START 1;

CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id TEXT NOT NULL UNIQUE DEFAULT ('SS-' || lpad(nextval('public.registration_number_seq')::text, 6, '0')),
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  full_name TEXT NOT NULL,
  christian_name TEXT NOT NULL,
  birth_year_ec INTEGER NOT NULL,
  mother_name TEXT NOT NULL,
  mother_phone TEXT NOT NULL,
  father_name TEXT NOT NULL,
  father_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_registrations_telegram_user_id ON public.registrations (telegram_user_id);

GRANT ALL ON public.registrations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.registration_number_seq TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.registration_sessions (
  telegram_user_id BIGINT NOT NULL PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  step TEXT NOT NULL DEFAULT 'idle',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.registration_sessions TO service_role;
ALTER TABLE public.registration_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.telegram_updates (
  update_id BIGINT NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_registration_sessions_updated_at BEFORE UPDATE ON public.registration_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();