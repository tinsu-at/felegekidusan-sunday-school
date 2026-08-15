CREATE TABLE public.bot_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_chat_id bigint NOT NULL,
  label text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bot_admins TO authenticated;
GRANT ALL ON public.bot_admins TO service_role;
ALTER TABLE public.bot_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bot admins"
ON public.bot_admins FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_bot_admins_updated_at
BEFORE UPDATE ON public.bot_admins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.help_content (
  lang text PRIMARY KEY CHECK (lang IN ('am','en')),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  contacts text NOT NULL DEFAULT '',
  announcements text NOT NULL DEFAULT '',
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.help_content TO authenticated;
GRANT ALL ON public.help_content TO service_role;
ALTER TABLE public.help_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view help content"
ON public.help_content FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_help_content_updated_at
BEFORE UPDATE ON public.help_content
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.help_content (lang, title, body, instructions, contacts, announcements, buttons) VALUES
('am',
 '📖 ስለ ምዝገባው ተጨማሪ መረጃ',
 'የሰንበት ት/ቤት ምዝገባ ለማድረግ እባክዎ የሚጠየቁትን የተማሪ እና የወላጆች መረጃ በትክክል ያስገቡ።',
 E'1. «📝 ምዝገባ ጀምር» የሚለውን ይጫኑ።\n2. የሚጠየቁትን ጥያቄዎች በቅደም ተከተል ይመልሱ።\n3. በመጨረሻ መረጃውን አረጋግጠው ያስቀምጡ።',
 E'📞 ግንኙነት ክፍል - ቤተልሔም\n0977966450\n\n📚 ትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ\n0902872151',
 '',
 '[]'::jsonb),
('en',
 '📖 About the registration',
 'To register for Sunday School, please enter the requested student and parent details accurately.',
 E'1. Tap "📝 Start registration".\n2. Answer each question in order.\n3. Review the summary and confirm.',
 E'📞 Public Relations - Betlehem\n0977966450\n\n📚 Education Department - Deacon Tinsae Tsegaye\n0902872151',
 '',
 '[]'::jsonb);