/**
 * Server-only Telegram bot logic for ሰንበት ት/ቤት registration.
 * Bilingual (አማርኛ / English); language preference is stored per Telegram user id.
 * The bot token is read from process.env inside functions and is never
 * returned, logged, stored in the database, or exposed to the client.
 */

import { T, asLang, type Lang } from "@/lib/telegram-i18n";

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

const STEPS = [
  "full_name",
  "christian_name",
  "gender",
  "birth_date_ec",
  "mother_name",
  "mother_phone",
  "father_name",
  "father_phone",
  "confirm",
] as const;

type Step = (typeof STEPS)[number];
type FieldStep = Exclude<Step, "confirm">;

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

const genderKeyboard = (lang: Lang) => ({
  inline_keyboard: [
    [{ text: T[lang].btnMale, callback_data: "gender_male" }],
    [{ text: T[lang].btnFemale, callback_data: "gender_female" }],
  ],
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

/** Notifies the school admin chat about a new registration, if configured. */
async function notifyAdmin(lines: string[]) {
  const adminChatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (!adminChatId) return;
  try {
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: lines.join("\n"),
    });
  } catch {
    console.error("Admin notification could not be delivered");
  }
}

// ---------- Validation ----------

/** Converts Ethiopic/Arabic-Indic digits to ASCII and trims. */
function normalizeDigits(input: string): string {
  const ethiopic: Record<string, string> = {
    "፩": "1",
    "፪": "2",
    "፫": "3",
    "፬": "4",
    "፭": "5",
    "፮": "6",
    "፯": "7",
    "፰": "8",
    "፱": "9",
  };
  return input
    .split("")
    .map((c) => ethiopic[c] ?? c)
    .join("")
    .trim();
}

function currentEthiopianYear(): number {
  const now = new Date();
  const gYear = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  // Ethiopian new year falls on Sep 11 (Sep 12 in years before a Gregorian leap year).
  const afterNewYear = month > 9 || (month === 9 && day >= 11);
  return afterNewYear ? gYear - 7 : gYear - 8;
}

/** Only Ethiopic letters, separated by single spaces. */
const ETHIOPIC_WORD = /^[\u1200-\u137F]+$/;
const LATIN_WORD = /^[A-Za-z][A-Za-z'’.-]*$/;

function validateAmharicName(
  value: string,
  exactWords: number | null,
  lang: Lang,
): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const words = name.split(" ");
  if (exactWords !== null && words.length !== exactWords) return null;
  if (exactWords === null && (words.length < 1 || words.length > 3)) return null;
  const ok = (w: string) =>
    ETHIOPIC_WORD.test(w) || (lang === "en" && LATIN_WORD.test(w));
  if (!words.every(ok)) return null;
  if (name.length > 100) return null;
  return name;
}

function isEthiopianLeapYear(year: number): boolean {
  return year % 4 === 3;
}

export function validateEthiopianDate(
  value: string,
): { day: number; month: number; year: number; formatted: string } | null {
  const raw = normalizeDigits(value).replace(/[.\-]/g, "/").replace(/\s/g, "");
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 13) return null;
  const maxDay = month === 13 ? (isEthiopianLeapYear(year) ? 6 : 5) : 30;
  if (day < 1 || day > maxDay) return null;
  if (year < 1950 || year > currentEthiopianYear()) return null;
  const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  return { day, month, year, formatted };
}

function validatePhone(value: string): string | null {
  const raw = normalizeDigits(value).replace(/[\s\-()]/g, "");
  let match = /^(?:\+251|251)([79]\d{8})$/.exec(raw);
  if (match) return `+251${match[1]}`;
  match = /^0([79]\d{8})$/.exec(raw);
  if (match) return `+251${match[1]}`;
  return null;
}

// ---------- Session helpers ----------

type Answers = Partial<Record<FieldStep, string>> & { reg_id?: string };

/** Stored gender values stay Amharic; only the display label is translated. */
function genderLabel(stored: string | undefined, lang: Lang): string {
  if (stored === "ወንድ") return T[lang].gender.male;
  if (stored === "ሴት") return T[lang].gender.female;
  return stored ?? "";
}

