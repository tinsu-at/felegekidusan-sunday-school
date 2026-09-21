import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ethiopianAge, label as questionLabel } from "@/lib/question-config";
import { publishedQuestions } from "@/lib/question-config.server";
import { OWNER_EMAIL, isOwnerEmail } from "@/lib/owner-auth";

const REG_COLUMNS =
  "id, registration_id, full_name, christian_name, gender, birth_date_ec, birth_year_ec, birth_month_ec, birth_day_ec, mother_name, mother_phone, father_name, father_phone, extra_answers, age_years, status, created_at";

export type AdminRegistration = {
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
  status: string;
  created_at: string;
};

/**
 * The single designated owner account. Sign-in still goes through the normal
 * Supabase authentication flow; this address only identifies the owner.
 */
/** Primary owner address shown in the dashboard. */
export { OWNER_EMAIL } from "@/lib/owner-auth";

/** Is the caller an admin/owner? Also reports whether any admin exists yet. */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // The designated owner address is granted owner + admin automatically.
    if (isOwnerEmail(email)) {
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const have = new Set((existing ?? []).map((r) => r.role));
      const missing = (["owner", "admin"] as const).filter((r) => !have.has(r));
      if (missing.length) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert(missing.map((role) => ({ user_id: context.userId, role })));
        if (roleError) throw new Error("Could not initialize owner access");
      }
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      return {
        isAdmin: true,
        isOwner: true,
        adminCount: count ?? 0,
        email,
        ownerEmail: OWNER_EMAIL,
      };
    }

    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      }),
      context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "owner",
      }),
    ]);
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    return {
      isAdmin: Boolean(isAdmin) || Boolean(isOwner),
      isOwner: Boolean(isOwner),
      adminCount: count ?? 0,
      email,
      ownerEmail: OWNER_EMAIL,
    };
  });

/** The very first signed-in user may claim owner + administrator access. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isOwnerEmail(context.claims?.["email"])) throw new Error("Forbidden");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert([
        { user_id: context.userId, role: "admin" },
        { user_id: context.userId, role: "owner" },
      ]);
    if (error) throw new Error("Could not grant administrator access");
    return { ok: true };
  });

export const listRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("registrations")
      .select(REG_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load registrations");
    return (data ?? []) as AdminRegistration[];
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  christian_name: z.string().trim().min(2).max(100),
  gender: z.enum(["ወንድ", "ሴት"]),
  birth_date_ec: z.string().trim().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  mother_name: z.string().trim().min(2).max(100),
  mother_phone: z.string().trim().min(9).max(20),
  father_name: z.string().trim().min(2).max(100),
  father_phone: z.string().trim().min(9).max(20),
  status: z.enum(["pending", "approved", "rejected"]),
});

export const updateRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { id, birth_date_ec, ...rest } = data;
    const parts = birth_date_ec.split("/").map(Number);
    const [day, month, year] = parts;
    const { error } = await context.supabase
      .from("registrations")
      .update({
        ...rest,
        birth_date_ec,
        birth_day_ec: day!,
        birth_month_ec: month!,
        birth_year_ec: year!,
        age_years: ethiopianAge(year, month, day),
      })
      .eq("id", id);
    if (error) throw new Error("Could not update the registration");
    return { ok: true };
  });

export const setRegistrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("registrations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Could not change the status");
    return { ok: true };
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("registrations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the registration");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Owner-only settings: Telegram admins, Help & Information, CSV export
// ---------------------------------------------------------------------------

/** Throws unless the caller holds the owner role. */
async function assertOwner(context: {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "owner" },
    ) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
  claims?: Record<string, unknown>;
}) {
  if (isOwnerEmail(context.claims?.["email"])) return;
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (!data) throw new Error("Forbidden");
}

export type BotAdmin = {
  id: string;
  telegram_user_id: number;
  telegram_chat_id: number;
  label: string;
  role: string;
  active: boolean;
  created_at: string;
};

export const listBotAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("bot_admins")
      .select("id, telegram_user_id, telegram_chat_id, label, role, active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load the admin list");
    return (data ?? []) as BotAdmin[];
  });

const botAdminSchema = z.object({
  telegram_user_id: z.coerce.number().int().positive(),
  telegram_chat_id: z.coerce.number().int().optional(),
  label: z.string().trim().max(100).default(""),
  role: z.enum(["owner", "admin"]).default("admin"),
  active: z.boolean().default(true),
});

