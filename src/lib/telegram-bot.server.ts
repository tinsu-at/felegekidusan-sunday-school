/**
 * Server-only Telegram bot logic for Sunday School registration (Phase 1).
 * The bot token is read from process.env inside functions and is never
 * returned, logged, stored in the database, or exposed to the client.
 */

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
  "birth_year_ec",
  "mother_name",
  "mother_phone",
  "father_name",
  "father_phone",
  "confirm",
] as const;

type Step = (typeof STEPS)[number];

const QUESTIONS: Record<Exclude<Step, "confirm">, string> = {
  full_name: "1️⃣ ሙሉ ስም ከነአያት\n\nእባክዎ የተማሪውን ሙሉ ስም ከነአያት ያስገቡ።",
  christian_name: "2️⃣ የክርስትና ስም\n\nእባክዎ የተማሪውን የክርስትና ስም ያስገቡ።",
  birth_year_ec:
    "3️⃣ የትውልድ ዘመን\n\nእባክዎ የትውልድ ዘመኑን በኢትዮጵያ አቆጣጠር ያስገቡ።\n\nለምሳሌ፦ 2012",
  mother_name: "4️⃣ የእናት ስም\n\nእባክዎ የእናቱን ሙሉ ስም ያስገቡ።",
  mother_phone:
    "5️⃣ የእናት ስልክ\n\nእባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
  father_name: "6️⃣ የአባት ስም\n\nእባክዎ የአባቱን ሙሉ ስም ያስገቡ።",
  father_phone:
    "7️⃣ የአባት ስልክ\n\nእባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
};

const WELCOME =
  "🙏 እንኳን ወደ እሁድ ት/ቤት ምዝገባ በደህና መጡ!\n\nየተማሪውን መረጃ በመሙላት ለምዝገባ ይጀምሩ።";

const START_KEYBOARD = {
  inline_keyboard: [[{ text: "📝 ምዝገባ ጀምር", callback_data: "start_reg" }]],
};

const CONFIRM_KEYBOARD = {
  inline_keyboard: [
    [{ text: "✅ አዎ፣ አረጋግጣለሁ", callback_data: "confirm_yes" }],
    [{ text: "❌ ሰርዝ", callback_data: "confirm_no" }],
  ],
};

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

function validateName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) return null;
  return name;
}

function validateBirthYear(value: string): number | null {
  const raw = normalizeDigits(value);
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  const max = currentEthiopianYear();
  if (year < 1950 || year > max) return null;
  return year;
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

type Answers = Partial<Record<Exclude<Step, "confirm">, string>>;

function summary(a: Answers): string {
  return [
    "📋 ያስገቡት መረጃ",
    "",
    `👤 ሙሉ ስም፦ ${a.full_name}`,
    `✝️ የክርስትና ስም፦ ${a.christian_name}`,
    `🎂 የትውልድ ዘመን፦ ${a.birth_year_ec}`,
    `👩 የእናት ስም፦ ${a.mother_name}`,
    `📞 የእናት ስልክ፦ ${a.mother_phone}`,
    `👨 የአባት ስም፦ ${a.father_name}`,
    `📞 የአባት ስልክ፦ ${a.father_phone}`,
    "",
    "መረጃው ትክክል ነው?",
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

  const { data: session } = await supabaseAdmin
    .from("registration_sessions")
    .select("step, answers")
    .eq("telegram_user_id", userId)
    .maybeSingle();

  const answers: Answers = (session?.answers as Answers | null) ?? {};
  const step = (session?.step as Step | "idle" | undefined) ?? "idle";

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

  // --- Button presses ---
  if (cb?.data === "start_reg") {
    await saveSession("full_name", {});
    await sendMessage(chatId, QUESTIONS.full_name);
    return;
  }

  if (cb?.data === "confirm_no") {
    await clearSession();
    await sendMessage(chatId, "❌ ምዝገባው ተሰርዟል። ምንም መረጃ አልተቀመጠም።");
    await sendMessage(chatId, WELCOME, START_KEYBOARD);
    return;
  }

  if (cb?.data === "confirm_yes") {
    if (step !== "confirm") {
      await sendMessage(chatId, WELCOME, START_KEYBOARD);
      return;
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("registrations")
      .insert({
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        telegram_username: username,
        full_name: answers.full_name!,
        christian_name: answers.christian_name!,
        birth_year_ec: Number(answers.birth_year_ec),
        mother_name: answers.mother_name!,
        mother_phone: answers.mother_phone!,
        father_name: answers.father_name!,
        father_phone: answers.father_phone!,
      })
      .select("registration_id")
      .single();

    if (error || !inserted) {
      console.error("Failed to save registration");
      await sendMessage(
        chatId,
        "⚠️ ምዝገባውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
      );
      return;
    }

    await clearSession();
    await sendMessage(
      chatId,
      `✅ ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!\n\nየምዝገባ ቁጥር፦ ${inserted.registration_id}\n\n🙏 ስለተመዘገቡ እናመሰግናለን!`,
    );
    return;
  }

  // --- Text messages ---
  const text = (msg?.text ?? "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    await clearSession();
    await sendMessage(chatId, WELCOME, START_KEYBOARD);
    return;
  }

  if (text.startsWith("/cancel")) {
    await clearSession();
    await sendMessage(chatId, "❌ ምዝገባው ተሰርዟል።");
    await sendMessage(chatId, WELCOME, START_KEYBOARD);
    return;
  }

  if (step === "idle" || !STEPS.includes(step as Step)) {
    await sendMessage(chatId, WELCOME, START_KEYBOARD);
    return;
  }

  if (step === "confirm") {
    await sendMessage(chatId, summary(answers), CONFIRM_KEYBOARD);
    return;
  }

  // Validate the answer for the current question.
  let value: string | null = null;
  if (step === "birth_year_ec") {
    const year = validateBirthYear(text);
    if (year === null) {
      await sendMessage(
        chatId,
        `⚠️ የትውልድ ዘመኑ ትክክል አይደለም። እባክዎ በኢትዮጵያ አቆጣጠር በአራት አሃዝ ያስገቡ (ከ1950 እስከ ${currentEthiopianYear()})።\n\nለምሳሌ፦ 2012`,
      );
      return;
    }
    value = String(year);
  } else if (step === "mother_phone" || step === "father_phone") {
    value = validatePhone(text);
    if (value === null) {
      await sendMessage(
        chatId,
        "⚠️ የስልክ ቁጥሩ ትክክል አይደለም። እባክዎ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
      );
      return;
    }
  } else {
    value = validateName(text);
    if (value === null) {
      await sendMessage(
        chatId,
        "⚠️ ስሙ ትክክል አይደለም። እባክዎ ስሙን ሙሉ በሙሉ ያስገቡ።",
      );
      return;
    }
  }

  const nextAnswers: Answers = { ...answers, [step]: value };
  const nextStep = STEPS[STEPS.indexOf(step) + 1] as Step;
  await saveSession(nextStep, nextAnswers);

  if (nextStep === "confirm") {
    await sendMessage(chatId, summary(nextAnswers), CONFIRM_KEYBOARD);
  } else {
    await sendMessage(chatId, QUESTIONS[nextStep as Exclude<Step, "confirm">]);
  }
}
