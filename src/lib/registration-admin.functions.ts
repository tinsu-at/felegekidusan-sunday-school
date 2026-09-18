import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ethiopianAge, validateEthiopianDate } from "@/lib/question-config";
import { isOwnerEmail } from "@/lib/owner-auth";

const AGE_GROUPS = ["7_13", "14_17", "18_plus"] as const;
type AgeGroup = (typeof AGE_GROUPS)[number];

const REG_COLUMNS = "id, registration_id, full_name, christian_name, gender, birth_date_ec, birth_year_ec, birth_month_ec, birth_day_ec, mother_name, mother_phone, father_name, father_phone, extra_answers, age_years, age_group, question_version, status, created_at, archived_at, archived_by";

export type AdminRegistrationV2 = {
  id: string;
  registration_id: string;
  full_name: string;
  christian_name: string;
  gender: string;
  birth_date_ec: string | null;
  birth_year_ec: number;
  birth_month_ec: number | null;
  birth_day_ec: number | null;
  mother_name: string;
  mother_phone: string;
  father_name: string;
  father_phone: string;
  extra_answers: Record<string, string> | null;
  age_years: number | null;
  age_group: AgeGroup | null;
  question_version: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

export type RegistrationHistoricalQuestion = {
  field_key: string;
  label_am: string;
  label_en: string;
  answer: string;
  required: boolean;
  age_group: "all" | AgeGroup;
  position: number;
};

export type RegistrationAuditEntry = {
  id: string;
  registration_id: string;
  actor_user_id: string;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};

type QuestionSnapshot = {
  field_key: string;
  label_am: string;
  label_en: string;
  required: boolean;
  age_group?: "all" | AgeGroup;
  position: number;
  active?: boolean;
};

function isQuestionSnapshot(value: unknown): value is QuestionSnapshot {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return (
    typeof question.field_key === "string" &&
    typeof question.label_am === "string" &&
    typeof question.label_en === "string" &&
    typeof question.required === "boolean" &&
    typeof question.position === "number"
  );
}


async function assertStaff(context: { userId: string; claims?: Record<string, unknown>; supabase: { rpc: (name: "has_role", args: Record<string, unknown>) => PromiseLike<{ data: unknown }> } }) {
  if (isOwnerEmail(context.claims?.["email"])) return;
  const [{ data: admin }, { data: owner }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" }),
  ]);
  if (!admin && !owner) throw new Error("Forbidden");
}

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  christian_name: z.string().trim().min(2).max(100),
  gender: z.enum(["ወንድ", "ሴት"]),
  age_group: z.enum(AGE_GROUPS),
  birth_date_ec: z.string().trim().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  mother_name: z.string().trim().max(100),
  mother_phone: z.string().trim().max(20),
  father_name: z.string().trim().max(100),
  father_phone: z.string().trim().max(20),
  status: z.enum(["pending", "approved", "rejected"]),
});

function parseBirthDate(value: string) {
  const parsed = validateEthiopianDate(value);
  if (!parsed) throw new Error("Invalid Ethiopian birth date");
  return parsed;
}

function matchesGroup(age: number | null, group: AgeGroup) {
  if (age == null) return false;
  if (group === "7_13") return age >= 7 && age <= 13;
  if (group === "14_17") return age >= 14 && age <= 17;
  return age >= 18;
}

export const listRegistrationsV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Authorization is checked above; use the server client for the data read so
    // the dashboard is not blocked by a stale/mismatched registration RLS policy.
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .select(REG_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load registrations");
    return (data ?? []) as AdminRegistrationV2[];
  });