export const saveBotAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => botAdminSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.from("bot_admins").upsert(
      {
        telegram_user_id: data.telegram_user_id,
        telegram_chat_id: data.telegram_chat_id ?? data.telegram_user_id,
        label: data.label,
        role: data.role,
        active: data.active,
      },
      { onConflict: "telegram_user_id" },
    );
    if (error) throw new Error("Could not save the admin");
    return { ok: true };
  });

export const removeBotAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("bot_admins")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not remove the admin");
    return { ok: true };
  });

export type HelpRow = {
  lang: "am" | "en";
  title: string;
  body: string;
  instructions: string;
  contacts: string;
  announcements: string;
  buttons: { text: string; url: string }[];
};

export const listHelpContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("help_content")
      .select("lang, title, body, instructions, contacts, announcements, buttons");
    if (error) throw new Error("Could not load the help content");
    return (data ?? []) as HelpRow[];
  });

const helpSchema = z.object({
  lang: z.enum(["am", "en"]),
  title: z.string().trim().max(200),
  body: z.string().trim().max(2000),
  instructions: z.string().trim().max(2000),
  contacts: z.string().trim().max(1000),
  announcements: z.string().trim().max(2000),
  buttons: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(60),
        url: z.string().trim().url().max(300),
      }),
    )
    .max(6)
    .default([]),
});

export const saveHelpContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => helpSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("help_content")
      .upsert({ ...data }, { onConflict: "lang" });
    if (error) throw new Error("Could not save the help content");
    return { ok: true };
  });

export const resetHelpContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ lang: z.enum(["am", "en"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const [{ defaultHelpContent }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/help-content.server"),
      import("@/integrations/supabase/client.server"),
    ]);
    const defaults = defaultHelpContent(data.lang);
    const { error } = await supabaseAdmin
      .from("help_content")
      .upsert({ ...defaults }, { onConflict: "lang" });
    if (error) throw new Error("Could not reset the help content");
    return { ok: true, content: defaults };
  });

/** Owner-only CSV export of all registrations using the latest published questions. */
export const exportRegistrationsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);

    const [{ data, error }, questions] = await Promise.all([
      context.supabase
        .from("registrations")
        .select(REG_COLUMNS)
        .order("created_at", { ascending: false }),
      publishedQuestions(),
    ]);

    if (error) throw new Error("Could not export the registrations");

    const rows = (data ?? []) as AdminRegistration[];

    // Keep the registration id and system fields stable, while the question
    // columns always follow the latest PUBLISHED question configuration.
    const questionColumns = questions.map((q) => ({
      key: q.field_key,
      header: questionLabel(q, "en").split("\n")[0]?.trim() || q.field_key,
    }));

    const headers = [
      "registration_id",
      ...questionColumns.map((q) => q.header),
      "age_years",
      "status",
      "created_at",
    ];

    const uniqueHeaders = headers.map((header, index) => {
      const first = headers.indexOf(header);
      return first === index ? header : `${header} (${index + 1})`;
    });

    const escape = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;

    const valueForQuestion = (row: AdminRegistration, key: string) => {
      if (key === "birth_date_ec") {
        if (row.birth_date_ec) return row.birth_date_ec;
        if (
          row.birth_day_ec != null &&
          row.birth_month_ec != null &&
          row.birth_year_ec
        ) {
          return `${String(row.birth_day_ec).padStart(2, "0")}/${String(row.birth_month_ec).padStart(2, "0")}/${row.birth_year_ec}`;
        }
      }

      if (
        key === "full_name" ||
        key === "christian_name" ||
        key === "gender" ||
        key === "mother_name" ||
        key === "mother_phone" ||
        key === "father_name" ||
        key === "father_phone"
      ) {
        return (row as unknown as Record<string, unknown>)[key];
      }

      return row.extra_answers?.[key] ?? "";
    };

    const csv = [
      uniqueHeaders.join(","),
      ...rows.map((row) => {
        const values = [
          row.registration_id,
          ...questionColumns.map((q) => valueForQuestion(row, q.key)),
          row.age_years ?? ethiopianAge(row.birth_year_ec, row.birth_month_ec, row.birth_day_ec),
          row.status,
          row.created_at,
        ];
        return values.map(escape).join(",");
      }),
    ].join("\n");

    return { csv, count: rows.length };
  });

// ---------------------------------------------------------------------------
// Owner-only: dashboard accounts (who may sign in to /admin)
// ---------------------------------------------------------------------------

export type DashboardAdmin = {
  user_id: string;
  email: string;
  role: "owner" | "admin";
  isOwnerAccount: boolean;
  created_at: string | null;
};

