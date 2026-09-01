/**
 * Server-only Telegram bot logic for ሰንበት ት/ቤት registration.
 * Bilingual (አማርኛ / English); language preference is stored per Telegram user id.
 * The question flow is driven by the latest PUBLISHED question configuration in
 * the database, so the owner can change questions without a redeploy.
 * The bot token is read from process.env inside functions and is never
 * returned, logged, stored in the database, or exposed to the client.
 */

import { helpMessage } from "@/lib/help-content.server";
import {
  currentEthiopianYear,
  isCoreField,
  label as questionLabel,
  optionLabel,
  questionError,
  validateAnswer,
  validateEthiopianDate,
  type QuestionConfig,
} from "@/lib/question-config";
import { publishedQuestions } from "@/lib/question-config.server";
import { T, asLang, type Lang } from "@/lib/telegram-i18n";

export { validateEthiopianDate };

type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    from?: { id?: number; username?: string };
    text?: string;
  };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number; username?: string };
    message?: { chat?: { id?: number } };
  };
};

/** Used only when nothing has been published yet (should not happen). */
const FALLBACK_QUESTIONS: QuestionConfig[] = [
  {
    field_key: "full_name",
    position: 1,
    label_am: T.am.questions.full_name,
    label_en: T.en.questions.full_name,
    input_type: "text",
    required: true,
    amharic_only: true,
    min_words: null,
    max_words: null,
    exact_words: 3,
    error_am: T.am.errName,
    error_en: T.en.errName,
    options: [],
    is_core: true,
    active: true,
  },
];

// ---------- Keyboards ----------

const LANGUAGE_KEYBOARD = {
  inline_keyboard: [
    [{ text: "🇪🇹 አማርኛ", callback_data: "lang_am" }],
    [{ text: "🇬🇧 English", callback_data: "lang_en" }],
  ],
};

const startKeyboard = (lang: Lang) => ({
  inline_keyboard: [
    [{ text: T[lang].btnStart, callback_data: "start_reg" }],
    [{ text: T[lang].btnHelp, callback_data: "help" }],
    [{ text: T[lang].btnLanguage, callback_data: "language" }],
  ],
});

const helpKeyboard = (
  lang: Lang,
  buttons: { text: string; url: string }[] = [],
) => ({
  inline_keyboard: [
    ...buttons.map((b) => [{ text: b.text, url: b.url }]),
    [{ text: T[lang].btnStart, callback_data: "start_reg" }],
    [{ text: `⬅️ ${T[lang].btnHome}`, callback_data: "home" }],
  ],
});

const optionsKeyboard = (q: QuestionConfig, lang: Lang) => ({
  inline_keyboard: q.options.map((o, i) => [
    { text: optionLabel(o, lang), callback_data: `opt_${i}` },
  ]),
});

const confirmKeyboard = (lang: Lang) => ({
  inline_keyboard: [
    [{ text: T[lang].btnConfirm, callback_data: "confirm_yes" }],
    [{ text: T[lang].btnCancel, callback_data: "confirm_no" }],
  ],
});

const homeKeyboard = (lang: Lang) => ({
  inline_keyboard: [[{ text: T[lang].btnHome, callback_data: "home" }]],
});

// ---------- Telegram API ----------

async function telegram(method: string, body: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Bot token is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Never include the token or personal data in logs.
    console.error(`Telegram API ${method} failed with status ${res.status}`);
  }
  return res;
}

async function sendMessage(chatId: number, text: string, keyboard?: unknown) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

/**
 * Notifies every active Telegram admin (owner + admins) about a new
 * registration, plus the configured fallback admin chat. Chat ids are
 * de-duplicated so nobody receives the same alert twice.
 */
async function notifyAdmins(lines: string[]) {
  const text = lines.join("\n");
  const targets = new Set<string>();

  const fallback = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (fallback) targets.add(String(fallback).trim());

  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("bot_admins")
      .select("telegram_chat_id")
      .eq("active", true);
    for (const row of data ?? []) {
      if (row.telegram_chat_id) targets.add(String(row.telegram_chat_id));
    }
  } catch {
    console.error("Admin list could not be loaded for notifications");
  }

  for (const chatId of targets) {
    try {
      await telegram("sendMessage", { chat_id: chatId, text });
    } catch {
      console.error("Admin notification could not be delivered");
    }
  }
}

// ---------- Session helpers ----------

type Answers = Record<string, string | undefined> & { reg_id?: string };

/** Short one-line label for the confirmation summary. */
function shortLabel(q: QuestionConfig, lang: Lang): string {
  const first = questionLabel(q, lang).split("\n")[0] ?? q.field_key;
  return first.replace(/^[\d\u0030-\u0039\uFE0F\u20E3\s.]+/u, "").trim() || q.field_key;
}

function displayValue(q: QuestionConfig, value: string | undefined, lang: Lang) {
  if (!value) return "-";
  if (q.input_type === "options") {
    const hit = q.options.find((o) => o.value === value);
    return hit ? optionLabel(hit, lang) : value;
  }
  return value;
}