export const updateRegistrationV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { day, month, year } = parseBirthDate(data.birth_date_ec);
    const age = ethiopianAge(year, month);
    if (!matchesGroup(age, data.age_group)) throw new Error(`Calculated Ethiopian age ${age ?? "unknown"} does not match the selected age group.`);
    const { data: before, error: readError } = await context.supabase
      .from("registrations")
      .select("full_name, christian_name, gender, age_group, birth_date_ec, age_years, mother_name, mother_phone, father_name, father_phone, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !before) throw new Error("Registration not found");
    const { error } = await context.supabase.from("registrations").update({ full_name: data.full_name, christian_name: data.christian_name, gender: data.gender, age_group: data.age_group, birth_date_ec: data.birth_date_ec, birth_day_ec: day, birth_month_ec: month, birth_year_ec: year, age_years: age, mother_name: data.mother_name, mother_phone: data.mother_phone, father_name: data.father_name, father_phone: data.father_phone, status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message || "Could not update the registration");
    const changes: Record<string, unknown> = {};
    const trackedFields = [
      "full_name",
      "christian_name",
      "gender",
      "age_group",
      "birth_date_ec",
      "mother_name",
      "mother_phone",
      "father_name",
      "father_phone",
      "status",
    ] as const;
    for (const field of trackedFields) {
      const from = before[field];
      const to = data[field];
      if (from !== to) changes[field] = { from, to };
    }
    if (before.birth_date_ec !== data.birth_date_ec) {
      changes.birth_date_ec = {
        from: before.birth_date_ec,
        to: data.birth_date_ec,
        age: { from: before.age_years, to: age },
      };
    }
    if (Object.keys(changes).length) {
      const { error: auditError } = await context.supabase
        .from("registration_audit_history")
        .insert({
          registration_id: data.id,
          actor_user_id: context.userId,
          action: "admin_update",
          changes,
        });
      if (auditError) throw new Error("Registration updated, but audit history could not be saved");
    }
    return { ok: true, age_years: age };
  });

export const setRegistrationStatusV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: before } = await context.supabase.from("registrations").select("status").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("registrations").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Could not change the status");
    if (before?.status !== data.status) await context.supabase.from("registration_audit_history").insert({ registration_id: data.id, actor_user_id: context.userId, action: "status_change", changes: { status: { from: before?.status, to: data.status } } });
    return { ok: true };
  });

export const archiveRegistrationV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("registrations").update({ archived_at: new Date().toISOString(), archived_by: context.userId }).eq("id", data.id);
    if (error) throw new Error("Could not archive the registration");
    await context.supabase.from("registration_audit_history").insert({ registration_id: data.id, actor_user_id: context.userId, action: "archive", changes: { archived: { from: false, to: true } } });
    return { ok: true };
  });

export const restoreRegistrationV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("registrations").update({ archived_at: null, archived_by: null }).eq("id", data.id);
    if (error) throw new Error("Could not restore the registration");
    await context.supabase.from("registration_audit_history").insert({ registration_id: data.id, actor_user_id: context.userId, action: "restore", changes: { archived: { from: true, to: false } } });
    return { ok: true };
  });

export const listRegistrationAuditV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ registration_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: rows, error } = await context.supabase.from("registration_audit_history").select("id, registration_id, actor_user_id, action, changes, created_at").eq("registration_id", data.registration_id).order("created_at", { ascending: false });
    if (error) throw new Error("Could not load audit history");
    return (rows ?? []) as RegistrationAuditEntry[];
  });

export const getRegistrationHistoricalQuestionsV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ registration_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: row, error } = await context.supabase.from("registrations").select(REG_COLUMNS).eq("id", data.registration_id).single();
    if (error || !row) throw new Error("Registration not found");
    const version = Number(row.question_version ?? 0);
    let questions: QuestionSnapshot[] = [];
    if (version > 0) {
      const { data: versionRow } = await context.supabase.from("registration_question_versions").select("version, questions").eq("version", version).maybeSingle();
      if (Array.isArray(versionRow?.questions)) questions = versionRow.questions.filter(isQuestionSnapshot);
    }
    const answers = (row.extra_answers ?? {}) as Record<string, string>;
    return questions
      .filter((q) => q.active !== false)
      .sort((a, b) => a.position - b.position)
      .map((q): RegistrationHistoricalQuestion => {
        let answer = "";
        if (q.field_key === "full_name") answer = row.full_name;
        else if (q.field_key === "christian_name") answer = row.christian_name;
        else if (q.field_key === "gender") answer = row.gender;
        else if (q.field_key === "birth_date_ec") answer = row.birth_date_ec ?? "";
        else if (q.field_key === "mother_name") answer = row.mother_name;
        else if (q.field_key === "mother_phone") answer = row.mother_phone;
        else if (q.field_key === "father_name") answer = row.father_name;
        else if (q.field_key === "father_phone") answer = row.father_phone;
        else answer = answers[q.field_key] ?? "";
        return { field_key: q.field_key, label_am: q.label_am, label_en: q.label_en, answer: answer || (q.required ? "" : "-"), required: q.required, age_group: q.age_group ?? "all", position: q.position };
      });
  });
