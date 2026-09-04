/**
 * Server functions for the configurable module / department platform.
 *
 * Reads for staff go through the caller's own (RLS-scoped) client; writes are
 * owner-gated. Public form reads and student submissions use a publishable-key
 * client so nothing privileged is exposed. The existing registration and
 * question systems are untouched by everything in this file.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  FIELD_TYPES,
  SUBMISSION_STATUSES,
  validateAnswer,
  type FormFieldConfig,
  type FormSubmissionRecord,
  type ModuleFormConfig,
  type ModulePermission,
  type PlatformModule,
  type SubmissionEvent,
} from "@/lib/module-forms";

const MODULE_COLUMNS =
  "id, slug, name_am, name_en, description_am, description_en, icon, category, display_order, active, student_visible, admin_visible, is_system";
const FORM_COLUMNS =
  "id, module_id, slug, title_am, title_en, description_am, description_en, display_order, published, active, workflow_enabled, requires_student_id";
const FIELD_COLUMNS =
  "id, form_id, field_key, position, field_type, label_am, label_en, help_am, help_en, placeholder, required, options, validation, error_am, error_en, active";
const SUBMISSION_COLUMNS =
  "id, submission_code, form_id, module_id, registration_id, student_name, answers, files, status, assigned_label, review_note, created_at";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Staff reads
// ---------------------------------------------------------------------------

export type ModuleOverview = {
  modules: PlatformModule[];
  permissions: ModulePermission[];
  forms: ModuleFormConfig[];
  fields: FormFieldConfig[];
  submissionCounts: Record<string, number>;
};

export const listModuleOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModuleOverview> => {
    const { assertStaff } = await import("@/lib/staff-access.server");
    await assertStaff(context);

    const [modules, permissions, forms, fields, submissions] = await Promise.all([
      context.supabase
        .from("platform_modules")
        .select(MODULE_COLUMNS)
        .order("display_order", { ascending: true }),
      context.supabase.from("module_permissions").select("*"),
      context.supabase
        .from("module_forms")
        .select(FORM_COLUMNS)
        .order("display_order", { ascending: true }),
      context.supabase
        .from("form_fields")
        .select(FIELD_COLUMNS)
        .order("position", { ascending: true }),
      context.supabase.from("form_submissions").select("form_id"),
    ]);

    if (modules.error) throw new Error("Could not load the modules");

    const counts: Record<string, number> = {};
    for (const row of submissions.data ?? []) {
      const key = String((row as { form_id: string }).form_id);
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return {
      modules: (modules.data ?? []) as unknown as PlatformModule[],
      permissions: (permissions.data ?? []) as unknown as ModulePermission[],
      forms: (forms.data ?? []) as unknown as ModuleFormConfig[],
      fields: (fields.data ?? []) as unknown as FormFieldConfig[],
      submissionCounts: counts,
    };
  });

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        formId: z.string().uuid().optional(),
        status: z.enum(SUBMISSION_STATUSES).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/staff-access.server");
    await assertStaff(context);

    let query = context.supabase
      .from("form_submissions")
      .select(SUBMISSION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.formId) query = query.eq("form_id", data.formId);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load the submissions");
    return (rows ?? []) as unknown as FormSubmissionRecord[];
  });

export const listSubmissionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ submissionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/staff-access.server");
    await assertStaff(context);
    const { data: rows, error } = await context.supabase
      .from("submission_events")
      .select("id, submission_id, from_status, to_status, note, actor_label, created_at")
      .eq("submission_id", data.submissionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load the submission history");
    return (rows ?? []) as unknown as SubmissionEvent[];
  });

// ---------------------------------------------------------------------------
// Owner writes: modules
// ---------------------------------------------------------------------------

const moduleSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  name_am: z.string().trim().max(120).default(""),
  name_en: z.string().trim().max(120).default(""),
  description_am: z.string().trim().max(1000).default(""),
  description_en: z.string().trim().max(1000).default(""),
  icon: z.string().trim().max(8).default("📦"),
  category: z.string().trim().max(60).default(""),
  display_order: z.coerce.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
  student_visible: z.boolean().default(true),
  admin_visible: z.boolean().default(true),
});

export const saveModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => moduleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { id, ...row } = data;
    if (!row.name_am && !row.name_en) throw new Error("Add a module name");
    const query = id
      ? context.supabase.from("platform_modules").update(row).eq("id", id)
      : context.supabase.from("platform_modules").insert(row);
    const { error } = await query;
    if (error)
      throw new Error(
        error.code === "23505"
          ? "A module with that key already exists"
          : "Could not save the module",
      );
    return { ok: true };
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { data: existing } = await context.supabase
      .from("platform_modules")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.is_system)
      throw new Error("Built-in modules cannot be deleted");
    const { error } = await context.supabase
      .from("platform_modules")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the module");
    return { ok: true };
  });

export const saveModulePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        module_id: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user", "owner"]),
        can_view: z.boolean().default(true),
        can_submit: z.boolean().default(false),
        can_manage: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { error } = await context.supabase
      .from("module_permissions")
      .upsert(data, { onConflict: "module_id,role" });
    if (error) throw new Error("Could not save the module permission");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Owner writes: forms and fields
// ---------------------------------------------------------------------------

const formSchema = z.object({
  id: z.string().uuid().optional(),
  module_id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  title_am: z.string().trim().max(160).default(""),
  title_en: z.string().trim().max(160).default(""),
  description_am: z.string().trim().max(1000).default(""),
  description_en: z.string().trim().max(1000).default(""),
  display_order: z.coerce.number().int().min(0).max(999).default(0),
  published: z.boolean().default(false),
  active: z.boolean().default(true),
  workflow_enabled: z.boolean().default(true),
  requires_student_id: z.boolean().default(true),
});

export const saveForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => formSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { id, ...row } = data;
    if (!row.title_am && !row.title_en) throw new Error("Add a form title");
    const query = id
      ? context.supabase.from("module_forms").update(row).eq("id", id)
      : context.supabase.from("module_forms").insert(row);
    const { error } = await query;
    if (error)
      throw new Error(
        error.code === "23505"
          ? "A form with that link already exists"
          : "Could not save the form",
      );
    return { ok: true };
  });

export const setFormPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    if (data.published) {
      const { count } = await context.supabase
        .from("form_fields")
        .select("id", { count: "exact", head: true })
        .eq("form_id", data.id)
        .eq("active", true);
      if (!count) throw new Error("Add at least one active field first");
    }
    const { error } = await context.supabase
      .from("module_forms")
      .update({ published: data.published })
      .eq("id", data.id);
    if (error) throw new Error("Could not change the form status");
    return { ok: true, published: data.published };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { error } = await context.supabase
      .from("module_forms")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the form");
    return { ok: true };
  });

const optionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label_am: z.string().trim().max(120).default(""),
  label_en: z.string().trim().max(120).default(""),
});

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  form_id: z.string().uuid(),
  field_key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
  position: z.coerce.number().int().min(1).max(200).default(1),
  field_type: z.enum(FIELD_TYPES),
  label_am: z.string().trim().max(200).default(""),
  label_en: z.string().trim().max(200).default(""),
  help_am: z.string().trim().max(500).default(""),
  help_en: z.string().trim().max(500).default(""),
  placeholder: z.string().trim().max(120).default(""),
  required: z.boolean().default(true),
  options: z.array(optionSchema).max(30).default([]),
  validation: z
    .object({
      min: z.coerce.number().nullable().default(null),
      max: z.coerce.number().nullable().default(null),
      min_length: z.coerce.number().int().min(0).max(5000).nullable().default(null),
      max_length: z.coerce.number().int().min(1).max(5000).nullable().default(null),
      pattern: z.string().max(200).nullable().default(null),
    })
    .default({}),
  error_am: z.string().trim().max(500).default(""),
  error_en: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
});

export const saveFormField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => fieldSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { id, ...row } = data;
    if (!row.label_am && !row.label_en) throw new Error("Add a field label");
    const needsOptions = ["select", "single_choice", "multi_choice"].includes(
      row.field_type,
    );
    if (needsOptions && row.options.length < 1)
      throw new Error("Add at least one option");
    const query = id
      ? context.supabase.from("form_fields").update(row).eq("id", id)
      : context.supabase.from("form_fields").insert(row);
    const { error } = await query;
    if (error)
      throw new Error(
        error.code === "23505"
          ? "A field with that key already exists in this form"
          : "Could not save the field",
      );
    return { ok: true };
  });

export const deleteFormField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { error } = await context.supabase
      .from("form_fields")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the field");
    return { ok: true };
  });

export const reorderFormFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    for (const [index, id] of data.ids.entries()) {
      const { error } = await context.supabase
        .from("form_fields")
        .update({ position: index + 1 })
        .eq("id", id);
      if (error) throw new Error("Could not save the new field order");
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const updateSubmissionWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(SUBMISSION_STATUSES),
        note: z.string().trim().max(1000).default(""),
        assigned_label: z.string().trim().max(120).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStaff } = await import("@/lib/staff-access.server");
    await assertStaff(context);

    const { data: current, error: readError } = await context.supabase
      .from("form_submissions")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !current) throw new Error("Submission not found");

    const { error } = await context.supabase
      .from("form_submissions")
      .update({
        status: data.status,
        review_note: data.note,
        assigned_label: data.assigned_label,
        assigned_to: data.assigned_label ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error("Could not update the submission");

    // History is append-only and written server-side.
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.from("submission_events").insert({
      submission_id: data.id,
      from_status: current.status,
      to_status: data.status,
      note: data.note,
      actor_id: context.userId,
      actor_label: String(context.claims["email"] ?? ""),
    });
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/staff-access.server");
    await assertOwner(context);
    const { error } = await context.supabase
      .from("form_submissions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Could not delete the submission");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Public: student-facing published forms
// ---------------------------------------------------------------------------

export type PublicForm = {
  form: ModuleFormConfig;
  module: PlatformModule;
  fields: FormFieldConfig[];
};

export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(60) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicForm | null> => {
    const supabasePublic = publicClient();
    const { data: form } = await supabasePublic
      .from("module_forms")
      .select(FORM_COLUMNS)
      .eq("slug", data.slug)
      .eq("published", true)
      .eq("active", true)
      .maybeSingle();
    if (!form) return null;

    const [{ data: mod }, { data: fields }] = await Promise.all([
      supabasePublic
        .from("platform_modules")
        .select(MODULE_COLUMNS)
        .eq("id", form.module_id)
        .maybeSingle(),
      supabasePublic
        .from("form_fields")
        .select(FIELD_COLUMNS)
        .eq("form_id", form.id)
        .eq("active", true)
        .order("position", { ascending: true }),
    ]);
    if (!mod) return null;

    return {
      form: form as unknown as ModuleFormConfig,
      module: mod as unknown as PlatformModule,
      fields: (fields ?? []) as unknown as FormFieldConfig[],
    };
  });

/** List of published, student-visible forms — safe for the public site. */
export const listPublicForms = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabasePublic = publicClient();
    const { data } = await supabasePublic
      .from("module_forms")
      .select(
        "id, slug, title_am, title_en, description_am, description_en, display_order, module_id",
      )
      .eq("published", true)
      .eq("active", true)
      .order("display_order", { ascending: true });
    return data ?? [];
  },
);

