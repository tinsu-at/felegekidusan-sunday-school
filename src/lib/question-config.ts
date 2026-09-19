/** Shared client/server model for registration questions. */
import type { Lang } from "@/lib/telegram-i18n";
export const INPUT_TYPES = ["text", "phone", "ethiopian_date", "ethiopian_year", "options"] as const;
export type InputType = (typeof INPUT_TYPES)[number];
export type RegistrationAgeGroup = "7_13" | "14_17" | "18_plus";
export type QuestionAgeGroup = "all" | RegistrationAgeGroup;
export type QuestionAgeGroups = QuestionAgeGroup[];
export type QuestionOption = { value: string; label_am: string; label_en: string };
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
  age_group: QuestionAgeGroup;
  age_groups: QuestionAgeGroups;
};
export type QuestionDraft = Omit<QuestionConfig, "age_group" | "age_groups"> & { id: string; age_group?: QuestionAgeGroup; age_groups?: QuestionAgeGroups };
export const CORE_FIELD_KEYS = ["full_name", "christian_name", "gender", "birth_date_ec"] as const;
export function isCoreField(key: string) { return (CORE_FIELD_KEYS as readonly string[]).includes(key); }
export function label(q: QuestionConfig, lang: Lang) { const text = lang === "en" ? q.label_en : q.label_am; return text.trim() || q.label_am || q.label_en || q.field_key; }
export function optionLabel(o: QuestionOption, lang: Lang) { return (lang === "en" ? o.label_en : o.label_am) || o.value; }
const ETHIOPIC_DIGITS: Record<string, string> = { "፩": "1", "፪": "2", "፫": "3", "፬": "4", "፭": "5", "፮": "6", "፯": "7", "፰": "8", "፱": "9" };
export function normalizeDigits(input: string) { return input.split("").map((c) => ETHIOPIC_DIGITS[c] ?? c).join("").trim(); }
function gregorianToJdn(year: number, month: number, day: number) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function jdnToEthiopian(jdn: number) {
  const offset = 1723856;
  const r = ((jdn - offset) % 1461 + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - offset) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  return { year, month: Math.floor(n / 30) + 1, day: (n % 30) + 1 };
}

function currentEthiopianDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
  return jdnToEthiopian(gregorianToJdn(values.year, values.month, values.day));
}

export function currentEthiopianYear() { return currentEthiopianDate().year; }
export function ethiopianAge(birthYear: number | null | undefined, birthMonth?: number | null, birthDay?: number | null) {
  if (!birthYear || birthYear < 1900) return null;
  const now = currentEthiopianDate();
  let age = now.year - birthYear;
  if (birthMonth != null && birthDay != null) {
    if (birthMonth > now.month || (birthMonth === now.month && birthDay > now.day)) age -= 1;
  } else if (birthMonth != null && birthMonth > now.month) {
    age -= 1;
  }
  return age < 0 ? null : age;
}
const ETHIOPIC_WORD = /^[\u1200-\u137F]+$/;
const LATIN_WORD = /^[A-Za-z][A-Za-z'’.-]*$/;
function isEthiopianLeapYear(year: number) { return year % 4 === 3; }
export function validateEthiopianDate(value: string) { const raw = normalizeDigits(value).replace(/[.-]/g, "/").replace(/\s/g, ""); const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw); if (!match) return null; const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]); if (month < 1 || month > 13) return null; const maxDay = month === 13 ? (isEthiopianLeapYear(year) ? 6 : 5) : 30; if (day < 1 || day > maxDay || year < 1950 || year > currentEthiopianYear()) return null; return { day, month, year, formatted: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}` }; }
export function validateEthiopianYear(value: string) { const year = Number(normalizeDigits(value).replace(/\D/g, "")); return Number.isInteger(year) && year >= 1950 && year <= currentEthiopianYear() ? year : null; }
export function validatePhone(value: string) { const raw = normalizeDigits(value).replace(/[\s\-()]/g, ""); let match = /^(?:\+251|251)([79]\d{8})$/.exec(raw); if (match) return `+251${match[1]}`; match = /^0([79]\d{8})$/.exec(raw); return match ? `+251${match[1]}` : null; }
export function validateText(value: string, q: QuestionConfig, lang: Lang) { const name = value.trim().replace(/\s+/g, " "); if (!name || name.length > 200) return null; const words = name.split(" "); if (q.exact_words != null && words.length !== q.exact_words) return null; if (q.exact_words == null) { if (q.min_words != null && words.length < q.min_words) return null; if (q.max_words != null && words.length > q.max_words) return null; } if (q.amharic_only) { const ok = (w: string) => ETHIOPIC_WORD.test(w) || (lang === "en" && LATIN_WORD.test(w)); if (!words.every(ok)) return null; } return name; }
export function questionError(q: QuestionConfig, lang: Lang) { const custom = (lang === "en" ? q.error_en : q.error_am).trim(); if (custom) return custom; if (q.input_type === "phone") return lang === "en" ? "⚠️ That phone number is not valid. Example: 0912345678" : "⚠️ የስልክ ቁጥሩ ትክክል አይደለም። ለምሳሌ፦ 0912345678"; if (q.input_type === "ethiopian_date") return lang === "en" ? `⚠️ Please use the Ethiopian calendar in DD/MM/YYYY format (year 1950–${currentEthiopianYear()}).` : `⚠️ እባክዎ ቀኑን በኢትዮጵያ አቆጣጠር በቅርጸት ቀን/ወር/ዓመት ያስገቡ (ዓመት ከ1950 እስከ ${currentEthiopianYear()})።`; if (q.input_type === "ethiopian_year") return lang === "en" ? `⚠️ Please enter an Ethiopian calendar year between 1950 and ${currentEthiopianYear()}.` : `⚠️ እባክዎ የትውልድ ዘመኑን በኢትዮጵያ አቆጣጠር ያስገቡ (ከ1950 እስከ ${currentEthiopianYear()})።`; if (q.exact_words != null) return lang === "en" ? `❌ Please enter exactly ${q.exact_words} words.` : `❌ እባክዎ በ${q.exact_words} ቃላት ብቻ ያስገቡ።`; return lang === "en" ? "❌ That answer is not valid. Please try again." : "❌ መልሱ ትክክል አይደለም። እባክዎ እንደገና ይሞክሩ።"; }
export function validateAnswer(q: QuestionConfig, text: string, lang: Lang) { switch (q.input_type) { case "phone": return validatePhone(text); case "ethiopian_date": return validateEthiopianDate(text)?.formatted ?? null; case "ethiopian_year": { const year = validateEthiopianYear(text); return year === null ? null : String(year); } case "options": { const trimmed = text.trim(), hit = q.options.find((o) => o.value === trimmed || o.label_am === trimmed || o.label_en.toLowerCase() === trimmed.toLowerCase()); return hit?.value ?? null; } default: return validateText(text, q, lang); } }
