import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ethiopianAge } from "@/lib/question-config";

const AGE_GROUPS = ["7_13", "14_17", "18_plus"] as const;
type AgeGroup = (typeof AGE_GROUPS)[number];

const REG_COLUMNS = "id, registration_id, full_name, christian_name, gender, birth_date_ec, birth_year_ec, birth_month_ec, birth_day_ec, mother_name, mother_phone, father_name, father_phone, extra_answers, age_years, age_group, question_version, status, created_at";

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
  status: string;
  created_at: string;
};

const OWNER_EMAILS = ["tinsaetsegaye85@gmail.com", "sinsaetsegaye85@gmail.com"] as const;
function isOwnerEmail(email: unknown) {
  return OWNER_EMAILS.includes(String(email ?? "").trim().toLowerCase() as (typeof OWNER_EMAILS)[number]);
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
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year || month < 1 || month > 13 || day < 1 || day > 30) {
    throw new Error("Invalid Ethiopian birth date");
  }
  return { day, month, year };
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
    const { data, error } = await context.supabase
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
    if (!matchesGroup(age, data.age_group)) {
      throw new Error(`Calculated Ethiopian age ${age ?? "unknown"} does not match the selected age group.`);
    }

    const { data: before, error: readError } = await context.supabase
      .from("registrations")
      .select("age_group, birth_date_ec, age_years, question_version, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !before) throw new Error("Registration not found");

    const { error } = await context.supabase
      .from("registrations")
      .update({
        full_name: data.full_name,
        christian_name: data.christian_name,
        gender: data.gender,
        age_group: data.age_group,
        birth_date_ec: data.birth_date_ec,
        birth_day_ec: day,
        birth_month_ec: month,
        birth_year_ec: year,
        age_years: age,
        mother_name: data.mother_name,
        mother_phone: data.mother_phone,
        father_name: data.father_name,
        father_phone: data.father_phone,
        status: data.status,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message || "Could not update the registration");

    const changes: Record<string, unknown> = {};
    if (before.age_group !== data.age_group) changes.age_group = { from: before.age_group, to: data.age_group };
    if (before.birth_date_ec !== data.birth_date_ec) changes.birth_date_ec = { from: before.birth_date_ec, to: data.birth_date_ec, age: { from: before.age_years, to: age } };
    if (before.status !== data.status) changes.status = { from: before.status, to: data.status };
    if (Object.keys(changes).length) {
      const { error: auditError } = await context.supabase.from("registration_audit_history").insert({ registration_id: data.id, actor_user_id: context.userId, action: "admin_update", changes });
      if (auditError) console.error("Registration audit history could not be recorded");
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
    if (before?.status !== data.status) {
      await context.supabase.from("registration_audit_history").insert({ registration_id: data.id, actor_user_id: context.userId, action: "status_change", changes: { status: { from: before?.status, to: data.status } } });
    }
    return { ok: true };
  });