export const submitPublicForm = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().trim().min(1).max(60),
        registrationId: z.string().trim().max(40).default(""),
        lang: z.enum(["am", "en"]).default("am"),
        answers: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabasePublic = publicClient();
    const { data: form } = await supabasePublic
      .from("module_forms")
      .select(FORM_COLUMNS)
      .eq("slug", data.slug)
      .eq("published", true)
      .eq("active", true)
      .maybeSingle();
    if (!form) throw new Error("This form is not available");

    const { data: fieldRows } = await supabasePublic
      .from("form_fields")
      .select(FIELD_COLUMNS)
      .eq("form_id", form.id)
      .eq("active", true)
      .order("position", { ascending: true });
    const fields = (fieldRows ?? []) as unknown as FormFieldConfig[];

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Student identity comes from the existing FKN registration system.
    let studentName = "";
    let registrationId: string | null = null;
    let telegramUserId: number | null = null;
    const code = data.registrationId.trim().toUpperCase();
    if (form.requires_student_id || code) {
      if (!code)
        throw new Error(
          data.lang === "am"
            ? "የተማሪ መለያ (FKN) ያስገቡ።"
            : "Enter your student ID (FKN).",
        );
      const { data: student } = await supabaseAdmin
        .from("registrations")
        .select("registration_id, full_name, telegram_user_id")
        .eq("registration_id", code)
        .maybeSingle();
      if (!student)
        throw new Error(
          data.lang === "am"
            ? "በዚህ መለያ የተመዘገበ ተማሪ አልተገኘም።"
            : "No registered student found for that ID.",
        );
      registrationId = student.registration_id;
      studentName = student.full_name;
      telegramUserId = student.telegram_user_id;
    }

    // Server-side validation of every field, then store only known keys.
    const answers: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = data.answers[field.field_key];
      const error = validateAnswer(field, raw, data.lang);
      if (error) throw new Error(`${field.field_key}: ${error}`);
      if (raw !== undefined && raw !== null && raw !== "")
        answers[field.field_key] = raw;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("form_submissions")
      .insert({
        form_id: form.id,
        module_id: form.module_id,
        registration_id: registrationId,
        student_name: studentName,
        telegram_user_id: telegramUserId,
        answers,
        status: "pending",
      })
      .select("submission_code")
      .maybeSingle();
    if (error || !inserted) throw new Error("Could not save your submission");

    await supabaseAdmin.from("submission_events").insert({
      submission_id: undefined as never,
      to_status: "pending",
    } as never).then(
      () => undefined,
      () => undefined,
    );

    return { ok: true, code: inserted.submission_code };
  });
