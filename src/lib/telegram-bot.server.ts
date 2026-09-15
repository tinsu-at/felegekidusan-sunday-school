/** Server-only Telegram registration bot. */
import { helpMessage } from "@/lib/help-content.server";
import {
  ethiopianAge,
  isCoreField,
  label as questionLabel,
  optionLabel,
  questionError,
  validateAnswer,
  validateEthiopianDate,
  type QuestionConfig,
} from "@/lib/question-config";
import {
  publishedQuestionSet,
  type RegistrationAgeGroup,
} from "@/lib/question-config.server";
import { T, asLang, type Lang } from "@/lib/telegram-i18n";

export { validateEthiopianDate };

type TelegramUpdate = {
  update_id?: number;
  message?: { chat?: { id?: number }; from?: { id?: number; username?: string }; text?: string };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number; username?: string };
    message?: { chat?: { id?: number } };
  };
};

type Answers = Record<string, string | undefined> & {
  reg_id?: string;
  _age_group?: RegistrationAgeGroup;
  _editing_key?: string;
};

const AGE_GROUPS: { value: RegistrationAgeGroup; am: string; en: string }[] = [
  { value: "7_13", am: "7–13", en: "7–13" },
  { value: "14_17", am: "14–17", en: "14–17" },
  { value: "18_plus", am: "18+", en: "18+" },
];

const FALLBACK_QUESTIONS: QuestionConfig[] = [];

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

const homeKeyboard = (lang: Lang) => ({
  inline_keyboard: [[{ text: T[lang].btnHome, callback_data: "home" }]],
});

const ageGroupKeyboard = (lang: Lang) => ({
  inline_keyboard: AGE_GROUPS.map((g) => [
    { text: g.en, callback_data: `age_${g.value}` },
  ]).concat([[{ text: `⬅️ ${T[lang].btnHome}`, callback_data: "home" }]]),
});

const confirmKeyboard = (lang: Lang) => ({
  inline_keyboard: [
    [{ text: T[lang].btnConfirm, callback_data: "confirm_yes" }],
    [{ text: "✏️ Edit answers", callback_data: "edit_answers" }],
    [{ text: T[lang].btnCancel, callback_data: "confirm_no" }],
  ],
});

const registerAnotherKeyboard = (lang: Lang) => ({
  inline_keyboard: [
    [{ text: "➕ Register Another Student", callback_data: "register_another" }],
    [{ text: `🏠 ${T[lang].btnHome}`, callback_data: "home" }],
  ],
});

async function telegram(method: string, body: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Bot token is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`Telegram API ${method} failed with status ${res.status}`);
  return res;
}

async function sendMessage(chatId: number, text: string, keyboard?: unknown) {
  await telegram("sendMessage", { chat_id: chatId, text, ...(keyboard ? { reply_markup: keyboard } : {}) });
}

async function notifyAdmins(lines: string[]) {
  const text = lines.join("\n");
  const targets = new Set<string>();
  const fallback = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (fallback) targets.add(String(fallback).trim());
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("bot_admins").select("telegram_chat_id").eq("active", true);
    for (const row of data ?? []) if (row.telegram_chat_id) targets.add(String(row.telegram_chat_id));
  } catch { console.error("Admin list could not be loaded for notifications"); }
  for (const chatId of targets) {
    try { await telegram("sendMessage", { chat_id: chatId, text }); } catch { console.error("Admin notification could not be delivered"); }
  }
}

function groupLabel(group: RegistrationAgeGroup, lang: Lang) {
  const hit = AGE_GROUPS.find((g) => g.value === group);
  return lang === "am" ? hit?.am ?? group : hit?.en ?? group;
}

function questionGroup(q: QuestionConfig): string {
  return String((q as QuestionConfig & { age_group?: string }).age_group ?? "all");
}

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

function applicableQuestions(all: QuestionConfig[], group: RegistrationAgeGroup) {
  return all.filter((q) => {
    const g = questionGroup(q);
    return g === "all" || g === group;
  }).sort((a, b) => a.position - b.position);
}

