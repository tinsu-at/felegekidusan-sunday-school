/**
 * Server-only access to the registration question configuration.
 */
import {
  INPUT_TYPES,
  type InputType,
  type QuestionConfig,
  type QuestionOption,
} from "@/lib/question-config";

export type RegistrationAgeGroup = "7_13" | "14_17" | "18_plus";
export type QuestionAgeGroup = "all" | RegistrationAgeGroup;

function asInputType(value: unknown): InputType {
  return (INPUT_TYPES as readonly string[]).includes(String(value))
    ? (value as InputType)
    : "text";
}

function asOptions(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const val = String(o["value"] ?? "").trim();
      if (!val) return null;
      return {
        value: val,
        label_am: String(o["label_am"] ?? val),
        label_en: String(o["label_en"] ?? val),
      } satisfies QuestionOption;
    })
    .filter((o): o is QuestionOption => o !== null);
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeQuestion(raw: unknown, index: number): QuestionConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ageGroup = String(r["age_group"] ?? "all");
  return {
    field_key: String(r["field_key"] ?? `question_${index + 1}`),
    position: Number(r["position"] ?? index + 1),
    label_am: String(r["label_am"] ?? ""),
    label_en: String(r["label_en"] ?? ""),
    input_type: asInputType(r["input_type"]),
    required: r["required"] !== false,
    amharic_only: r["amharic_only"] === true,
    min_words: asNumberOrNull(r["min_words"]),
    max_words: asNumberOrNull(r["max_words"]),
    exact_words: asNumberOrNull(r["exact_words"]),
    error_am: String(r["error_am"] ?? ""),
    error_en: String(r["error_en"] ?? ""),
    options: asOptions(r["options"]),
    is_core: r["is_core"] === true,
    active: r["active"] !== false,
    ...(ageGroup === "7_13" || ageGroup === "14_17" || ageGroup === "18_plus"
      ? { age_group: ageGroup }
      : { age_group: "all" }),
  } as QuestionConfig;
}

export function normalizeQuestions(raw: unknown): QuestionConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeQuestion)
    .filter((q) => q.active && q.field_key)
    .sort((a, b) => a.position - b.position);
}

export async function publishedQuestionSet(version?: number): Promise<{
  version: number;
  questions: QuestionConfig[];
}> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    let query = supabaseAdmin
      .from("registration_question_versions")
      .select("version, questions");

    if (Number.isInteger(version) && (version as number) > 0) {
      query = query.eq("version", version as number);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data } = await query.maybeSingle();
    return {
      version: Number(data?.version ?? 0),
      questions: normalizeQuestions(data?.questions),
    };
  } catch {
    console.error("Published question configuration could not be loaded");
    return { version: 0, questions: [] };
  }
}

export async function publishedQuestions(): Promise<QuestionConfig[]> {
  return (await publishedQuestionSet()).questions;
}
