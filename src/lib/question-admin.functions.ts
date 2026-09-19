import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner-auth";
import type { QuestionAgeGroup } from "@/lib/question-config";

const AGE_GROUPS = ["all", "7_13", "14_17", "18_plus"] as const;
const inputTypes = ["text", "phone", "ethiopian_date", "ethiopian_year", "options"] as const;

const questionSchema = z.object({
  // The UI uses an empty string for a new question. Treat that as "no id"
  // rather than passing it to UUID validation.
  id: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  field_key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/),
  position: z.number().int().min(1).max(1000),
  label_am: z.string().max(500),
  label_en: z.string().max(500),
  input_type: z.enum(inputTypes),
  required: z.boolean(),
  amharic_only: z.boolean(),
  min_words: z.number().int().min(1).max(100).nullable(),
  max_words: z.number().int().min(1).max(100).nullable(),
  exact_words: z.number().int().min(1).max(100).nullable(),
  error_am: z.string().max(500),
  error_en: z.string().max(500),
  options: z.array(z.object({ value: z.string().max(100), label_am: z.string().max(200), label_en: z.string().max(200) })).max(20),
  is_core: z.boolean(),
  active: z.boolean(),
  age_groups: z.array(z.enum(AGE_GROUPS)).min(1).max(4),
  // Legacy field is accepted from older clients and kept in the database.
  age_group: z.enum(AGE_GROUPS).optional(),
});

async function assertOwner(context: { userId: string; claims?: Record<string, unknown>; supabase: unknown }) {
  if (isOwnerEmail(context.claims?.["email"])) return;

  const client = context.supabase as { rpc: (name: "has_role", args: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await client.rpc("has_role", { _user_id: context.userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

const columns = "id, field_key, position, label_am, label_en, input_type, required, amharic_only, min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group, age_groups";

export const listQuestionEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: draft, error }, { data: latest, error: versionError }] = await Promise.all([
      supabaseAdmin.from("registration_questions").select(columns).order("position", { ascending: true }),
      supabaseAdmin.from("registration_question_versions").select("version, created_at").order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error || versionError) throw new Error("Could not load questions");
    return { draft: draft ?? [], publishedVersion: latest?.version ?? 0, publishedAt: latest?.created_at ?? null };
  });

export const saveQuestionEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => questionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, age_groups, ...question } = data;
    const normalizedAgeGroups = age_groups.includes("all")
      ? ["all"] as const
      : Array.from(new Set(age_groups));
    const legacyAgeGroup = normalizedAgeGroups.length === 1
      ? normalizedAgeGroups[0]
      : "all";
    const payload = {
      ...(id ? { id } : {}),
      ...question,
      age_groups: normalizedAgeGroups,
      age_group: legacyAgeGroup,
    };
    const { error } = await supabaseAdmin.from("registration_questions").upsert(payload, { onConflict: "field_key" });
    if (error) {
      console.error("[QuestionEditor] Could not save question", error);
      throw new Error(`Could not save question: ${error.message}`);
    }
    return { ok: true };
  });

export const deleteQuestionEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: question, error: findError } = await supabaseAdmin.from("registration_questions").select("id, field_key, is_core").eq("id", data.id).maybeSingle();
    if (findError) throw new Error(`Could not find question: ${findError.message}`);
    if (!question) throw new Error("Question not found");
    if (question.is_core) throw new Error("Core registration questions cannot be deleted.");
    const { error } = await supabaseAdmin.from("registration_questions").delete().eq("id", data.id);
    if (error) {
      console.error("[QuestionEditor] Could not delete question", error);
      throw new Error(`Could not delete question: ${error.message}`);
    }
    const { data: remaining, error: listError } = await supabaseAdmin.from("registration_questions").select("id").order("position", { ascending: true });
    if (listError) throw new Error("Question deleted, but positions could not be normalized.");
    for (let i = 0; i < (remaining ?? []).length; i += 1) {
      const { error: reorderError } = await supabaseAdmin.from("registration_questions").update({ position: i + 1 }).eq("id", remaining[i].id);
      if (reorderError) throw new Error("Question deleted, but positions could not be normalized.");
    }
    return { ok: true };
  });

export const reorderQuestionEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < data.ids.length; i += 1) {
      const { error } = await supabaseAdmin.from("registration_questions").update({ position: i + 1 }).eq("id", data.ids[i]);
      if (error) throw new Error("Could not reorder questions");
    }
    return { ok: true };
  });

export const publishQuestionEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("registration_questions").select(columns).eq("active", true).order("position", { ascending: true });
    if (error) throw new Error("Could not load questions for publishing");
    const { data: latest } = await supabaseAdmin.from("registration_question_versions").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(latest?.version ?? 0) + 1;
    const questions = (data ?? []).map(({ id, ...q }) => q);
    const { error: insertError } = await supabaseAdmin.from("registration_question_versions").insert({ version, questions, published_by: context.userId });
    if (insertError) throw new Error("Could not publish questions");
    return { ok: true, version };
  });

export type QuestionEditorAgeGroup = QuestionAgeGroup;