function summary(questions: QuestionConfig[], answers: Answers, lang: Lang) {
  return [
    lang === "am" ? "📋 የምዝገባ ማረጋገጫ" : "📋 Review Student Registration",
    "",
    `${lang === "am" ? "የዕድሜ ቡድን" : "Age Group"}: ${groupLabel(answers._age_group!, lang)}`,
    ...(answers.reg_id ? [`${T[lang].labels.regId}: ${answers.reg_id}`] : []),
    "",
    ...questions.map((q) => `${shortLabel(q, lang)}: ${displayValue(q, answers[q.field_key], lang)}`),
    "",
    lang === "am" ? "እባክዎ መረጃውን ያረጋግጡ።" : "Please check all information before submitting.",
  ].join("\n");
}

async function ageMismatchMessage(chatId: number, lang: Lang, age: number, group: RegistrationAgeGroup) {
  await sendMessage(chatId, lang === "am"
    ? `⚠️ የዕድሜ ቡድን አልተመጣጠነም።\n\nየተመረጠው ቡድን፦ ${groupLabel(group, lang)}\nየተሰላው ዕድሜ፦ ${age}\n\nእባክዎ የትውልድ ቀኑን ወይም የዕድሜ ቡድኑን ያስተካክሉ።`
    : `⚠️ Age Group Mismatch.\n\nSelected group: ${groupLabel(group, lang)}\nCalculated age: ${age}\n\nPlease correct the birth date or change the age group.`, {
      inline_keyboard: [[{ text: "✏️ Edit Birth Date", callback_data: "edit_birth_date_ec" }], [{ text: "🔄 Change Age Group", callback_data: "change_age_group" }]],
    });
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (typeof update.update_id === "number") {
    const { error } = await supabaseAdmin.from("telegram_updates").insert({ update_id: update.update_id });
    if (error) return;
  }

  const cb = update.callback_query;
  const msg = update.message;
  const userId = cb?.from?.id ?? msg?.from?.id;
  const chatId = cb?.message?.chat?.id ?? msg?.chat?.id;
  const username = cb?.from?.username ?? msg?.from?.username ?? null;
  if (!userId || !chatId) return;
  if (cb?.id) await telegram("answerCallbackQuery", { callback_query_id: cb.id });

  const [{ data: session }, { data: pref }] = await Promise.all([
    supabaseAdmin.from("registration_sessions").select("step, answers, updated_at, age_group, question_version").eq("telegram_user_id", userId).maybeSingle(),
    supabaseAdmin.from("bot_user_prefs").select("lang").eq("telegram_user_id", userId).maybeSingle(),
  ]);

  const sessionExpired = !!session?.updated_at && Date.now() - new Date(session.updated_at).getTime() > 24 * 60 * 60 * 1000;
  const pinnedVersion = !sessionExpired && typeof session?.question_version === "number" ? session.question_version : undefined;
  const published = await publishedQuestionSet(pinnedVersion);
  const activeVersion = pinnedVersion ?? published.version;

  let lang: Lang = asLang(pref?.lang);
  const knownLanguage = !!pref;
  const allQuestions = published.questions.length ? published.questions : FALLBACK_QUESTIONS;
  let answers: Answers = (session?.answers as Answers | null) ?? {};
  let step = String(session?.step ?? "idle");

  if (sessionExpired) {
    await supabaseAdmin.from("registration_sessions").delete().eq("telegram_user_id", userId);
    answers = {};
    step = "idle";
  }

  const clearSession = async () => { await supabaseAdmin.from("registration_sessions").delete().eq("telegram_user_id", userId); };
  const saveSession = async (nextStep: string, nextAnswers: Answers, group?: RegistrationAgeGroup, version?: number) => {
    await supabaseAdmin.from("registration_sessions").upsert({
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      telegram_username: username,
      step: nextStep,
      answers: nextAnswers,
      age_group: group ?? nextAnswers._age_group ?? null,
      question_version: version ?? activeVersion,
    } as never, { onConflict: "telegram_user_id" });
  };
  const saveLanguage = async (next: Lang) => {
    lang = next;
    await supabaseAdmin.from("bot_user_prefs").upsert({ telegram_user_id: userId, lang: next }, { onConflict: "telegram_user_id" });
  };

  const currentGroup = answers._age_group as RegistrationAgeGroup | undefined;
  const questions = currentGroup ? applicableQuestions(allQuestions, currentGroup) : [];
  const findQuestion = (key: string) => questions.find((q) => q.field_key === key);

  const editKeyboard = {
    inline_keyboard: questions.map((q) => [{ text: shortLabel(q, lang), callback_data: `edit_${q.field_key}` }]).concat([[{ text: "⬅️ Back to Review", callback_data: "back_review" }]]),
  };

  const askQuestion = async (q: QuestionConfig) => {
    const controls = [[{ text: "⬅️ Back", callback_data: "back_question" }]];
    if (!q.required) controls.unshift([{ text: "⏭️ Skip", callback_data: "skip_question" }]);
    if (q.input_type === "options" && q.options.length) {
      await sendMessage(chatId, questionLabel(q, lang), { inline_keyboard: [...q.options.map((o, i) => [{ text: optionLabel(o, lang), callback_data: `opt_${i}` }]), ...controls] });
    } else await sendMessage(chatId, questionLabel(q, lang), { inline_keyboard: controls });
  };

  const goToConfirm = async (nextAnswers: Answers) => {
    let regId = nextAnswers.reg_id;
    if (!regId) {
      const { data } = await supabaseAdmin.rpc("reserve_registration_id");
      regId = (data as string | null) ?? undefined;
    }
    const withId = { ...nextAnswers, ...(regId ? { reg_id: regId } : {}) };
    await saveSession("confirm", withId, currentGroup, activeVersion);
    await sendMessage(chatId, summary(questions, withId, lang), confirmKeyboard(lang));
  };

  const goNext = async (currentKey: string, nextAnswers: Answers) => {
    if (nextAnswers._editing_key) {
      const cleaned = { ...nextAnswers };
      delete cleaned._editing_key;
      await saveSession("confirm", cleaned, currentGroup, activeVersion);
      await sendMessage(chatId, summary(questions, cleaned, lang), confirmKeyboard(lang));
      return;
    }
    const index = questions.findIndex((q) => q.field_key === currentKey);
    const next = questions[index + 1];
    if (!next) return goToConfirm(nextAnswers);
    await saveSession(next.field_key, nextAnswers, currentGroup, activeVersion);
    await askQuestion(next);
  };

  if (cb?.data === "lang_am" || cb?.data === "lang_en") { await saveLanguage(cb.data === "lang_en" ? "en" : "am"); await sendMessage(chatId, T[lang].languageSet); await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return; }
  if (cb?.data === "language") { await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD); return; }

  if (cb?.data === "start_reg") {
    if (session && step !== "idle" && !sessionExpired) { await sendMessage(chatId, lang === "am" ? "አልተጠናቀቀ ምዝገባ አለዎት።" : "You have an unfinished registration.", { inline_keyboard: [[{ text: "▶️ Continue", callback_data: "continue_reg" }], [{ text: "🗑️ Discard & Start New", callback_data: "discard_new" }]] }); return; }
    await sendMessage(chatId, lang === "am" ? "የተማሪውን የዕድሜ ቡድን ይምረጡ።" : "Please select the student's age group.", ageGroupKeyboard(lang));
    return;
  }
  if (cb?.data === "register_another" || cb?.data === "discard_new") { await clearSession(); await sendMessage(chatId, lang === "am" ? "የተማሪውን የዕድሜ ቡድን ይምረጡ።" : "Please select the student's age group.", ageGroupKeyboard(lang)); return; }
  if (cb?.data === "continue_reg") {
    if (step === "confirm") { await sendMessage(chatId, summary(questions, answers, lang), confirmKeyboard(lang)); return; }
    const q = findQuestion(step);
    if (q) { await askQuestion(q); return; }
    await sendMessage(chatId, lang === "am" ? "የዕድሜ ቡድን ይምረጡ።" : "Select the age group.", ageGroupKeyboard(lang));
    return;
  }
  if (cb?.data === "change_age_group") { await saveSession("age_group", answers, undefined, activeVersion); await sendMessage(chatId, lang === "am" ? "አዲሱን የዕድሜ ቡድን ይምረጡ።" : "Select the correct age group.", ageGroupKeyboard(lang)); return; }

  if (cb?.data?.startsWith("age_")) {
    const group = cb.data.slice(4) as RegistrationAgeGroup;
    if (!AGE_GROUPS.some((g) => g.value === group)) return;
    const filtered = applicableQuestions(allQuestions, group);
    const next = filtered[0];
    if (!next) { await sendMessage(chatId, lang === "am" ? "የምዝገባ ጥያቄዎች አልተዘጋጁም።" : "No registration questions are published yet."); return; }
    const nextAnswers: Answers = { _age_group: group };
    await saveSession(next.field_key, nextAnswers, group, activeVersion);
    await sendMessage(chatId, `${lang === "am" ? "የተመረጠው ቡድን" : "Selected age group"}: ${groupLabel(group, lang)}`);
    await askQuestion(next);
    return;
  }

  if (cb?.data === "help") { const help = await helpMessage(lang); await sendMessage(chatId, help.text, homeKeyboard(lang)); return; }
  if (cb?.data === "home") { await clearSession(); await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return; }
  if (cb?.data === "confirm_no") { await clearSession(); await sendMessage(chatId, T[lang].cancelled); await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return; }
  if (cb?.data === "edit_answers") { await saveSession("edit", answers, currentGroup, activeVersion); await sendMessage(chatId, lang === "am" ? "የትኛውን መልስ ማስተካከል ይፈልጋሉ?" : "Which answer would you like to edit?", editKeyboard); return; }
  if (cb?.data === "back_review") { await saveSession("confirm", answers, currentGroup, activeVersion); await sendMessage(chatId, summary(questions, answers, lang), confirmKeyboard(lang)); return; }
  if (cb?.data?.startsWith("edit_")) {
    const key = cb.data.slice(5);
    const q = findQuestion(key);
    if (!q) return;
    const nextAnswers = { ...answers, _editing_key: key };
    await saveSession(key, nextAnswers, currentGroup, activeVersion);
    await askQuestion(q);
    return;
  }
  if (cb?.data === "edit_birth_date_ec") {
    const q = findQuestion("birth_date_ec");
    if (q) { const nextAnswers = { ...answers, _editing_key: "birth_date_ec" }; await saveSession("birth_date_ec", nextAnswers, currentGroup, activeVersion); await askQuestion(q); }
    return;
  }
  if (cb?.data === "back_question") {
    const current = findQuestion(step);
    if (!current) return;
    const index = questions.findIndex((q) => q.field_key === current.field_key);
    if (index <= 0) { await sendMessage(chatId, lang === "am" ? "የዕድሜ ቡድን ይምረጡ።" : "Select the age group.", ageGroupKeyboard(lang)); return; }
    const previous = questions[index - 1];
    await saveSession(previous.field_key, answers, currentGroup, activeVersion);
    await askQuestion(previous);
    return;
  }
  if (cb?.data === "skip_question") {
    const current = findQuestion(step);
    if (!current || current.required) return;
    await goNext(current.field_key, { ...answers, [current.field_key]: "" });
    return;
  }
  if (cb?.data?.startsWith("opt_")) {
    const current = findQuestion(step);
    if (!current || current.input_type !== "options") return;
    const option = current.options[Number(cb.data.slice(4))];
    if (!option) return;
    await goNext(current.field_key, { ...answers, [current.field_key]: option.value });
    return;
  }

  if (cb?.data === "confirm_yes") {
    if (step !== "confirm" || !currentGroup) return;
    const birth = validateEthiopianDate(answers["birth_date_ec"] ?? "");
    if (!birth) { const q = questions.find((x) => x.field_key === "birth_date_ec"); if (q) await sendMessage(chatId, questionError(q, lang), { inline_keyboard: [[{ text: "✏️ Edit Birth Date", callback_data: "edit_birth_date_ec" }]] }); return; }
    const age = ethiopianAge(birth.year, birth.month);
    const validGroup = age !== null && ((currentGroup === "7_13" && age >= 7 && age <= 13) || (currentGroup === "14_17" && age >= 14 && age <= 17) || (currentGroup === "18_plus" && age >= 18));
    if (!validGroup) { await ageMismatchMessage(chatId, lang, age ?? -1, currentGroup); return; }

    const extras: Record<string, string> = {};
    for (const q of questions) { const value = answers[q.field_key]; if (!isCoreField(q.field_key) && value) extras[q.field_key] = value; }
    const payload = {
      ...(answers.reg_id ? { registration_id: answers.reg_id } : {}),
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      telegram_username: username,
      age_group: currentGroup,
      question_version: activeVersion || null,
      full_name: answers.full_name ?? "-",
      christian_name: answers.christian_name ?? "-",
      gender: answers.gender ?? "-",
      birth_date_ec: birth.formatted,
      birth_day_ec: birth.day,
      birth_month_ec: birth.month,
      birth_year_ec: birth.year,
      age_years: age,
      mother_name: answers.mother_name || "-",
      mother_phone: answers.mother_phone || "-",
      father_name: answers.father_name || "-",
      father_phone: answers.father_phone || "-",
      extra_answers: extras,
      status: "pending",
    };
    const { data: inserted, error } = await supabaseAdmin.from("registrations").insert(payload as never).select("registration_id, created_at").single();
    if (error || !inserted) { console.error("Failed to save registration"); await sendMessage(chatId, T[lang].saveFailed); return; }
    await clearSession();
    await sendMessage(chatId, T[lang].success(inserted.registration_id));
    await sendMessage(chatId, lang === "am" ? "የሚቀጥለውን ተማሪ ለመመዝገብ ከታች ይምረጡ።" : "You can now register another student.", registerAnotherKeyboard(lang));
    await notifyAdmins([
      "🆕 አዲስ ምዝገባ / New registration",
      "",
      `🆔 ${inserted.registration_id}`,
      `${lang === "am" ? "የዕድሜ ቡድን" : "Age Group"}: ${groupLabel(currentGroup, "am")}`,
      `${lang === "am" ? "ዕድሜ" : "Age"}: ${age}`,
      ...questions.map((q) => `${shortLabel(q, "am")}: ${displayValue(q, answers[q.field_key], "am")}`),
    ]);
    return;
  }

  const text = (msg?.text ?? "").trim();
  if (!text) return;
  if (text.startsWith("/start")) {
    if (session && step !== "idle" && !sessionExpired) { await sendMessage(chatId, lang === "am" ? "አልተጠናቀቀ ምዝገባ አለዎት።" : "You have an unfinished registration.", { inline_keyboard: [[{ text: "▶️ Continue", callback_data: "continue_reg" }], [{ text: "🗑️ Discard & Start New", callback_data: "discard_new" }]] }); return; }
    if (!knownLanguage) { await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD); return; }
    await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return;
  }
  if (text.startsWith("/language") || text.startsWith("/lang")) { await sendMessage(chatId, T[lang].chooseLanguage, LANGUAGE_KEYBOARD); return; }
  if (text.startsWith("/help")) { const help = await helpMessage(lang); await sendMessage(chatId, help.text, homeKeyboard(lang)); return; }
  if (text.startsWith("/cancel")) { await clearSession(); await sendMessage(chatId, T[lang].cancelled); await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return; }
  if (text.startsWith("/id") || text.startsWith("/myid")) { await sendMessage(chatId, `🆔 Telegram ID: ${userId}\n💬 Chat ID: ${chatId}`, homeKeyboard(lang)); return; }
  if (step === "confirm") { await sendMessage(chatId, summary(questions, answers, lang), confirmKeyboard(lang)); return; }
  if (step === "edit") { await sendMessage(chatId, lang === "am" ? "የሚስተካከለውን ጥያቄ ይምረጡ።" : "Choose the answer to edit.", editKeyboard); return; }

  const current = findQuestion(step);
  if (!current) { await sendMessage(chatId, T[lang].welcome, startKeyboard(lang)); return; }
  if (current.input_type === "options") { await askQuestion(current); return; }
  const skipped = !current.required && /^(-|\/skip|skip|ዝለል)$/i.test(text);
  const value = skipped ? "" : validateAnswer(current, text, lang);
  if (value === null) { await sendMessage(chatId, questionError(current, lang)); return; }
  await goNext(current.field_key, { ...answers, [current.field_key]: value });
}
