import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuestionAgeGroup } from "@/lib/question-config";

const AGE_GROUPS = ["all", "7_13", "14_17", "18_plus"] as const;
const inputTypes = ["text", "phone", "ethiopian_date", "ethiopian_year", "options"] as const;

const questionSchema = z.object({
  id: z.string().uuid().optional(),
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
  age_group: z.enum(AGE_GROUPS),
});

async function assertOwner(context: { userId: string; supabase: unknown }) {
  const client = context.supabase as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await client.rpc("has_role", { _user_id: context.userId, _role: "owner" });
  if (!data) throw new Error("Owner access required");
}

const columns = "id, field_key, position, label_am, label_en, input_type, required, amharic_only, min_words, max_words, exact_words, error_am, error_en, options, is_core, active, age_group";

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
    const { id, ...question } = data;
    const payload = id ? { id, ...question } : question;
    const { error } = await supabaseAdmin.from("registration_questions").upsert(payload, { onConflict: "field_key" });
    if (error) throw new Error("Could not save question");
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
