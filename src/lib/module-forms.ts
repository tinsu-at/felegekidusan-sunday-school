/**
 * Shared (client + server safe) model for the configurable module / department
 * platform: modules, forms, fields, submissions and the workflow statuses.
 * No secrets and no server-only imports live here.
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "single_choice",
  "multi_choice",
  "boolean",
  "file",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, { am: string; en: string }> = {
  text: { am: "ጽሑፍ", en: "Text" },
  textarea: { am: "ረጅም ጽሑፍ", en: "Long text" },
  number: { am: "ቁጥር", en: "Number" },
  date: { am: "ቀን", en: "Date" },
  select: { am: "ተቆልቋይ ዝርዝር", en: "Dropdown / select" },
  single_choice: { am: "አንድ ምርጫ", en: "Single choice" },
  multi_choice: { am: "ብዙ ምርጫ", en: "Multiple choice" },
  boolean: { am: "አዎ / አይደለም", en: "Yes / No" },
  file: { am: "ፋይል ወይም ፎቶ", en: "File / photo" },
};

export function isChoiceField(type: FieldType): boolean {
  return type === "select" || type === "single_choice" || type === "multi_choice";
}

export const SUBMISSION_STATUSES = [
  "pending",
  "assigned",
  "more_info",
  "approved",
  "rejected",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_LABELS: Record<SubmissionStatus, { am: string; en: string }> = {
  pending: { am: "በመጠባበቅ ላይ", en: "Pending" },
  assigned: { am: "ተመድቧል", en: "Assigned" },
  more_info: { am: "ተጨማሪ መረጃ ተጠይቋል", en: "More information requested" },
  approved: { am: "ተፈቅዷል", en: "Approved" },
  rejected: { am: "ተቀብሏል አልተፈቀደም", en: "Rejected" },
};

export type FieldOption = {
  value: string;
  label_am: string;
  label_en: string;
};

export type FieldValidation = {
  min?: number | null;
  max?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  pattern?: string | null;
};

export type FormFieldConfig = {
  id: string;
  form_id: string;
  field_key: string;
  position: number;
  field_type: FieldType;
  label_am: string;
  label_en: string;
  help_am: string;
  help_en: string;
  placeholder: string;
  required: boolean;
  options: FieldOption[];
  validation: FieldValidation;
  error_am: string;
  error_en: string;
  active: boolean;
};

export type ModuleFormConfig = {
  id: string;
  module_id: string;
  slug: string;
  title_am: string;
  title_en: string;
  description_am: string;
  description_en: string;
  display_order: number;
  published: boolean;
  active: boolean;
  workflow_enabled: boolean;
  requires_student_id: boolean;
};

export type PlatformModule = {
  id: string;
  slug: string;
  name_am: string;
  name_en: string;
  description_am: string;
  description_en: string;
  icon: string;
  category: string;
  display_order: number;
  active: boolean;
  student_visible: boolean;
  admin_visible: boolean;
  is_system: boolean;
};

export type ModulePermission = {
  id: string;
  module_id: string;
  role: "admin" | "moderator" | "user" | "owner";
  can_view: boolean;
  can_submit: boolean;
  can_manage: boolean;
};

export type FormSubmissionRecord = {
  id: string;
  submission_code: string;
  form_id: string;
  module_id: string;
  registration_id: string | null;
  student_name: string;
  answers: Record<string, unknown>;
  files: unknown[];
  status: string;
  assigned_label: string;
  review_note: string;
  created_at: string;
};

export type SubmissionEvent = {
  id: string;
  submission_id: string;
  from_status: string;
  to_status: string;
  note: string;
  actor_label: string;
  created_at: string;
};

/** Language-aware label with a graceful fallback to the other language. */
export function pick(am: string, en: string, lang: "am" | "en"): string {
  const primary = lang === "am" ? am : en;
  return primary.trim() || (lang === "am" ? en : am);
}

export function fieldLabel(f: FormFieldConfig, lang: "am" | "en") {
  return pick(f.label_am, f.label_en, lang) || f.field_key;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Validates one answer against a field configuration.
 * Returns an error message (in the caller's language) or null when valid.
 */
export function validateAnswer(
  field: FormFieldConfig,
  raw: unknown,
  lang: "am" | "en",
): string | null {
  const custom = pick(field.error_am, field.error_en, lang);
  const fail = (am: string, en: string) =>
    custom || (lang === "am" ? am : en);

  const isEmpty =
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim() === "") ||
    (Array.isArray(raw) && raw.length === 0);

  if (isEmpty) {
    return field.required
      ? fail("እባክዎ ይህን መረጃ ይሙሉ።", "This field is required.")
      : null;
  }

  const v = field.validation ?? {};

  switch (field.field_type) {
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return fail("ትክክለኛ ቁጥር ያስገቡ።", "Enter a valid number.");
      if (v.min != null && n < v.min)
        return fail(`ቢያንስ ${v.min} መሆን አለበት።`, `Must be at least ${v.min}.`);
      if (v.max != null && n > v.max)
        return fail(`ከ ${v.max} መብለጥ አይችልም።`, `Must be at most ${v.max}.`);
      return null;
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw)))
        return fail("ትክክለኛ ቀን ይምረጡ።", "Choose a valid date.");
      return null;
    }
    case "boolean": {
      if (typeof raw !== "boolean" && raw !== "true" && raw !== "false")
        return fail("አዎ ወይም አይደለም ይምረጡ።", "Choose Yes or No.");
      return null;
    }
    case "select":
    case "single_choice": {
      const allowed = field.options.map((o) => o.value);
      if (!allowed.includes(String(raw)))
        return fail("ከተሰጡት ምርጫዎች ይምረጡ።", "Choose one of the given options.");
      return null;
    }
    case "multi_choice": {
      const allowed = field.options.map((o) => o.value);
      const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      if (values.some((x) => !allowed.includes(x)))
        return fail("ከተሰጡት ምርጫዎች ይምረጡ።", "Choose from the given options.");
      return null;
    }
    case "file": {
      if (typeof raw !== "string" || raw.trim().length < 3)
        return fail("ትክክለኛ ፋይል ያያዙ።", "Attach a valid file.");
      return null;
    }
    default: {
      const s = String(raw).trim();
      if (v.min_length != null && s.length < v.min_length)
        return fail(
          `ቢያንስ ${v.min_length} ቁምፊ ያስፈልጋል።`,
          `Must be at least ${v.min_length} characters.`,
        );
      if (v.max_length != null && s.length > v.max_length)
        return fail(
          `ከ ${v.max_length} ቁምፊ መብለጥ አይችልም።`,
          `Must be at most ${v.max_length} characters.`,
        );
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(s))
            return fail("ትክክለኛ መረጃ ያስገቡ።", "Enter a valid value.");
        } catch {
          /* an invalid stored pattern never blocks a submission */
        }
      }
      return null;
    }
  }
}
