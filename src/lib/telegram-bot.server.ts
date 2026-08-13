/**
 * Server-only Telegram bot logic for ሰንበት ት/ቤት registration (Phase 2).
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

const QUESTIONS: Record<FieldStep, string> = {
  full_name: "1️⃣ ሙሉ ስም ከነአያት\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ያስገቡ።",
  christian_name: "2️⃣ የክርስትና ስም\n\nእባክዎ የክርስትና ስምዎን በአማርኛ ያስገቡ።",
  gender: "3️⃣ ጾታ\n\nእባክዎ ጾታዎን ይምረጡ።",
  birth_date_ec:
    "4️⃣ የትውልድ ቀን\n\nእባክዎ የትውልድ ቀኑን በኢትዮጵያ አቆጣጠር ሙሉ በሙሉ ያስገቡ።\n\nቅርጸት፦ ቀን/ወር/ዓመት\nለምሳሌ፦ 15/03/2012",
  mother_name: "5️⃣ የእናት ስም\n\nእባክዎ የእናቱን ሙሉ ስም ከነአያት በአማርኛ ያስገቡ።",
  mother_phone:
    "6️⃣ የእናት ስልክ\n\nእባክዎ የእናቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
  father_name: "7️⃣ የአባት ስም\n\nእባክዎ የአባቱን ሙሉ ስም ከነአያት በአማርኛ ያስገቡ።",
  father_phone:
    "8️⃣ የአባት ስልክ\n\nእባክዎ የአባቱን ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
};

const WELCOME =
  "🙏 እንኳን ወደ ሰንበት ት/ቤት ምዝገባ በደህና መጡ!\n\nየተማሪውን መረጃ በመሙላት ለምዝገባ ይጀምሩ።";

const CONTACTS =
  "📞 ለተጨማሪ መረጃ እባክዎ ያነጋግሩ፦\n\nግንኙነት ክፍል - ቤተልሔም ዓለም\n0977966450\n\nትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ\n0902872151";

const HELP_TEXT = [
  "📖 ስለ ምዝገባው ተጨማሪ መረጃ",
  "",
  "የሰንበት ት/ቤት ምዝገባ ለማድረግ እባክዎ የሚጠየቁትን የተማሪ እና የወላጆች መረጃ በትክክል ያስገቡ።",
  "",
  "ለተጨማሪ መረጃ ወይም ጥያቄ ከሚከተሉት ክፍሎች ጋር ይገናኙ።",
  "",
  "📞 ግንኙነት ክፍል - ቤተልሔም ዓለም",
  "0977966450",
  "",
  "📚 ትምህርት ክፍል - ዲ/ን ትንሣኤ ጸጋዬ",
  "0902872151",
].join("\n");

const START_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📝 ምዝገባ ጀምር", callback_data: "start_reg" }],
    [{ text: "❓ እገዛ / ተጨማሪ መረጃ", callback_data: "help" }],
  ],
};

const HELP_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📝 ምዝገባ ጀምር", callback_data: "start_reg" }],
    [{ text: "⬅️ ወደ መነሻ", callback_data: "home" }],
  ],
};

const GENDER_KEYBOARD = {
  inline_keyboard: [
    [{ text: "ወንድ", callback_data: "gender_male" }],
    [{ text: "ሴት", callback_data: "gender_female" }],
  ],
};

const CONFIRM_KEYBOARD = {
  inline_keyboard: [
    [{ text: "✅ አዎ፣ አረጋግጣለሁ", callback_data: "confirm_yes" }],
    [{ text: "❌ ሰርዝ", callback_data: "confirm_no" }],
  ],
};

const HOME_KEYBOARD = {
  inline_keyboard: [[{ text: "🏠 ወደ መነሻ", callback_data: "home" }]],
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

/** Only Ethiopic letters, separated by single spaces. */
const ETHIOPIC_WORD = /^[\u1200-\u137F]+$/;

function validateAmharicName(
  value: string,
  exactWords: number | null,
): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const words = name.split(" ");
  if (exactWords !== null && words.length !== exactWords) return null;
  if (exactWords === null && (words.length < 1 || words.length > 3)) return null;
  if (!words.every((w) => ETHIOPIC_WORD.test(w))) return null;
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

function summary(a: Answers): string {
  return [
    "📋 ያስገቡት መረጃ",
    "",
    `🆔 የምዝገባ ቁጥር፦ ${a.reg_id}`,
    "",
    `👤 ሙሉ ስም፦ ${a.full_name}`,
    `✝️ የክርስትና ስም፦ ${a.christian_name}`,
    `⚥ ጾታ፦ ${a.gender}`,
    `🎂 የትውልድ ዘመን፦ ${a.birth_date_ec}`,
    `👩 የእናት ስም፦ ${a.mother_name}`,
    `📞 የእናት ስልክ፦ ${a.mother_phone}`,
    `👨 የአባት ስም፦ ${a.father_name}`,
    `📞 የአባት ስልክ፦ ${a.father_phone}`,
    "",
    "መረጃው ትክክል ነው?",
  ].join("\n");
}

