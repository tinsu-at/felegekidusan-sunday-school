import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner-auth";
import { label as questionLabel, type QuestionConfig } from "@/lib/question-config";

type AgeGroup = "7_13" | "14_17" | "18_plus";

const filtersSchema = z.object({
  search: z.string().trim().max(200).default(""),
  gender: z.string().max(20).default("all"),
  age_group: z.union([z.literal("all"), z.literal("7_13"), z.literal("14_17"), z.literal("18_plus")]).default("all"),
  status: z.union([z.literal("all"), z.literal("pending"), z.literal("approved"), z.literal("rejected")]).default("all"),
  show_archived: z.boolean().default(false),
});

async function assertOwner(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "owner" }) => PromiseLike<{ data: unknown }> }; userId: string; claims?: Record<string, unknown> }) {
  if (isOwnerEmail(context.claims?.email)) return;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

function applicable(q: QuestionConfig, ageGroup: AgeGroup | null) { return q.age_group === "all" || q.age_group === ageGroup; }

function answerValue(row: Record<string, unknown>, q: QuestionConfig): string {
  const key = q.field_key;
  if (key === "birth_date_ec") {
    const direct = row.birth_date_ec;
    if (direct) return String(direct);
    const day = row.birth_day_ec; const month = row.birth_month_ec; const year = row.birth_year_ec;
    if (day != null && month != null && year != null) return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }
  if (["full_name", "christian_name", "gender", "mother_name", "mother_phone", "father_name", "father_phone"].includes(key)) return String(row[key] ?? "");
  const extra = row.extra_answers as Record<string, unknown> | null | undefined;
  return String(extra?.[key] ?? "");
}

function csvEscape(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export const exportRegistrationsCsvV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filtersSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rawRows, error }, { data: versions, error: versionError }] = await Promise.all([
      supabaseAdmin.from("registrations").select("id, registration_id, full_name, christian_name, gender, birth_date_ec, birth_year_ec, birth_month_ec, birth_day_ec, mother_name, mother_phone, father_name, father_phone, extra_answers, age_years, age_group, question_version, status, created_at, archived_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("registration_question_versions").select("version, questions").order("version", { ascending: true }),
    ]);
    if (error) {
      console.error("[Registration Export] registrations query failed:", error);
      throw new Error(`Could not export the registrations: ${error.message}`);
    }
    if (versionError) {
      console.error("[Registration Export] question versions query failed:", versionError);
      throw new Error(`Could not export the registrations: ${versionError.message}`);
    }

    const search = data.search.toLowerCase();
    const rows = (rawRows ?? []).filter((row) => {
      if (!data.show_archived && row.archived_at) return false;
      if (data.show_archived && !row.archived_at) return false;
      if (data.gender !== "all" && row.gender !== data.gender) return false;
      if (data.age_group !== "all" && row.age_group !== data.age_group) return false;
      if (data.status !== "all" && row.status !== data.status) return false;
      if (!search) return true;
      return [row.full_name, row.christian_name, row.registration_id, row.mother_phone, row.father_phone].some((value) => String(value ?? "").toLowerCase().includes(search));
    });

    const versionMap = new Map<number, QuestionConfig[]>();
    for (const version of versions ?? []) {
      const questions = Array.isArray(version.questions) ? version.questions : [];
      const normalized = questions.map((q, index) => ({ ...(q as QuestionConfig), position: Number((q as QuestionConfig).position ?? index + 1) })).filter((q) => q.field_key).sort((a, b) => a.position - b.position);
      versionMap.set(Number(version.version), normalized);
    }

    const questionMap = new Map<string, { question: QuestionConfig; versions: Set<number> }>();
    for (const [version, questions] of versionMap) for (const q of questions) {
      const existing = questionMap.get(q.field_key);
      if (existing) existing.versions.add(version); else questionMap.set(q.field_key, { question: q, versions: new Set([version]) });
    }
    const columns = [...questionMap.values()].sort((a, b) => a.question.position - b.question.position || a.question.field_key.localeCompare(b.question.field_key));
    const headers = ["registration_id", "full_name", "christian_name", "gender", "birth_date_ec", "age_group", "age_years", "question_version", ...columns.map(({ question }) => questionLabel(question, "en").split("\n")[0]?.trim() || question.field_key), "status", "created_at"];
    const uniqueHeaders = headers.map((header, index) => { const first = headers.indexOf(header); return first === index ? header : `${header} (${index + 1})`; });

    const csvRows = rows.map((row) => {
      const rowVersion = row.question_version == null ? null : Number(row.question_version);
      const questions = rowVersion == null ? [] : (versionMap.get(rowVersion) ?? []);
      const questionByKey = new Map(questions.map((q) => [q.field_key, q]));
      const ageGroup = (row.age_group as AgeGroup | null) ?? null;
      const values = [row.registration_id, row.full_name, row.christian_name, row.gender, answerValue(row, { field_key: "birth_date_ec", position: 0, label_am: "", label_en: "", input_type: "ethiopian_date", required: true, amharic_only: false, min_words: null, max_words: null, exact_words: null, error_am: "", error_en: "", options: [], is_core: true, active: true, age_group: "all" }), ageGroup, row.age_years, rowVersion, ...columns.map(({ question: columnQuestion }) => { const q = questionByKey.get(columnQuestion.field_key); if (!q || !applicable(q, ageGroup)) return ""; const value = answerValue(row, q); return value || (q.required ? "" : "-"); }), row.status, row.created_at];
      return values.map(csvEscape).join(",");
    });

    const questionVersions = [...versionMap.entries()].map(([version, questions]) => ({ version, questions: questions.map((q) => ({ field_key: q.field_key, label: questionLabel(q, "en"), age_group: q.age_group, position: q.position })) }));
    return { csv: [uniqueHeaders.join(","), ...csvRows].join("\n"), count: rows.length, questionVersions };
  });
