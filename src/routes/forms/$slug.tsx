import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LanguageToggle } from "@/components/language-toggle";
import logoAsset from "@/assets/sunday-school-logo.jpg.asset.json";
import { useUiLang } from "@/lib/ui-i18n";
import {
  fieldLabel,
  pick,
  validateAnswer,
  type FormFieldConfig,
} from "@/lib/module-forms";
import { getPublicForm, submitPublicForm } from "@/lib/modules.functions";

export const Route = createFileRoute("/forms/$slug")({
  head: () => ({
    meta: [
      { title: "ቅጽ ሙላ | Fill in a Sunday School form" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ክፍል ቅጽ በአማርኛ ወይም በእንግሊዝኛ ይሙሉ — Fill in a Sunday School department form online.",
      },
      { property: "og:title", content: "ቅጽ ሙላ | Fill in a Sunday School form" },
      {
        property: "og:description",
        content: "የሰንበት ት/ቤት ክፍል ቅጽ በአማርኛ ወይም በእንግሊዝኛ ይሙሉ።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicFormPage,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">
        ቅጹን መጫን አልተቻለም። / Could not load this form.
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">አልተገኘም / Not found</p>
    </main>
  ),
});

function PublicFormPage() {
  const { slug } = Route.useParams();
  const { lang } = useUiLang();
  const am = lang === "am";
  const fetchForm = useServerFn(getPublicForm);
  const doSubmit = useServerFn(submitPublicForm);

  const query = useQuery({
    queryKey: ["public-form", slug],
    queryFn: () => fetchForm({ data: { slug } }),
  });

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [regId, setRegId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const set = (key: string, value: unknown) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          {am ? "በመጫን ላይ…" : "Loading…"}
        </p>
      </main>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {am
            ? "ይህ ቅጽ አሁን ክፍት አይደለም።"
            : "This form is not open right now."}
        </p>
        <Link to="/forms" className="text-sm font-semibold text-primary">
          {am ? "ወደ ቅጾች ተመለስ" : "Back to forms"}
        </Link>
      </main>
    );
  }

  const { form, module: mod, fields } = data;
  const title = pick(form.title_am, form.title_en, lang);
  const description = pick(form.description_am, form.description_en, lang);

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="text-4xl">✅</p>
          <h1 className="text-xl font-semibold text-card-foreground">
            {am ? "ተልኳል!" : "Sent!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {am ? "የመከታተያ ቁጥርዎ" : "Your reference number"}
          </p>
          <p className="text-2xl font-bold text-primary">{done}</p>
          <Link to="/forms" className="block text-sm font-semibold text-primary">
            {am ? "ወደ ቅጾች ተመለስ" : "Back to forms"}
          </Link>
        </div>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const err = validateAnswer(field, answers[field.field_key], lang);
      if (err) nextErrors[field.field_key] = err;
    }
    if (form.requires_student_id && !regId.trim()) {
      nextErrors["__reg"] = am
        ? "የተማሪ መለያ (FKN) ያስገቡ።"
        : "Enter your student ID (FKN).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const res = await doSubmit({
        data: { slug, registrationId: regId.trim(), lang, answers },
      });
      setDone(res.code);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : am
            ? "መላክ አልተቻለም።"
            : "Could not send.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="brand-gradient text-primary-foreground">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="flex justify-end">
            <LanguageToggle />
          </div>
          <img
            src={logoAsset.url}
            alt={am ? "ሰንበት ት/ቤት" : "Sunday School"}
            className="mt-4 h-16 w-16 rounded-full border-2 border-accent/70 bg-background object-cover shadow-md"
          />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
            {mod.icon} {pick(mod.name_am, mod.name_en, lang)}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm opacity-90">{description}</p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl space-y-5 px-6 py-10"
      >
        {form.requires_student_id ? (
          <div className="space-y-1">
            <Label htmlFor="__reg">
              {am ? "የተማሪ መለያ (FKN)" : "Student ID (FKN)"}
              <span className="text-destructive"> *</span>
            </Label>
            <Input
              id="__reg"
              value={regId}
              onChange={(e) => setRegId(e.target.value)}
              placeholder="FKN-000123"
            />
            {errors["__reg"] ? (
              <p className="text-xs text-destructive">{errors["__reg"]}</p>
            ) : null}
          </div>
        ) : null}

        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            lang={lang}
            value={answers[field.field_key]}
            error={errors[field.field_key]}
            onChange={(v) => set(field.field_key, v)}
          />
        ))}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (am ? "በመላክ ላይ…" : "Sending…") : am ? "ላክ" : "Submit"}
        </Button>
      </form>
    </main>
  );
}

function FieldInput({
  field,
  lang,
  value,
  error,
  onChange,
}: {
  field: FormFieldConfig;
  lang: "am" | "en";
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const label = fieldLabel(field, lang);
  const help = pick(field.help_am, field.help_en, lang);
  const id = `f-${field.id}`;
  const str = typeof value === "string" ? value : "";
  const selected = Array.isArray(value) ? (value as string[]) : [];

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}

      {field.field_type === "textarea" ? (
        <Textarea
          id={id}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.field_type === "boolean" ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id={id}
            checked={value === true}
            onCheckedChange={(c) => onChange(c)}
          />
          <span className="text-sm text-muted-foreground">
            {lang === "am" ? "አዎ" : "Yes"}
          </span>
        </div>
      ) : field.field_type === "select" ||
        field.field_type === "single_choice" ? (
        <div className="space-y-2 pt-1">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={id}
                checked={str === opt.value}
                onChange={() => onChange(opt.value)}
              />
              {pick(opt.label_am, opt.label_en, lang) || opt.value}
            </label>
          ))}
        </div>
      ) : field.field_type === "multi_choice" ? (
        <div className="space-y-2 pt-1">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value),
                  )
                }
              />
              {pick(opt.label_am, opt.label_en, lang) || opt.value}
            </label>
          ))}
        </div>
      ) : (
        <Input
          id={id}
          type={
            field.field_type === "number"
              ? "number"
              : field.field_type === "date"
                ? "date"
                : field.field_type === "file"
                  ? "text"
                  : "text"
          }
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
