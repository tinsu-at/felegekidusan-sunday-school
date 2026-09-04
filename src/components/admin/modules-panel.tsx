/**
 * Modules / Departments admin panel.
 *
 * A reusable foundation: modules (departments), a form builder inside each
 * module, and the submission workflow. Nothing here is specific to a single
 * department, and the existing registration + questions systems are separate.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useUiLang } from "@/lib/ui-i18n";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  STATUS_LABELS,
  SUBMISSION_STATUSES,
  isChoiceField,
  pick,
  slugify,
  type FieldOption,
  type FieldType,
  type FormFieldConfig,
  type ModuleFormConfig,
  type PlatformModule,
  type SubmissionStatus,
} from "@/lib/module-forms";
import {
  deleteForm,
  deleteFormField,
  deleteModule,
  deleteSubmission,
  listModuleOverview,
  listSubmissions,
  reorderFormFields,
  saveForm,
  saveFormField,
  saveModule,
  setFormPublished,
  updateSubmissionWorkflow,
} from "@/lib/modules.functions";

const TXT = {
  title: { am: "ክፍሎች / ሞጁሎች", en: "Modules / Departments" },
  subtitle: {
    am: "አዲስ ክፍል፣ ቅጽ እና የሥራ ፍሰት ያለ ኮድ ይፍጠሩ።",
    en: "Create departments, forms and workflows without code changes.",
  },
  newModule: { am: "+ አዲስ ክፍል", en: "+ New module" },
  edit: { am: "✏️ አስተካክል", en: "✏️ Edit" },
  del: { am: "🗑️ ሰርዝ", en: "🗑️ Delete" },
  forms: { am: "ቅጾች", en: "Forms" },
  newForm: { am: "+ አዲስ ቅጽ", en: "+ New form" },
  fields: { am: "የቅጽ ሳጥኖች", en: "Fields" },
  newField: { am: "+ አዲስ ሳጥን", en: "+ New field" },
  publish: { am: "🚀 አሳይ", en: "🚀 Publish" },
  unpublish: { am: "⛔ አታሳይ", en: "⛔ Unpublish" },
  published: { am: "ታይቷል", en: "Published" },
  draft: { am: "ረቂቅ", en: "Draft" },
  submissions: { am: "የተላኩ ቅጾች", en: "Submissions" },
  active: { am: "ገባሪ", en: "Active" },
  studentVisible: { am: "ለተማሪዎች ይታይ", en: "Visible to students" },
  adminVisible: { am: "ለአስተዳዳሪዎች ይታይ", en: "Visible to admins" },
  workflow: { am: "የሥራ ፍሰት", en: "Workflow" },
  requiresStudent: { am: "የተማሪ መለያ (FKN) ያስፈልጋል", en: "Requires student ID (FKN)" },
  required: { am: "ግዴታ", en: "Required" },
  save: { am: "አስቀምጥ", en: "Save" },
  cancel: { am: "ተው", en: "Cancel" },
  saved: { am: "ተቀምጧል", en: "Saved" },
  order: { am: "ተራ", en: "Order" },
  icon: { am: "ምልክት", en: "Icon" },
  category: { am: "ምድብ", en: "Category" },
  nameAm: { am: "ስም (አማርኛ)", en: "Name (Amharic)" },
  nameEn: { am: "ስም (እንግሊዝኛ)", en: "Name (English)" },
  descAm: { am: "መግለጫ (አማርኛ)", en: "Description (Amharic)" },
  descEn: { am: "መግለጫ (እንግሊዝኛ)", en: "Description (English)" },
  key: { am: "መለያ ቁልፍ", en: "Key" },
  link: { am: "አገናኝ", en: "Link" },
  labelAm: { am: "ጥያቄ (አማርኛ)", en: "Label (Amharic)" },
  labelEn: { am: "ጥያቄ (እንግሊዝኛ)", en: "Label (English)" },
  helpAm: { am: "ማብራሪያ (አማርኛ)", en: "Help text (Amharic)" },
  helpEn: { am: "ማብራሪያ (እንግሊዝኛ)", en: "Help text (English)" },
  type: { am: "የመረጃ ዓይነት", en: "Field type" },
  options: { am: "ምርጫዎች", en: "Options" },
  addOption: { am: "+ ምርጫ ጨምር", en: "+ Add option" },
  errorAm: { am: "የስህተት መልእክት (አማርኛ)", en: "Error message (Amharic)" },
  errorEn: { am: "የስህተት መልእክት (እንግሊዝኛ)", en: "Error message (English)" },
  minLen: { am: "ዝቅተኛ ርዝመት", en: "Min length" },
  maxLen: { am: "ከፍተኛ ርዝመት", en: "Max length" },
  min: { am: "ዝቅተኛ ቁጥር", en: "Min value" },
  max: { am: "ከፍተኛ ቁጥር", en: "Max value" },
  deleteModuleQ: { am: "ይህን ክፍል ይሰርዙ?", en: "Delete this module?" },
  deleteModuleBody: {
    am: "የክፍሉ ቅጾችና የተላኩ መረጃዎች በሙሉ ይጠፋሉ። ይህ መልስ የለውም።",
    en: "All of its forms and submissions will be removed. This cannot be undone.",
  },
  deleteFormQ: { am: "ይህን ቅጽ ይሰርዙ?", en: "Delete this form?" },
  deleteFieldQ: { am: "ይህን ሳጥን ይሰርዙ?", en: "Delete this field?" },
  confirm: { am: "አረጋግጥ", en: "Confirm" },
  noModules: { am: "እስካሁን ክፍል አልተፈጠረም።", en: "No modules yet." },
  noForms: { am: "በዚህ ክፍል ቅጽ የለም።", en: "No forms in this module." },
  noFields: { am: "ሳጥን አልተጨመረም።", en: "No fields yet." },
  noSubmissions: { am: "የተላከ ቅጽ የለም።", en: "No submissions yet." },
  student: { am: "ተማሪ", en: "Student" },
  status: { am: "ሁኔታ", en: "Status" },
  note: { am: "ማስታወሻ", en: "Note" },
  assignTo: { am: "ተጠያቂ ሰው", en: "Assigned to" },
  update: { am: "አድስ", en: "Update" },
  ownerOnly: {
    am: "ክፍሎችን መፍጠር/ማስተካከል የባለቤት ፈቃድ ይጠይቃል። የተላኩ ቅጾችን ማስተዳደር ይችላሉ።",
    en: "Only the owner can create or edit modules. You can still manage submissions.",
  },
  formLinkHint: { am: "የተማሪ አገናኝ", en: "Student link" },
} as const;

type L = "am" | "en";
const tr = (k: keyof typeof TXT, lang: L) => TXT[k][lang];

type ModuleDraft = Omit<PlatformModule, "id" | "is_system"> & { id?: string };
type FormDraft = Omit<ModuleFormConfig, "id"> & { id?: string };
type FieldDraft = Omit<FormFieldConfig, "id"> & { id?: string };

function emptyModule(order: number): ModuleDraft {
  return {
    slug: "",
    name_am: "",
    name_en: "",
    description_am: "",
    description_en: "",
    icon: "📦",
    category: "",
    display_order: order,
    active: true,
    student_visible: true,
    admin_visible: true,
  };
}

function emptyForm(moduleId: string, order: number): FormDraft {
  return {
    module_id: moduleId,
    slug: "",
    title_am: "",
    title_en: "",
    description_am: "",
    description_en: "",
    display_order: order,
    published: false,
    active: true,
    workflow_enabled: true,
    requires_student_id: true,
  };
}

function emptyField(formId: string, position: number): FieldDraft {
  return {
    form_id: formId,
    field_key: "",
    position,
    field_type: "text",
    label_am: "",
    label_en: "",
    help_am: "",
    help_en: "",
    placeholder: "",
    required: true,
    options: [],
    validation: {},
    error_am: "",
    error_en: "",
    active: true,
  };
}

export function ModulesPanel({ isOwner }: { isOwner: boolean }) {
  const { lang } = useUiLang();
  const l = lang as L;
  const queryClient = useQueryClient();

  const fetchOverview = useServerFn(listModuleOverview);
  const fetchSubmissions = useServerFn(listSubmissions);
  const doSaveModule = useServerFn(saveModule);
  const doDeleteModule = useServerFn(deleteModule);
  const doSaveForm = useServerFn(saveForm);
  const doPublish = useServerFn(setFormPublished);
  const doDeleteForm = useServerFn(deleteForm);
  const doSaveField = useServerFn(saveFormField);
  const doDeleteField = useServerFn(deleteFormField);
  const doReorder = useServerFn(reorderFormFields);
  const doWorkflow = useServerFn(updateSubmissionWorkflow);
  const doDeleteSubmission = useServerFn(deleteSubmission);

  const overview = useQuery({
    queryKey: ["module-overview"],
    queryFn: () => fetchOverview({}),
  });

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft | null>(null);
  const [formDraft, setFormDraft] = useState<FormDraft | null>(null);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "module" | "form" | "field" | "submission"; id: string }
    | null
  >(null);

  const modules = overview.data?.modules ?? [];
  const forms = overview.data?.forms ?? [];
  const fields = overview.data?.fields ?? [];
  const counts = overview.data?.submissionCounts ?? {};

  const activeModuleId = selectedModuleId ?? modules[0]?.id ?? null;
  const activeModule = modules.find((m) => m.id === activeModuleId) ?? null;
  const moduleForms = useMemo(
    () => forms.filter((f) => f.module_id === activeModuleId),
    [forms, activeModuleId],
  );

  const submissionsQuery = useQuery({
    queryKey: ["module-submissions", activeModuleId],
    queryFn: () => fetchSubmissions({ data: {} }),
    enabled: Boolean(activeModuleId),
  });

  const moduleSubmissions = (submissionsQuery.data ?? []).filter(
    (s) => s.module_id === activeModuleId,
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["module-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["module-submissions"] });
  };

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(tr("saved", l));
      refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
      return false;
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-card-foreground">
            🧩 {tr("title", l)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("subtitle", l)}
          </p>
        </div>
        {isOwner ? (
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => setModuleDraft(emptyModule(modules.length + 1))}
          >
            {tr("newModule", l)}
          </Button>
        ) : null}
      </header>

      {!isOwner ? (
        <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          {tr("ownerOnly", l)}
        </p>
      ) : null}

      {/* Module list */}
      <div className="mt-5 flex flex-wrap gap-2">
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noModules", l)}</p>
        ) : null}
        {modules.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant={m.id === activeModuleId ? "default" : "outline"}
            className="rounded-full"
            onClick={() => {
              setSelectedModuleId(m.id);
              setOpenFormId(null);
            }}
          >
            <span className="mr-1">{m.icon}</span>
            {pick(m.name_am, m.name_en, l)}
            {m.active ? null : <span className="ml-1 opacity-70">⛔</span>}
          </Button>
        ))}
      </div>

      {activeModule ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">
                  {activeModule.icon}{" "}
                  {pick(activeModule.name_am, activeModule.name_en, l)}
                  {activeModule.is_system ? (
                    <span className="ml-2 rounded-full bg-accent/30 px-2 py-0.5 text-[11px]">
                      core
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pick(
                    activeModule.description_am,
                    activeModule.description_en,
                    l,
                  )}
                </p>
                <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>{activeModule.slug}</span>
                  <span>
                    {tr("active", l)}: {activeModule.active ? "✅" : "⛔"}
                  </span>
                  <span>
                    {tr("studentVisible", l)}:{" "}
                    {activeModule.student_visible ? "✅" : "⛔"}
                  </span>
                  <span>
                    {tr("adminVisible", l)}:{" "}
                    {activeModule.admin_visible ? "✅" : "⛔"}
                  </span>
                  {activeModule.category ? (
                    <span>
                      {tr("category", l)}: {activeModule.category}
                    </span>
                  ) : null}
                </p>
              </div>
              {isOwner ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      const { id, is_system: _s, ...rest } = activeModule;
                      setModuleDraft({ id, ...rest });
                    }}
                  >
                    {tr("edit", l)}
                  </Button>
                  {activeModule.is_system ? null : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-destructive"
                      onClick={() =>
                        setConfirm({ kind: "module", id: activeModule.id })
                      }
                    >
                      {tr("del", l)}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Forms */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                📄 {tr("forms", l)}
              </h3>
              {isOwner ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() =>
                    setFormDraft(
                      emptyForm(activeModule.id, moduleForms.length + 1),
                    )
                  }
                >
                  {tr("newForm", l)}
                </Button>
              ) : null}
            </div>

            {moduleForms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr("noForms", l)}
              </p>
            ) : null}

            {moduleForms.map((form) => {
              const formFields = fields
                .filter((f) => f.form_id === form.id)
                .sort((a, b) => a.position - b.position);
              const open = openFormId === form.id;
              return (
                <div
                  key={form.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setOpenFormId(open ? null : form.id)}
                    >
                      <p className="font-semibold text-foreground">
                        {open ? "▾" : "▸"}{" "}
                        {pick(form.title_am, form.title_en, l)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span
                          className={
                            form.published
                              ? "rounded-full bg-primary/12 px-2 py-0.5 text-primary"
                              : "rounded-full bg-muted px-2 py-0.5"
                          }
                        >
                          {form.published ? tr("published", l) : tr("draft", l)}
                        </span>{" "}
                        · {formFields.length} {tr("fields", l)} ·{" "}
                        {counts[form.id] ?? 0} {tr("submissions", l)}
                        {form.published ? (
                          <>
                            {" "}
                            · {tr("formLinkHint", l)}:{" "}
                            <code>/forms/{form.slug}</code>
                          </>
                        ) : null}
                      </p>
                    </button>
                    {isOwner ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() =>
                            void run(() =>
                              doPublish({
                                data: {
                                  id: form.id,
                                  published: !form.published,
                                },
                              }),
                            )
                          }
                        >
                          {form.published
                            ? tr("unpublish", l)
                            : tr("publish", l)}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            const { id, ...rest } = form;
                            setFormDraft({ id, ...rest });
                          }}
                        >
                          {tr("edit", l)}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-destructive"
                          onClick={() =>
                            setConfirm({ kind: "form", id: form.id })
                          }
                        >
                          {tr("del", l)}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {open ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {tr("fields", l)}
                        </h4>
                        {isOwner ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-full"
                            onClick={() =>
                              setFieldDraft(
                                emptyField(form.id, formFields.length + 1),
                              )
                            }
                          >
                            {tr("newField", l)}
                          </Button>
                        ) : null}
                      </div>

                      {formFields.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {tr("noFields", l)}
                        </p>
                      ) : null}

                      {formFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {field.position}.{" "}
                              {pick(field.label_am, field.label_en, l) ||
                                field.field_key}
                              {field.required ? (
                                <span className="text-destructive"> *</span>
                              ) : null}
                              {field.active ? null : (
                                <span className="ml-1 opacity-70">⛔</span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {field.field_key} ·{" "}
                              {FIELD_TYPE_LABELS[field.field_type]?.[l] ??
                                field.field_type}
                            </p>
                          </div>
                          {isOwner ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={index === 0}
                                onClick={() => {
                                  const ids = formFields.map((f) => f.id);
                                  const swap = ids[index - 1]!;
                                  ids[index - 1] = ids[index]!;
                                  ids[index] = swap;
                                  void run(() => doReorder({ data: { ids } }));
                                }}
                              >
                                ⬆️
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={index === formFields.length - 1}
                                onClick={() => {
                                  const ids = formFields.map((f) => f.id);
                                  const swap = ids[index + 1]!;
                                  ids[index + 1] = ids[index]!;
                                  ids[index] = swap;
                                  void run(() => doReorder({ data: { ids } }));
                                }}
                              >
                                ⬇️
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const { id, ...rest } = field;
                                  setFieldDraft({ id, ...rest });
                                }}
                              >
                                ✏️
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() =>
                                  setConfirm({ kind: "field", id: field.id })
                                }
                              >
                                🗑️
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Submissions + workflow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              📥 {tr("submissions", l)}
            </h3>
            {moduleSubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr("noSubmissions", l)}
              </p>
            ) : null}
            {moduleSubmissions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {s.submission_code}
                      {s.registration_id ? ` · ${s.registration_id}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.student_name || "—"} ·{" "}
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    {STATUS_LABELS[s.status as SubmissionStatus]?.[l] ??
                      s.status}
                  </span>
                </div>

                <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {Object.entries(s.answers ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <dt className="inline font-medium">{k}: </dt>
                      <dd className="inline">
                        {Array.isArray(v) ? v.join(", ") : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>

                <WorkflowRow
                  lang={l}
                  isOwner={isOwner}
                  current={s.status}
                  note={s.review_note}
                  assigned={s.assigned_label}
                  onUpdate={(status, note, assigned) =>
                    run(() =>
                      doWorkflow({
                        data: {
                          id: s.id,
                          status,
                          note,
                          assigned_label: assigned,
                        },
                      }),
                    )
                  }
                  onDelete={() =>
                    setConfirm({ kind: "submission", id: s.id })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Module dialog */}
      <Dialog
        open={Boolean(moduleDraft)}
        onOpenChange={(o) => (o ? null : setModuleDraft(null))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("title", l)}</DialogTitle>
          </DialogHeader>
          {moduleDraft ? (
            <div className="space-y-3">
              <Field label={tr("nameAm", l)}>
                <Input
                  value={moduleDraft.name_am}
                  onChange={(e) =>
                    setModuleDraft({
                      ...moduleDraft,
                      name_am: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={tr("nameEn", l)}>
                <Input
                  value={moduleDraft.name_en}
                  onChange={(e) => {
                    const name_en = e.target.value;
                    setModuleDraft({
                      ...moduleDraft,
                      name_en,
                      slug:
                        moduleDraft.id || moduleDraft.slug
                          ? moduleDraft.slug
                          : slugify(name_en),
                    });
                  }}
                />
              </Field>
              <Field label={tr("key", l)}>
                <Input
                  value={moduleDraft.slug}
                  onChange={(e) =>
                    setModuleDraft({
                      ...moduleDraft,
                      slug: slugify(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label={tr("descAm", l)}>
                <Textarea
                  rows={2}
                  value={moduleDraft.description_am}
                  onChange={(e) =>
                    setModuleDraft({
                      ...moduleDraft,
                      description_am: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={tr("descEn", l)}>
                <Textarea
                  rows={2}
                  value={moduleDraft.description_en}
                  onChange={(e) =>
                    setModuleDraft({
                      ...moduleDraft,
                      description_en: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label={tr("icon", l)}>
                  <Input
                    value={moduleDraft.icon}
                    onChange={(e) =>
                      setModuleDraft({ ...moduleDraft, icon: e.target.value })
                    }
                  />
                </Field>
                <Field label={tr("category", l)}>
                  <Input
                    value={moduleDraft.category}
                    onChange={(e) =>
                      setModuleDraft({
                        ...moduleDraft,
                        category: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label={tr("order", l)}>
                  <Input
                    type="number"
                    value={moduleDraft.display_order}
                    onChange={(e) =>
                      setModuleDraft({
                        ...moduleDraft,
                        display_order: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
              </div>
              <Toggle
                label={tr("active", l)}
                checked={moduleDraft.active}
                onChange={(active) =>
                  setModuleDraft({ ...moduleDraft, active })
                }
              />
              <Toggle
                label={tr("studentVisible", l)}
                checked={moduleDraft.student_visible}
                onChange={(student_visible) =>
                  setModuleDraft({ ...moduleDraft, student_visible })
                }
              />
              <Toggle
                label={tr("adminVisible", l)}
                checked={moduleDraft.admin_visible}
                onChange={(admin_visible) =>
                  setModuleDraft({ ...moduleDraft, admin_visible })
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDraft(null)}>
              {tr("cancel", l)}
            </Button>
            <Button
              onClick={async () => {
                if (!moduleDraft) return;
                const ok = await run(() =>
                  saveModuleCall(doSaveModule, moduleDraft),
                );
                if (ok) setModuleDraft(null);
              }}
            >
              {tr("save", l)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form dialog */}
      <Dialog
        open={Boolean(formDraft)}
        onOpenChange={(o) => (o ? null : setFormDraft(null))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("forms", l)}</DialogTitle>
          </DialogHeader>
          {formDraft ? (
            <div className="space-y-3">
              <Field label={tr("labelAm", l)}>
                <Input
                  value={formDraft.title_am}
                  onChange={(e) =>
                    setFormDraft({ ...formDraft, title_am: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("labelEn", l)}>
                <Input
                  value={formDraft.title_en}
                  onChange={(e) => {
                    const title_en = e.target.value;
                    setFormDraft({
                      ...formDraft,
                      title_en,
                      slug:
                        formDraft.id || formDraft.slug
                          ? formDraft.slug
                          : slugify(title_en),
                    });
                  }}
                />
              </Field>
              <Field label={tr("link", l)}>
                <Input
                  value={formDraft.slug}
                  onChange={(e) =>
                    setFormDraft({ ...formDraft, slug: slugify(e.target.value) })
                  }
                />
              </Field>
              <Field label={tr("descAm", l)}>
                <Textarea
                  rows={2}
                  value={formDraft.description_am}
                  onChange={(e) =>
                    setFormDraft({
                      ...formDraft,
                      description_am: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={tr("descEn", l)}>
                <Textarea
                  rows={2}
                  value={formDraft.description_en}
                  onChange={(e) =>
                    setFormDraft({
                      ...formDraft,
                      description_en: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={tr("order", l)}>
                <Input
                  type="number"
                  value={formDraft.display_order}
                  onChange={(e) =>
                    setFormDraft({
                      ...formDraft,
                      display_order: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Toggle
                label={tr("active", l)}
                checked={formDraft.active}
                onChange={(active) => setFormDraft({ ...formDraft, active })}
              />
              <Toggle
                label={tr("workflow", l)}
                checked={formDraft.workflow_enabled}
                onChange={(workflow_enabled) =>
                  setFormDraft({ ...formDraft, workflow_enabled })
                }
              />
              <Toggle
                label={tr("requiresStudent", l)}
                checked={formDraft.requires_student_id}
                onChange={(requires_student_id) =>
                  setFormDraft({ ...formDraft, requires_student_id })
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDraft(null)}>
              {tr("cancel", l)}
            </Button>
            <Button
              onClick={async () => {
                if (!formDraft) return;
                const ok = await run(() =>
                  doSaveForm({ data: formDraft as never }),
                );
                if (ok) setFormDraft(null);
              }}
            >
              {tr("save", l)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field dialog */}
      <Dialog
        open={Boolean(fieldDraft)}
        onOpenChange={(o) => (o ? null : setFieldDraft(null))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("fields", l)}</DialogTitle>
          </DialogHeader>
          {fieldDraft ? (
            <div className="space-y-3">
              <Field label={tr("labelAm", l)}>
                <Input
                  value={fieldDraft.label_am}
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, label_am: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("labelEn", l)}>
                <Input
                  value={fieldDraft.label_en}
                  onChange={(e) => {
                    const label_en = e.target.value;
                    setFieldDraft({
                      ...fieldDraft,
                      label_en,
                      field_key:
                        fieldDraft.id || fieldDraft.field_key
                          ? fieldDraft.field_key
                          : slugify(label_en).replace(/-/g, "_"),
                    });
                  }}
                />
              </Field>
              <Field label={tr("key", l)}>
                <Input
                  value={fieldDraft.field_key}
                  onChange={(e) =>
                    setFieldDraft({
                      ...fieldDraft,
                      field_key: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "_"),
                    })
                  }
                />
              </Field>
              <Field label={tr("type", l)}>
                <Select
                  value={fieldDraft.field_type}
                  onValueChange={(v) =>
                    setFieldDraft({
                      ...fieldDraft,
                      field_type: v as FieldType,
                      options: isChoiceField(v as FieldType)
                        ? fieldDraft.options
                        : [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABELS[t][l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {isChoiceField(fieldDraft.field_type) ? (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold">{tr("options", l)}</p>
                  {fieldDraft.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="value"
                        value={opt.value}
                        onChange={(e) =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: replaceAt(fieldDraft.options, i, {
                              ...opt,
                              value: e.target.value,
                            }),
                          })
                        }
                      />
                      <Input
                        placeholder="አማርኛ"
                        value={opt.label_am}
                        onChange={(e) =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: replaceAt(fieldDraft.options, i, {
                              ...opt,
                              label_am: e.target.value,
                            }),
                          })
                        }
                      />
                      <Input
                        placeholder="English"
                        value={opt.label_en}
                        onChange={(e) =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: replaceAt(fieldDraft.options, i, {
                              ...opt,
                              label_en: e.target.value,
                            }),
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: fieldDraft.options.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() =>
                      setFieldDraft({
                        ...fieldDraft,
                        options: [
                          ...fieldDraft.options,
                          { value: "", label_am: "", label_en: "" },
                        ],
                      })
                    }
                  >
                    {tr("addOption", l)}
                  </Button>
                </div>
              ) : null}

              <Field label={tr("helpAm", l)}>
                <Input
                  value={fieldDraft.help_am}
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, help_am: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("helpEn", l)}>
                <Input
                  value={fieldDraft.help_en}
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, help_en: e.target.value })
                  }
                />
              </Field>

              {fieldDraft.field_type === "number" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tr("min", l)}>
                    <Input
                      type="number"
                      value={fieldDraft.validation.min ?? ""}
                      onChange={(e) =>
                        setFieldDraft({
                          ...fieldDraft,
                          validation: {
                            ...fieldDraft.validation,
                            min: numOrNull(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={tr("max", l)}>
                    <Input
                      type="number"
                      value={fieldDraft.validation.max ?? ""}
                      onChange={(e) =>
                        setFieldDraft({
                          ...fieldDraft,
                          validation: {
                            ...fieldDraft.validation,
                            max: numOrNull(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}

              {["text", "textarea"].includes(fieldDraft.field_type) ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tr("minLen", l)}>
                    <Input
                      type="number"
                      value={fieldDraft.validation.min_length ?? ""}
                      onChange={(e) =>
                        setFieldDraft({
                          ...fieldDraft,
                          validation: {
                            ...fieldDraft.validation,
                            min_length: numOrNull(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={tr("maxLen", l)}>
                    <Input
                      type="number"
                      value={fieldDraft.validation.max_length ?? ""}
                      onChange={(e) =>
                        setFieldDraft({
                          ...fieldDraft,
                          validation: {
                            ...fieldDraft.validation,
                            max_length: numOrNull(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}

              <Field label={tr("errorAm", l)}>
                <Input
                  value={fieldDraft.error_am}
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, error_am: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("errorEn", l)}>
                <Input
                  value={fieldDraft.error_en}
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, error_en: e.target.value })
                  }
                />
              </Field>

              <Toggle
                label={tr("required", l)}
                checked={fieldDraft.required}
                onChange={(required) =>
                  setFieldDraft({ ...fieldDraft, required })
                }
              />
              <Toggle
                label={tr("active", l)}
                checked={fieldDraft.active}
                onChange={(active) => setFieldDraft({ ...fieldDraft, active })}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDraft(null)}>
              {tr("cancel", l)}
            </Button>
            <Button
              onClick={async () => {
                if (!fieldDraft) return;
                const ok = await run(() =>
                  doSaveField({ data: fieldDraft as never }),
                );
                if (ok) setFieldDraft(null);
              }}
            >
              {tr("save", l)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => (o ? null : setConfirm(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "module"
                ? tr("deleteModuleQ", l)
                : confirm?.kind === "form"
                  ? tr("deleteFormQ", l)
                  : confirm?.kind === "field"
                    ? tr("deleteFieldQ", l)
                    : tr("del", l)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr("deleteModuleBody", l)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("cancel", l)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm) return;
                const fn =
                  confirm.kind === "module"
                    ? doDeleteModule
                    : confirm.kind === "form"
                      ? doDeleteForm
                      : confirm.kind === "field"
                        ? doDeleteField
                        : doDeleteSubmission;
                await run(() => fn({ data: { id: confirm.id } }));
                if (confirm.kind === "module") setSelectedModuleId(null);
                setConfirm(null);
              }}
            >
              {tr("confirm", l)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function saveModuleCall(
  fn: ReturnType<typeof useServerFn<typeof saveModule>>,
  draft: ModuleDraft,
) {
  return fn({ data: draft as never });
}

function replaceAt(list: FieldOption[], index: number, value: FieldOption) {
  return list.map((item, i) => (i === index ? value : item));
}

function numOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function WorkflowRow({
  lang,
  isOwner,
  current,
  note,
  assigned,
  onUpdate,
  onDelete,
}: {
  lang: L;
  isOwner: boolean;
  current: string;
  note: string;
  assigned: string;
  onUpdate: (
    status: SubmissionStatus,
    note: string,
    assigned: string,
  ) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [status, setStatus] = useState<SubmissionStatus>(
    (SUBMISSION_STATUSES as readonly string[]).includes(current)
      ? (current as SubmissionStatus)
      : "pending",
  );
  const [noteValue, setNoteValue] = useState(note);
  const [assignedValue, setAssignedValue] = useState(assigned);

  return (
    <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
      <div className="space-y-1">
        <Label className="text-[11px]">{tr("status", lang)}</Label>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as SubmissionStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBMISSION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s][lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">{tr("assignTo", lang)}</Label>
        <Input
          value={assignedValue}
          onChange={(e) => setAssignedValue(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">{tr("note", lang)}</Label>
        <Input
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => void onUpdate(status, noteValue, assignedValue)}
        >
          {tr("update", lang)}
        </Button>
        {isOwner ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={onDelete}
          >
            🗑️
          </Button>
        ) : null}
      </div>
    </div>
  );
}
