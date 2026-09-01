/**
 * Shared (client + server safe) model for the configurable registration
 * questions. The Telegram bot reads the latest PUBLISHED configuration; the
 * owner dashboard edits the DRAFT rows. No secrets or server imports here.
 */

import type { Lang } from "@/lib/telegram-i18n";

export const INPUT_TYPES = [
  "text",
  "phone",
  "ethiopian_date",
  "ethiopian_year",
  "options",
] as const;

export type InputType = (typeof INPUT_TYPES)[number];

export type QuestionOption = {
  value: string;
  label_am: string;
  label_en: string;
};

/** One question as stored in the draft table and in a published snapshot. */
export type QuestionConfig = {
  field_key: string;
  position: number;
  label_am: string;
  label_en: string;
  input_type: InputType;
  required: boolean;
  amharic_only: boolean;
  min_words: number | null;
  max_words: number | null;
  exact_words: number | null;
  error_am: string;
  error_en: string;
  options: QuestionOption[];
  is_core: boolean;
  active: boolean;
};

/** Draft rows additionally carry the database id. */
export type QuestionDraft = QuestionConfig & { id: string };

/** Column-backed answers; anything else lands in registrations.extra_answers. */
export const CORE_FIELD_KEYS = [
  "full_name",
  "christian_name",
  "gender",
  "birth_date_ec",
  "mother_name",
  "mother_phone",
  "father_name",
  "father_phone",
] as const;

export function isCoreField(key: string): boolean {
  return (CORE_FIELD_KEYS as readonly string[]).includes(key);
}

export function label(q: QuestionConfig, lang: Lang): string {
  const text = lang === "en" ? q.label_en : q.label_am;
  return text.trim() || q.label_am || q.label_en || q.field_key;
}

export function optionLabel(o: QuestionOption, lang: Lang): string {
  return (lang === "en" ? o.label_en : o.label_am) || o.value;
}

// ---------- Validation ----------

const ETHIOPIC_DIGITS: Record<string, string> = {
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

export function normalizeDigits(input: string): string {
  return input
    .split("")
    .map((c) => ETHIOPIC_DIGITS[c] ?? c)
    .join("")
    .trim();
}

export function currentEthiopianYear(): number {
  const now = new Date();
  const gYear = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const afterNewYear = month > 9 || (month === 9 && day >= 11);
  return afterNewYear ? gYear - 7 : gYear - 8;
}

const ETHIOPIC_WORD = /^[\u1200-\u137F]+$/;
const LATIN_WORD = /^[A-Za-z][A-Za-z'’.-]*$/;

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

export function validateEthiopianYear(value: string): number | null {
  const raw = normalizeDigits(value).replace(/\D/g, "");
  const year = Number(raw);
  if (!Number.isInteger(year)) return null;
  if (year < 1950 || year > currentEthiopianYear()) return null;
  return year;
}

export function validatePhone(value: string): string | null {
  const raw = normalizeDigits(value).replace(/[\s\-()]/g, "");
  let match = /^(?:\+251|251)([79]\d{8})$/.exec(raw);
  if (match) return `+251${match[1]}`;
  match = /^0([79]\d{8})$/.exec(raw);
  if (match) return `+251${match[1]}`;
  return null;
}

/** Validates free text against the question's word/script rules. */
export function validateText(
  value: string,
  q: QuestionConfig,
  lang: Lang,
): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return null;
  if (name.length > 200) return null;
  const words = name.split(" ");
  if (q.exact_words != null && words.length !== q.exact_words) return null;
  if (q.exact_words == null) {
    if (q.min_words != null && words.length < q.min_words) return null;
    if (q.max_words != null && words.length > q.max_words) return null;
  }
  if (q.amharic_only) {
    const ok = (w: string) =>
      ETHIOPIC_WORD.test(w) || (lang === "en" && LATIN_WORD.test(w));
    if (!words.every(ok)) return null;
  }
  return name;
}

export function questionError(q: QuestionConfig, lang: Lang): string {
  const custom = (lang === "en" ? q.error_en : q.error_am).trim();
  if (custom) return custom;
  if (q.input_type === "phone") {
    return lang === "en"
      ? "⚠️ That phone number is not valid. Example: 0912345678"
      : "⚠️ የስልክ ቁጥሩ ትክክል አይደለም። ለምሳሌ፦ 0912345678";
  }
  if (q.input_type === "ethiopian_date") {
    return lang === "en"
      ? `⚠️ Please use the Ethiopian calendar in DD/MM/YYYY format (year 1950–${currentEthiopianYear()}).`
      : `⚠️ እባክዎ ቀኑን በኢትዮጵያ አቆጣጠር በቅርጸት ቀን/ወር/ዓመት ያስገቡ (ዓመት ከ1950 እስከ ${currentEthiopianYear()})።`;
  }
  if (q.input_type === "ethiopian_year") {
    return lang === "en"
      ? `⚠️ Please enter an Ethiopian calendar year between 1950 and ${currentEthiopianYear()}.`
      : `⚠️ እባክዎ የትውልድ ዘመኑን በኢትዮጵያ አቆጣጠር ያስገቡ (ከ1950 እስከ ${currentEthiopianYear()})።`;
  }
  if (q.exact_words != null) {
    return lang === "en"
      ? `❌ Please enter exactly ${q.exact_words} words.`
      : `❌ እባክዎ በ${q.exact_words} ቃላት ብቻ ያስገቡ።`;
  }
  return lang === "en"
    ? "❌ That answer is not valid. Please try again."
    : "❌ መልሱ ትክክል አይደለም። እባክዎ እንደገና ይሞክሩ።";
}

/**
 * Validates a text answer for a question and returns the normalised value,
 * or null when it fails.
 */
export function validateAnswer(
  q: QuestionConfig,
  text: string,
  lang: Lang,
): string | null {
  switch (q.input_type) {
    case "phone":
      return validatePhone(text);
    case "ethiopian_date":
      return validateEthiopianDate(text)?.formatted ?? null;
    case "ethiopian_year": {
      const year = validateEthiopianYear(text);
      return year === null ? null : String(year);
    }
    case "options": {
      const trimmed = text.trim();
      const hit = q.options.find(
        (o) =>
          o.value === trimmed ||
          o.label_am === trimmed ||
          o.label_en.toLowerCase() === trimmed.toLowerCase(),
      );
      return hit?.value ?? null;
    }
    default:
      return validateText(text, q, lang);
  }
}