function summary(a: Answers, lang: Lang): string {
  const t = T[lang];
  const L = t.labels;
  return [
    t.summaryTitle,
    "",
    `${L.regId}: ${a.reg_id}`,
    "",
    `${L.fullName}: ${a.full_name}`,
    `${L.christianName}: ${a.christian_name}`,
    `${L.gender}: ${genderLabel(a.gender, lang)}`,
    `${L.birthDate}: ${a.birth_date_ec}`,
    `${L.motherName}: ${a.mother_name}`,
    `${L.motherPhone}: ${a.mother_phone}`,
    `${L.fatherName}: ${a.father_name}`,
    `${L.fatherPhone}: ${a.father_phone}`,
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

  const [{ data: session }, { data: pref }] = await Promise.all([
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
  ]);

  let lang: Lang = asLang(pref?.lang);
  const knownLanguage = !!pref;
  const answers: Answers = (session?.answers as Answers | null) ?? {};
  const step = (session?.step as Step | "idle" | undefined) ?? "idle";

  const saveLanguage = async (next: Lang) => {
    lang = next;
    await supabaseAdmin
      .from("bot_user_prefs")
      .upsert(
        { telegram_user_id: userId, lang: next },
        { onConflict: "telegram_user_id" },
      );
  };

  const saveSession = async (nextStep: Step | "idle", nextAnswers: Answers) => {
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

  /** Reserves the FKN id, saves the session and sends the summary. */
  const goToConfirm = async (nextAnswers: Answers) => {
    let regId = nextAnswers.reg_id;
    if (!regId) {
      const { data } = await supabaseAdmin.rpc("reserve_registration_id");
      regId = (data as string | null) ?? undefined;
    }
    const withId: Answers = { ...nextAnswers, ...(regId ? { reg_id: regId } : {}) };
    await saveSession("confirm", withId);
    await sendMessage(chatId, summary(withId, lang), confirmKeyboard(lang));
  };

  const askNext = async (nextStep: Step, nextAnswers: Answers) => {
    if (nextStep === "confirm") {
      await goToConfirm(nextAnswers);
      return;
    }
    await saveSession(nextStep, nextAnswers);
    if (nextStep === "gender") {
      await sendMessage(chatId, T[lang].questions.gender, genderKeyboard(lang));
    } else {
      await sendMessage(chatId, T[lang].questions[nextStep]);
    }
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
    await saveSession("full_name", {});
    await sendMessage(chatId, T[lang].questions.full_name);
    return;
  }

  if (cb?.data === "help") {
    await sendMessage(chatId, T[lang].help, helpKeyboard(lang));
    return;
  }

  if (cb?.data === "home") {
    await clearSession();
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (cb?.data === "gender_male" || cb?.data === "gender_female") {
    if (step !== "gender") {
      await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
      return;
    }
    const gender = cb.data === "gender_male" ? "ወንድ" : "ሴት";
    await askNext("birth_date_ec", { ...answers, gender });
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
    const date = validateEthiopianDate(answers.birth_date_ec ?? "");
    const { data: inserted, error } = await supabaseAdmin
      .from("registrations")
      .insert({
        ...(answers.reg_id ? { registration_id: answers.reg_id } : {}),
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
        full_name: answers.full_name!,
        christian_name: answers.christian_name!,
        gender: answers.gender!,
        birth_date_ec: date?.formatted ?? answers.birth_date_ec!,
        birth_day_ec: date?.day ?? null,
        birth_month_ec: date?.month ?? null,
        birth_year_ec: date?.year ?? 0,
        mother_name: answers.mother_name!,
        mother_phone: answers.mother_phone!,
        father_name: answers.father_name!,
        father_phone: answers.father_phone!,
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
    await notifyAdmin([
      "🆕 አዲስ ምዝገባ / New registration",
      "",
      `🆔 ${inserted.registration_id}`,
      `👤 ${answers.full_name}`,
      `✝️ ${answers.christian_name}`,
      `⚥ ${answers.gender}`,
      `🎂 ${date?.formatted ?? answers.birth_date_ec}`,
    ]);

    // 3) Email confirmation to the school inbox (skipped until email sending is configured).
    try {
      const { sendRegistrationEmail } = await import(
        "@/lib/registration-email.server"
      );
      await sendRegistrationEmail({
        registrationId: inserted.registration_id,
        fullName: answers.full_name!,
        christianName: answers.christian_name!,
        gender: answers.gender!,
        birthDateEc: date?.formatted ?? answers.birth_date_ec!,
        motherName: answers.mother_name!,
        fatherName: answers.father_name!,
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
    await sendMessage(chatId, T[lang].help, helpKeyboard(lang));
    return;
  }

  if (text.startsWith("/cancel")) {
    await clearSession();
    await sendMessage(chatId, T[lang].cancelled);
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (step === "idle" || !STEPS.includes(step as Step)) {
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang));
    return;
  }

  if (step === "confirm") {
    await sendMessage(chatId, summary(answers, lang), confirmKeyboard(lang));
    return;
  }

  if (step === "gender") {
    await sendMessage(chatId, T[lang].questions.gender, genderKeyboard(lang));
    return;
  }

  // Validate the answer for the current question.
  let value: string | null = null;
  if (step === "birth_date_ec") {
    const date = validateEthiopianDate(text);
    if (!date) {
      await sendMessage(chatId, T[lang].errDate(currentEthiopianYear()));
      return;
    }
    value = date.formatted;
  } else if (step === "mother_phone" || step === "father_phone") {
    value = validatePhone(text);
    if (value === null) {
      await sendMessage(chatId, T[lang].errPhone);
      return;
    }
  } else if (step === "christian_name") {
    value = validateAmharicName(text, null, lang);
    if (value === null) {
      await sendMessage(chatId, T[lang].errChristianName);
      return;
    }
  } else {
    value = validateAmharicName(text, 3, lang);
    if (value === null) {
      await sendMessage(chatId, T[lang].errName);
      return;
    }
  }

  const nextAnswers: Answers = { ...answers, [step]: value };
  const nextStep = STEPS[STEPS.indexOf(step) + 1] as Step;
  await askNext(nextStep, nextAnswers);
}