/** Map of user id -> email, read through the Auth Admin API. */
async function emailIndex(supabaseAdmin: {
  auth: { admin: { listUsers: (o: { page: number; perPage: number }) => Promise<{ data: { users: { id: string; email?: string | null }[] } }> } };
}) {
  const map = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    const users = data?.users ?? [];
    for (const u of users) map.set(u.id, (u.email ?? "").toLowerCase());
    if (users.length < 200) break;
  }
  return map;
}

export const listDashboardAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data: roles }, emails] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("role", ["owner", "admin"])
        .order("created_at", { ascending: true }),
      emailIndex(supabaseAdmin as never),
    ]);
    const byUser = new Map<string, DashboardAdmin>();
    for (const row of roles ?? []) {
      if (row.role !== "owner" && row.role !== "admin") continue;
      const email = emails.get(row.user_id) ?? "";
      const current = byUser.get(row.user_id);
      const role = row.role === "owner" || current?.role === "owner"
        ? "owner"
        : "admin";
      byUser.set(row.user_id, {
        user_id: row.user_id,
        email,
        role,
        isOwnerAccount: OWNER_EMAILS.includes(email as never) || row.role === "owner",
        created_at: current?.created_at ?? row.created_at,
      });
    }
    return [...byUser.values()];
  });

/** Owner grants dashboard access to an existing or newly invited account. */
export const addDashboardAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(200),
        role: z.enum(["admin", "owner"]).default("admin"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const emails = await emailIndex(supabaseAdmin as never);
    let userId: string | undefined;
    for (const [id, mail] of emails) {
      if (mail === data.email) {
        userId = id;
        break;
      }
    }
    if (!userId) throw new Error("User account not found");
    const { error } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: data.role },
      { onConflict: "user_id,role" },
    );
    if (error) throw new Error("Could not add dashboard access");
    return { ok: true };
  });

export const removeDashboardAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    if (data.user_id === context.userId) throw new Error("Cannot remove yourself");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .in("role", ["admin", "owner"]);
    if (error) throw new Error("Could not remove dashboard access");
    return { ok: true };
  });

const questionInputSchema = z.object({
  field_key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/),
  position: z.number().int().min(1).max(100),
  label_am: z.string().max(500),
  label_en: z.string().max(500),
  input_type: z.enum(["text", "phone", "ethiopian_date", "ethiopian_year", "options"]),
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
});

const QUESTION_COLUMNS =
  "id, field_key, position, label_am, label_en, input_type, required, amharic_only, min_words, max_words, exact_words, error_am, error_en, options, is_core, active";

export type AdminQuestion = {
  id: string;
  field_key: string;
  position: number;
  label_am: string;
  label_en: string;
  input_type: string;
  required: boolean;
  amharic_only: boolean;
  min_words: number | null;
  max_words: number | null;
  exact_words: number | null;
  error_am: string;
  error_en: string;
  options: unknown;
  is_core: boolean;
  active: boolean;
};

export const listQuestionConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data: draft, error: draftError }, { data: published, error: pubError }] =
      await Promise.all([
        supabaseAdmin
          .from("registration_questions")
          .select(QUESTION_COLUMNS)
          .order("position", { ascending: true }),
        supabaseAdmin
          .from("registration_question_versions")
          .select("version, created_at")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (draftError || pubError) throw new Error("Could not load the question configuration");
    return {
      draft: (draft ?? []) as AdminQuestion[],
      publishedVersion: published?.version ?? null,
      publishedAt: published?.created_at ?? null,
    };
  });

export const saveQuestionConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => questionInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("registration_questions")
      .upsert({ ...data }, { onConflict: "field_key" });
    if (error) throw new Error("Could not save the question");
    return { ok: true };
  });

export const deleteQuestionConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error: readError } = await supabaseAdmin
      .from("registration_questions")
      .select("is_core")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error("Could not read the question");
    if (row?.is_core) throw new Error("Core questions cannot be deleted");
    const { error } = await supabaseAdmin
      .from("registration_questions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the question");
    return { ok: true };
  });

export const publishQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("registration_questions")
      .select(QUESTION_COLUMNS)
      .eq("active", true)
      .order("position", { ascending: true });
    if (error) throw new Error("Could not load the questions for publishing");
    const { data: latest } = await supabaseAdmin
      .from("registration_question_versions")
      .select("version")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = Number(latest?.version ?? 0) + 1;
    const questions = (data ?? []).map(({ id, ...q }) => q);
    const { error: insertError } = await supabaseAdmin
      .from("registration_question_versions")
      .insert({
        version: nextVersion,
        questions,
        published_by: context.userId,
      });
    if (insertError) throw new Error("Could not publish the questions");
    return { ok: true, version: nextVersion };
  });
