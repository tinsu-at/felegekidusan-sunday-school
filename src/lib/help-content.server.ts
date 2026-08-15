/**
 * Server-only access to the editable Help & Information content.
 *
 * The content lives in the `help_content` table so admins can change it from
 * the dashboard and Telegram picks it up immediately — no redeploy needed.
 * If a row is missing we fall back to the built-in bilingual copy.
 */

import { T, type Lang } from "@/lib/telegram-i18n";

export type HelpButton = { text: string; url: string };

export type HelpContent = {
  lang: Lang;
  title: string;
  body: string;
  instructions: string;
  contacts: string;
  announcements: string;
  buttons: HelpButton[];
};

export function defaultHelpContent(lang: Lang): HelpContent {
  const am = lang === "am";
  return {
    lang,
    title: am ? "📖 ስለ ምዝገባው ተጨማሪ መረጃ" : "📖 About the registration",
    body: am
      ? "የሰንበት ት/ቤት ምዝገባ ለማድረግ እባክዎ የሚጠየቁትን የተማሪ እና የወላጆች መረጃ በትክክል ያስገቡ።"
      : "To register for Sunday School, please enter the requested student and parent details accurately.",
    instructions: am
      ? "1. «📝 ምዝገባ ጀምር» የሚለውን ይጫኑ።\n2. የሚጠየቁትን ጥያቄዎች በቅደም ተከተል ይመልሱ።\n3. በመጨረሻ መረጃውን አረጋግጠው ያስቀምጡ።"
      : '1. Tap "📝 Start registration".\n2. Answer each question in order.\n3. Review the summary and confirm.',
    contacts: am
      ? "📞 ግንኙነት ክፍል - ቤተልሔም\n0977966450\n\n📚 ትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ\n0902872151"
      : "📞 Public Relations - Betlehem\n0977966450\n\n📚 Education Department - Deacon Tinsae Tsegaye\n0902872151",
    announcements: "",
    buttons: [],
  };
}

function asButtons(value: unknown): HelpButton[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((b) => b as Partial<HelpButton>)
    .filter(
      (b): b is HelpButton =>
        typeof b?.text === "string" &&
        typeof b?.url === "string" &&
        /^https?:\/\//i.test(b.url),
    )
    .slice(0, 6);
}

/** Renders the stored help content as plain Telegram text. */
export function renderHelpText(c: HelpContent): string {
  const parts = [c.title, c.body, c.instructions, c.contacts, c.announcements]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.join("\n\n");
}

export async function loadHelpContent(lang: Lang): Promise<HelpContent> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("help_content")
      .select("lang, title, body, instructions, contacts, announcements, buttons")
      .eq("lang", lang)
      .maybeSingle();
    if (!data) return defaultHelpContent(lang);
    return {
      lang,
      title: data.title ?? "",
      body: data.body ?? "",
      instructions: data.instructions ?? "",
      contacts: data.contacts ?? "",
      announcements: data.announcements ?? "",
      buttons: asButtons(data.buttons),
    };
  } catch {
    return defaultHelpContent(lang);
  }
}

/** Help text for Telegram, with a safe fallback to the built-in copy. */
export async function helpMessage(
  lang: Lang,
): Promise<{ text: string; buttons: HelpButton[] }> {
  const content = await loadHelpContent(lang);
  const text = renderHelpText(content);
  return { text: text || T[lang].help, buttons: content.buttons };
}
