/**
 * Owner-only "📝 Edit Questions" panel.
 * Edits the DRAFT question list; the Telegram bot only changes after the owner
 * presses 🚀 Publish. All data access goes through `@/lib/admin.functions`.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteQuestion,
  listQuestionConfig,
  publishQuestions,
  reorderQuestions,
  saveQuestion,
} from "@/lib/admin.functions";
import {
  INPUT_TYPES,
  label as questionLabel,
  optionLabel,
  type InputType,
  type QuestionDraft,
  type QuestionOption,
} from "@/lib/question-config";
import { useUiLang } from "@/lib/ui-i18n";

const COPY = {
  am: {
    section: "📝 ጥያቄዎችን አስተካክል",
    desc: "የምዝገባ ጥያቄዎችን ያስተካክሉ። ለውጦቹ ቴሌግራም ላይ የሚሠሩት «አሳትም» ከተጫነ በኋላ ነው።",
    add: "➕ አዲስ ጥያቄ",
    edit: "✏️ አስተካክል",
    up: "⬆️",
    down: "⬇️",
    del: "🗑️",
    saveDraft: "💾 ረቂቅ አስቀምጥ",
    preview: "👁️ ቅድመ ዕይታ",
    publish: "🚀 ለውጦችን አሳትም",
    published: (v: number) => `የታተመ ቅጂ: ${v}`,
    unpublished: "ያልታተሙ ለውጦች አሉ",
    inSync: "ቴሌግራም ከረቂቁ ጋር ተመሳስሏል",
    key: "የመስክ ቁልፍ (field key)",
    order: "ቅደም ተከተል",
    labelAm: "ጥያቄ (አማርኛ)",
    labelEn: "ጥያቄ (English)",
    type: "የግብዓት ዓይነት",
    required: "አስፈላጊ",
    amharicOnly: "አማርኛ ብቻ",
    minWords: "ዝቅተኛ ቃላት",
    maxWords: "ከፍተኛ ቃላት",
    exactWords: "ትክክለኛ የቃላት ቁጥር",
    errorAm: "የስህተት መልእክት (አማርኛ)",
    errorEn: "የስህተት መልእክት (English)",
    options: "አማራጭ አዝራሮች",
    optionValue: "የሚቀመጥ ዋጋ",
    addOption: "አማራጭ ጨምር",
    active: "አገልግሎት ላይ",
    save: "አስቀምጥ",
    cancel: "ተወው",
    saved: "ተቀምጧል",
    failed: "አልተሳካም",
    deleted: "ተሰርዟል",
    confirmDelete: "ጥያቄውን መሰረዝ ይፈልጋሉ?",
    confirmDeleteDesc: "የተመዘገቡ መረጃዎች አይነኩም። እርግጠኛ ነዎት?",
    confirmPublish: "ለውጦቹን ማሳተም?",
    confirmPublishDesc:
      "ከዚህ በኋላ አዲስ ምዝገባዎች የታተመውን ጥያቄ ይጠቀማሉ። የነበሩ ምዝገባዎች አይለወጡም።",
    previewTitle: "የምዝገባ ቅድመ ዕይታ",
    inactive: "አልነቃም",
    publishedOk: (v: number) => `ቅጂ ${v} ታትሟል`,
    empty: "ጥያቄ አልተጨመረም",
  },
  en: {
    section: "📝 Edit Questions",
    desc: "Edit the registration questions. Telegram only changes after you press Publish.",
    add: "➕ Add question",
    edit: "✏️ Edit",
    up: "⬆️",
    down: "⬇️",
    del: "🗑️",
    saveDraft: "💾 Save draft",
    preview: "👁️ Preview",
    publish: "🚀 Publish changes",
    published: (v: number) => `Published version: ${v}`,
    unpublished: "Unpublished changes",
    inSync: "Telegram matches the draft",
    key: "Field key",
    order: "Order",
    labelAm: "Question (Amharic)",
    labelEn: "Question (English)",
    type: "Input type",
    required: "Required",
    amharicOnly: "Amharic only",
    minWords: "Minimum words",
    maxWords: "Maximum words",
    exactWords: "Exact word count",
    errorAm: "Error message (Amharic)",
    errorEn: "Error message (English)",
    options: "Button options",
    optionValue: "Stored value",
    addOption: "Add option",
    active: "Active",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved",
    failed: "Something went wrong",
    deleted: "Deleted",
    confirmDelete: "Delete this question?",
    confirmDeleteDesc:
      "Existing registrations are never changed. Are you sure?",
    confirmPublish: "Publish these changes?",
    confirmPublishDesc:
      "New registrations will use the published questions. Existing registrations stay unchanged.",
    previewTitle: "Registration preview",
    inactive: "Inactive",
    publishedOk: (v: number) => `Version ${v} published`,
    empty: "No questions yet",
  },
} as const;

const TYPE_LABEL: Record<InputType, { am: string; en: string }> = {
  text: { am: "ጽሑፍ", en: "Text" },
  phone: { am: "ስልክ ቁጥር", en: "Phone number" },
  ethiopian_date: { am: "የኢት. ቀን (ቀን/ወር/ዓመት)", en: "Ethiopian date" },
  ethiopian_year: { am: "የኢት. ዘመን", en: "Ethiopian year" },
  options: { am: "አዝራሮች", en: "Buttons / options" },
};

const emptyDraft = (position: number): QuestionDraft => ({
  id: "",
  field_key: "",
  position,
  label_am: "",
  label_en: "",
  input_type: "text",
  required: true,
  amharic_only: false,
  min_words: null,
  max_words: null,
  exact_words: null,
  error_am: "",
  error_en: "",
  options: [],
  is_core: false,
  active: true,
});

function num(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function QuestionsPanel({ isOwner }: { isOwner: boolean }) {
  const { lang } = useUiLang();
  const c = COPY[lang === "en" ? "en" : "am"];
  const queryClient = useQueryClient();

  const fetchConfig = useServerFn(listQuestionConfig);
  const doSave = useServerFn(saveQuestion);
  const doDelete = useServerFn(deleteQuestion);
  const doReorder = useServerFn(reorderQuestions);
  const doPublish = useServerFn(publishQuestions);

  const configQuery = useQuery({
    queryKey: ["question-config"],
    queryFn: () => fetchConfig({}),
    enabled: isOwner,
  });

  const draftList = useMemo(
    () => ((configQuery.data?.draft ?? []) as QuestionDraft[]).slice(),
    [configQuery.data],
  );
  const publishedVersion = configQuery.data?.published?.version ?? 0;
  const publishedJson = JSON.stringify(
    (configQuery.data?.published?.questions ?? []) as unknown[],
  );
  const draftJson = JSON.stringify(
    draftList
      .filter((q) => q.active)
      .map(({ id: _id, ...rest }) => rest),
  );
  const dirty = publishedJson !== draftJson;

  const [editing, setEditing] = useState<QuestionDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionDraft | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<"am" | "en">("am");
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["question-config"] });

  if (!isOwner) return null;

  const move = async (index: number, delta: number) => {
    const next = draftList.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    setBusy(true);
    try {
      await doReorder({ data: { ids: next.map((q) => q.id) } });
      await refresh();
    } catch {
      toast.error(c.failed);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await doSave({
        data: {
          ...(editing.id ? { id: editing.id } : {}),
          field_key: editing.field_key.trim(),
          position: editing.position,
          label_am: editing.label_am,
          label_en: editing.label_en,
          input_type: editing.input_type,
          required: editing.required,
          amharic_only: editing.amharic_only,
          min_words: editing.min_words,
          max_words: editing.max_words,
          exact_words: editing.exact_words,
          error_am: editing.error_am,
          error_en: editing.error_en,
          options: editing.options,
          active: editing.active,
        },
      });
      toast.success(c.saved);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-accent/40 bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            {c.section}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{c.desc}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{c.published(publishedVersion)}</div>
          <div className={dirty ? "font-semibold text-primary" : ""}>
            {dirty ? c.unpublished : c.inSync}
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {draftList.map((q, index) => (
          <li
            key={q.id}
            className="rounded-xl border border-border bg-background/60 p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{TYPE_LABEL[q.input_type][lang === "en" ? "en" : "am"]}</span>
                  {!q.active && <span className="text-destructive">{c.inactive}</span>}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-card-foreground">
                  {questionLabel(q, lang === "en" ? "en" : "am").split("\n")[0]}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {q.field_key}
                  {q.exact_words ? ` · =${q.exact_words}` : ""}
                  {q.amharic_only ? " · አማርኛ" : ""}
                  {q.options.length
                    ? ` · ${q.options.map((o) => optionLabel(o, lang === "en" ? "en" : "am")).join(" / ")}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...q })}>
                  {c.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  {c.up}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === draftList.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  {c.down}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(q)}
                  aria-label="Delete"
                >
                  {c.del}
                </Button>
              </div>
            </div>
          </li>
        ))}
        {!draftList.length && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {c.empty}
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setEditing(emptyDraft(draftList.length + 1))}
        >
          {c.add}
        </Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          {c.preview}
        </Button>
        <Button onClick={() => setPublishOpen(true)} disabled={busy}>
          {c.publish}
        </Button>
      </div>

      {/* Edit / add dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? c.edit : c.add}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{c.key}</Label>
                  <Input
                    value={editing.field_key}
                    disabled={editing.is_core}
                    onChange={(e) =>
                      setEditing({ ...editing, field_key: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{c.order}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.position}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        position: Number(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>{c.labelAm}</Label>
                <Textarea
                  rows={3}
                  value={editing.label_am}
                  onChange={(e) =>
                    setEditing({ ...editing, label_am: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{c.labelEn}</Label>
                <Textarea
                  rows={3}
                  value={editing.label_en}
                  onChange={(e) =>
                    setEditing({ ...editing, label_en: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>{c.type}</Label>
                <Select
                  value={editing.input_type}
                  onValueChange={(v) =>
                    setEditing({ ...editing, input_type: v as InputType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INPUT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t][lang === "en" ? "en" : "am"]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.required}
                    onCheckedChange={(v) =>
                      setEditing({ ...editing, required: v })
                    }
                  />
                  {c.required}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.amharic_only}
                    onCheckedChange={(v) =>
                      setEditing({ ...editing, amharic_only: v })
                    }
                  />
                  {c.amharicOnly}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.active}
                    onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                  />
                  {c.active}
                </label>
              </div>

              {editing.input_type === "text" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{c.minWords}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editing.min_words ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, min_words: num(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>{c.maxWords}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editing.max_words ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, max_words: num(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>{c.exactWords}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editing.exact_words ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          exact_words: num(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {editing.input_type === "options" && (
                <div className="space-y-2">
                  <Label>{c.options}</Label>
                  {editing.options.map((o, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <Input
                        placeholder={c.optionValue}
                        value={o.value}
                        onChange={(e) => {
                          const next = editing.options.slice();
                          next[i] = { ...o, value: e.target.value };
                          setEditing({ ...editing, options: next });
                        }}
                      />
                      <Input
                        placeholder="አማርኛ"
                        value={o.label_am}
                        onChange={(e) => {
                          const next = editing.options.slice();
                          next[i] = { ...o, label_am: e.target.value };
                          setEditing({ ...editing, options: next });
                        }}
                      />
                      <Input
                        placeholder="English"
                        value={o.label_en}
                        onChange={(e) => {
                          const next = editing.options.slice();
                          next[i] = { ...o, label_en: e.target.value };
                          setEditing({ ...editing, options: next });
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            options: editing.options.filter((_, j) => j !== i),
                          })
                        }
                      >
                        🗑️
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        options: [
                          ...editing.options,
                          { value: "", label_am: "", label_en: "" } as QuestionOption,
                        ],
                      })
                    }
                  >
                    {c.addOption}
                  </Button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{c.errorAm}</Label>
                  <Textarea
                    rows={2}
                    value={editing.error_am}
                    onChange={(e) =>
                      setEditing({ ...editing, error_am: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{c.errorEn}</Label>
                  <Textarea
                    rows={2}
                    value={editing.error_en}
                    onChange={(e) =>
                      setEditing({ ...editing, error_en: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {c.cancel}
            </Button>
            <Button onClick={save} disabled={busy}>
              {c.saveDraft}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.confirmDelete}</DialogTitle>
            <DialogDescription>{c.confirmDeleteDesc}</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {deleteTarget
              ? questionLabel(deleteTarget, lang === "en" ? "en" : "am").split("\n")[0]
              : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {c.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!deleteTarget) return;
                setBusy(true);
                try {
                  await doDelete({ data: { id: deleteTarget.id } });
                  toast.success(c.deleted);
                  setDeleteTarget(null);
                  await refresh();
                } catch {
                  toast.error(c.failed);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {c.del} {c.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish confirmation */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.confirmPublish}</DialogTitle>
            <DialogDescription>{c.confirmPublishDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              {c.cancel}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await doPublish({});
                  toast.success(c.publishedOk(res.version));
                  setPublishOpen(false);
                  await refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : c.failed);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {c.publish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview of the whole flow, in both languages */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{c.previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={previewLang === "am" ? "default" : "outline"}
              onClick={() => setPreviewLang("am")}
            >
              🇪🇹 አማርኛ
            </Button>
            <Button
              size="sm"
              variant={previewLang === "en" ? "default" : "outline"}
              onClick={() => setPreviewLang("en")}
            >
              🇬🇧 English
            </Button>
          </div>
          <ol className="space-y-3">
            {draftList
              .filter((q) => q.active)
              .map((q, i) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-border bg-background/60 p-3"
                >
                  <div className="text-xs font-semibold text-primary">
                    {previewLang === "en" ? "Question" : "ጥያቄ"} {i + 1}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-card-foreground">
                    {questionLabel(q, previewLang)}
                  </p>
                  {q.input_type === "options" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.options.map((o, j) => (
                        <span
                          key={j}
                          className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs"
                        >
                          {optionLabel(o, previewLang)}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
          </ol>
        </DialogContent>
      </Dialog>
    </section>
  );
}
