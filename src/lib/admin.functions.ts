import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REG_COLUMNS =
  "id, registration_id, full_name, christian_name, gender, birth_date_ec, birth_year_ec, birth_month_ec, birth_day_ec, mother_name, mother_phone, father_name, father_phone, status, created_at";

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
  status: string;
  created_at: string;
};

/** Is the caller an admin/owner? Also reports whether any admin exists yet. */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    return {
      isAdmin: Boolean(isAdmin) || Boolean(isOwner),
      isOwner: Boolean(isOwner),
      adminCount: count ?? 0,
    };
  });

/** The very first signed-in user may claim owner + administrator access. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
    const { id, birth_date_ec, ...rest } = data;
    const parts = birth_date_ec.split("/").map(Number);
    const { error } = await context.supabase
      .from("registrations")
      .update({
        ...rest,
        birth_date_ec,
        birth_day_ec: parts[0]!,
        birth_month_ec: parts[1]!,
        birth_year_ec: parts[2]!,
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

type AuthedContext = { supabase: unknown; userId: string };

/** Throws unless the caller holds the owner role. */
async function assertOwner(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
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

/** Owner-only CSV export of all registrations. */
export const exportRegistrationsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("registrations")
      .select(REG_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not export the registrations");
    const rows = (data ?? []) as AdminRegistration[];
    const headers = [
      "registration_id",
      "full_name",
      "christian_name",
      "gender",
      "birth_date_ec",
      "mother_name",
      "mother_phone",
      "father_name",
      "father_phone",
      "status",
      "created_at",
    ] as const;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","),
      ),
    ].join("\n");
    return { csv, count: rows.length };
  });