const NAME_ERROR = "❌ እባክዎ ስሙን በአማርኛ በሦስት ቃላት ብቻ ያስገቡ።";
const CHRISTIAN_NAME_ERROR = "❌ እባክዎ የክርስትና ስሙን በአማርኛ ብቻ ያስገቡ።";

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

  /** Reserves the FKN id, saves the session and sends the summary. */
  const goToConfirm = async (nextAnswers: Answers) => {
    let regId = nextAnswers.reg_id;
    if (!regId) {
      const { data } = await supabaseAdmin.rpc("reserve_registration_id");
      regId = (data as string | null) ?? undefined;
    }
    const withId: Answers = { ...nextAnswers, ...(regId ? { reg_id: regId } : {}) };
    await saveSession("confirm", withId);
    await sendMessage(chatId, summary(withId), CONFIRM_KEYBOARD);
  };

  const askNext = async (nextStep: Step, nextAnswers: Answers) => {
    if (nextStep === "confirm") {
      await goToConfirm(nextAnswers);
      return;
    }
    await saveSession(nextStep, nextAnswers);
    if (nextStep === "gender") {
      await sendMessage(chatId, QUESTIONS.gender, GENDER_KEYBOARD);
    } else {
      await sendMessage(chatId, QUESTIONS[nextStep]);
    }
  };

  // --- Button presses ---
  if (cb?.data === "start_reg") {
    await saveSession("full_name", {});
    await sendMessage(chatId, QUESTIONS.full_name);
    return;
  }

  if (cb?.data === "help") {
    await sendMessage(chatId, HELP_TEXT, HELP_KEYBOARD);
    return;
  }

  if (cb?.data === "home") {
    await clearSession();
    await sendMessage(chatId, WELCOME, START_KEYBOARD);
    return;
  }

  if (cb?.data === "gender_male" || cb?.data === "gender_female") {
    if (step !== "gender") {
      await sendMessage(chatId, WELCOME, START_KEYBOARD);
      return;
    }
    const gender = cb.data === "gender_male" ? "ወንድ" : "ሴት";
    await askNext("birth_date_ec", { ...answers, gender });
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
      `✅ የሰንበት ት/ቤት ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!\n\n🆔 የምዝገባ ቁጥር፦ ${inserted.registration_id}\n\nእባክዎ የምዝገባ ቁጥርዎን ያስቀምጡ።`,
    );
    await sendMessage(chatId, CONTACTS, HOME_KEYBOARD);
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

  if (text.startsWith("/help")) {
    await sendMessage(chatId, HELP_TEXT, HELP_KEYBOARD);
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

  if (step === "gender") {
    await sendMessage(chatId, QUESTIONS.gender, GENDER_KEYBOARD);
    return;
  }

  // Validate the answer for the current question.
  let value: string | null = null;
  if (step === "birth_date_ec") {
    const date = validateEthiopianDate(text);
    if (!date) {
      await sendMessage(
        chatId,
        `⚠️ የትውልድ ቀኑ ትክክል አይደለም። እባክዎ ሙሉ ቀኑን በኢትዮጵያ አቆጣጠር በቅርጸት ቀን/ወር/ዓመት ያስገቡ (ዓመት ከ1950 እስከ ${currentEthiopianYear()})።\n\nለምሳሌ፦ 15/03/2012`,
      );
      return;
    }
    value = date.formatted;
  } else if (step === "mother_phone" || step === "father_phone") {
    value = validatePhone(text);
    if (value === null) {
      await sendMessage(
        chatId,
        "⚠️ የስልክ ቁጥሩ ትክክል አይደለም። እባክዎ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።\n\nለምሳሌ፦ 0912345678 ወይም +251912345678",
      );
      return;
    }
  } else if (step === "christian_name") {
    value = validateAmharicName(text, null);
    if (value === null) {
      await sendMessage(chatId, CHRISTIAN_NAME_ERROR);
      return;
    }
  } else {
    value = validateAmharicName(text, 3);
    if (value === null) {
      await sendMessage(chatId, NAME_ERROR);
      return;
    }
  }

  const nextAnswers: Answers = { ...answers, [step]: value };
  const nextStep = STEPS[STEPS.indexOf(step) + 1] as Step;
  await askNext(nextStep, nextAnswers);
}