function summary(
  questions: QuestionConfig[],
  a: Answers,
  lang: Lang,
): string {
  const t = T[lang];
  return [
    t.summaryTitle,
    "",
    `${t.labels.regId}: ${a.reg_id ?? "-"}`,
    "",
    ...questions.map(
      (q) => `${shortLabel(q, lang)}: ${displayValue(q, a[q.field_key], lang)}`,
    ),
    "",
    t.summaryQuestion,
  ].join("\n");
}

// ---------- Update handling ----------

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Duplicate-delivery protection: Telegram retries failed deliveries.
  if (typeof update.update_id === "number") {
    const { error } = await supabaseAdmin
      .from("telegram_updates")
      .insert({ update_id: update.update_id });
    if (error) return; // already processed
  }

  const cb = update.callback_query;
  const msg = update.message;

  const userId = cb?.from?.id ?? msg?.from?.id;
  const chatId = cb?.message?.chat?.id ?? msg?.chat?.id;
  const username = cb?.from?.username ?? msg?.from?.username ?? null;
  if (!userId || !chatId) return;

  if (cb?.id) {
    await telegram("answerCallbackQuery", { callback_query_id: cb.id });
  }

  const [{ data: session }, { data: pref }, published] = await Promise.all([
    supabaseAdmin
      .from("registration_sessions")
      .select("step, answers")
      .eq("telegram_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("bot_user_prefs")
      .select("lang")
      .eq("telegram_user_id", userId)
      .maybeSingle(),
    publishedQuestions(),
  ]);

  const questions = published.length ? published : FALLBACK_QUESTIONS;
  const findQuestion = (key: string) =>
    questions.find((q) => q.field_key === key);

  let lang: Lang = asLang(pref?.lang);
  const knownLanguage = !!pref;
  const answers: Answers = (session?.answers as Answers | null) ?? {};
  const step = (session?.step as string | undefined) ?? "idle";

  const saveLanguage = async (next: Lang) => {
    lang = next;
    await supabaseAdmin
      .from("bot_user_prefs")
      .upsert(
        { telegram_user_id: userId, lang: next },
        { onConflict: "telegram_user_id" },
      );
  };

  const saveSession = async (nextStep: string, nextAnswers: Answers) => {
    await supabaseAdmin.from("registration_sessions").upsert(
      {
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
        step: nextStep,
        answers: nextAnswers,
      },
      { onConflict: "telegram_user_id" },
    );
  };

  const clearSession = async () => {
    await supabaseAdmin
      .from("registration_sessions")
      .delete()
      .eq("telegram_user_id", userId);
  };

  const askQuestion = async (q: QuestionConfig) => {
    if (q.input_type === "options" && q.options.length) {
      await sendMessage(chatId, questionLabel(q, lang), optionsKeyboard(q, lang));
    } else {
      await sendMessage(chatId, questionLabel(q, lang));
    }
  };

  /** Reserves the FKN id, saves the session and sends the summary. */
  const goToConfirm = async (nextAnswers: Answers) => {
    let regId = nextAnswers.reg_id;
    if (!regId) {
      const { data } = await supabaseAdmin.rpc("reserve_registration_id");
      regId = (data as string | null) ?? undefined;
    }
    const withId: Answers = { ...nextAnswers, ...(regId ? { reg_id: regId } : {}) };
    await saveSession("confirm", withId);
    await sendMessage(chatId, summary(questions, withId, lang), confirmKeyboard(lang));
  };

  /** Moves to the question after `currentKey` (or the summary when done). */
  const advance = async (currentKey: string, nextAnswers: Answers) => {
    const index = questions.findIndex((q) => q.field_key === currentKey);
    const next = questions[index + 1];
    if (!next) {
      await goToConfirm(nextAnswers);
      return;
    }
    await saveSession(next.field_key, nextAnswers);
    await askQuestion(next);
  };

  // --- Language selection ---
  if (cb?.data === "lang_am" || cb?.data === "lang_en") {
    await saveLanguage(cb.data === "lang_en" ? "en" : "am");
    await sendMessage(chatId, T[lang].languageSet);
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (cb?.data === "language") {
    await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD);
    return;
  }

  // --- Button presses ---
  if (cb?.data === "start_reg") {
    const first = questions[0];
    if (!first) {
      await sendMessage(chatId, T[lang].saveFailed);
      return;
    }
    await saveSession(first.field_key, {});
    await askQuestion(first);
    return;
  }

  if (cb?.data === "help") {
    const help = await helpMessage(lang);
    await sendMessage(chatId, help.text, helpKeyboard(lang, help.buttons));
    return;
  }

  if (cb?.data === "home") {
    await clearSession();
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  // Option buttons (gender and any owner-created choice question).
  // `gender_male` / `gender_female` keep older in-flight sessions working.
  if (cb?.data?.startsWith("opt_") || cb?.data?.startsWith("gender_")) {
    const current = findQuestion(step);
    if (!current || current.input_type !== "options") {
      await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
      return;
    }
    const index = cb.data.startsWith("opt_")
      ? Number(cb.data.slice(4))
      : cb.data === "gender_male"
        ? 0
        : 1;
    const option = current.options[index];
    if (!option) {
      await askQuestion(current);
      return;
    }
    await advance(current.field_key, {
      ...answers,
      [current.field_key]: option.value,
    });
    return;
  }

  if (cb?.data === "confirm_no") {
    await clearSession();
    await sendMessage(chatId, T[lang].cancelled);
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (cb?.data === "confirm_yes") {
    if (step !== "confirm") {
      await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
      return;
    }

    // Column-backed answers go to their columns; owner-added questions are
    // stored in extra_answers so existing records/columns never change.
    const extras: Record<string, string> = {};
    for (const q of questions) {
      const value = answers[q.field_key];
      if (!isCoreField(q.field_key) && value) extras[q.field_key] = value;
    }

    const rawDate = answers["birth_date_ec"] ?? "";
    const date = validateEthiopianDate(rawDate);
    const yearOnly = Number(String(rawDate).replace(/\D/g, "")) || 0;

    const { data: inserted, error } = await supabaseAdmin
      .from("registrations")
      .insert({
        ...(answers.reg_id ? { registration_id: answers.reg_id } : {}),
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
        full_name: answers["full_name"] ?? "-",
        christian_name: answers["christian_name"] ?? "-",
        gender: answers["gender"] ?? "-",
        birth_date_ec: date?.formatted ?? rawDate,
        birth_day_ec: date?.day ?? null,
        birth_month_ec: date?.month ?? null,
        birth_year_ec: date?.year ?? (yearOnly >= 1900 ? yearOnly : 0),
        mother_name: answers["mother_name"] ?? "-",
        mother_phone: answers["mother_phone"] ?? "-",
        father_name: answers["father_name"] ?? "-",
        father_phone: answers["father_phone"] ?? "-",
        extra_answers: extras,
        status: "pending",
      })
      .select("registration_id, created_at")
      .single();

    if (error || !inserted) {
      console.error("Failed to save registration");
      await sendMessage(chatId, T[lang].saveFailed);
      return;
    }

    await clearSession();

    // 1) Telegram confirmation to the registrant.
    await sendMessage(chatId, T[lang].success(inserted.registration_id));
    await sendMessage(chatId, T[lang].contacts, homeKeyboard(lang));

    // 2) Admin Telegram notification (failures never affect the saved row).
    await notifyAdmins([
      "🆕 አዲስ ምዝገባ / New registration",
      "",
      `🆔 ${inserted.registration_id}`,
      ...questions.map(
        (q) => `${shortLabel(q, "am")}: ${displayValue(q, answers[q.field_key], "am")}`,
      ),
    ]);

    // 3) Email confirmation to the school inbox (skipped until email sending is configured).
    try {
      const { sendRegistrationEmail } = await import(
        "@/lib/registration-email.server"
      );
      await sendRegistrationEmail({
        registrationId: inserted.registration_id,
        fullName: answers["full_name"] ?? "-",
        christianName: answers["christian_name"] ?? "-",
        gender: answers["gender"] ?? "-",
        birthDateEc: date?.formatted ?? rawDate,
        motherName: answers["mother_name"] ?? "-",
        motherPhone: answers["mother_phone"] ?? "-",
        fatherName: answers["father_name"] ?? "-",
        fatherPhone: answers["father_phone"] ?? "-",
        createdAt: inserted.created_at,
      });
    } catch {
      // Registration is already saved; email problems must never lose it.
      console.error("Registration confirmation email could not be sent");
    }
    return;
  }

  // --- Text messages ---
  const text = (msg?.text ?? "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    await clearSession();
    if (!knownLanguage) {
      await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD);
      return;
    }
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (text.startsWith("/language") || text.startsWith("/lang")) {
    await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD);
    return;
  }

  if (text.startsWith("/help")) {
    const help = await helpMessage(lang);
    await sendMessage(chatId, help.text, helpKeyboard(lang, help.buttons));
    return;
  }

  // Lets a staff member read their own Telegram id so an owner can add them
  // as an admin in the dashboard. No other user's data is ever revealed.
  if (text.startsWith("/id") || text.startsWith("/myid")) {
    await sendMessage(
      chatId,
      `🆔 Telegram ID: ${userId}\n💬 Chat ID: ${chatId}`,
      homeKeyboard(lang),
    );
    return;
  }

  if (text.startsWith("/cancel")) {
    await clearSession();
    await sendMessage(chatId, T[lang].cancelled);
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (step === "confirm") {
    await sendMessage(chatId, summary(questions, answers, lang), confirmKeyboard(lang));
    return;
  }

  const current = findQuestion(step);
  if (!current) {
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (current.input_type === "options") {
    await askQuestion(current);
    return;
  }

  // Optional questions may be skipped.
  const skipped =
    !current.required && /^(-|\/skip|skip|ዝለል)$/i.test(text.trim());
  const value = skipped ? "" : validateAnswer(current, text, lang);
  if (value === null) {
    await sendMessage(chatId, questionError(current, lang));
    return;
  }

  await advance(current.field_key, { ...answers, [current.field_key]: value });
}

export { currentEthiopianYear };
