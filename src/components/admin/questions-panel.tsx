import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listQuestionEditor,
  saveQuestionEditor,
  reorderQuestionEditor,
  deleteQuestionEditor,
  publishQuestionEditor,
} from "@/lib/question-admin.functions";
import { INPUT_TYPES, label as questionLabel, optionLabel, type InputType, type QuestionDraft, type QuestionOption, type QuestionAgeGroup } from "@/lib/question-config";
import { useUiLang } from "@/lib/ui-i18n";

const GROUPS: { value: QuestionAgeGroup; am: string; en: string }[] = [
  { value: "all", am: "ለሁሉም", en: "All" },
  { value: "7_13", am: "7–13", en: "7–13" },
  { value: "14_17", am: "14–17", en: "14–17" },
  { value: "18_plus", am: "18+", en: "18+" },
];

const TYPE_LABEL: Record<InputType, { am: string; en: string }> = {
  text: { am: "ጽሑፍ", en: "Text" },
  phone: { am: "ስልክ", en: "Phone" },
  ethiopian_date: { am: "የኢትዮጵያ ቀን", en: "Ethiopian date" },
  ethiopian_year: { am: "የኢትዮጵያ ዓመት", en: "Ethiopian year" },
  options: { am: "አማራጮች", en: "Options" },
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
  age_groups: ["all"],
  age_group: "all",
});

function numberOrNull(value: string) {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) ? n : null;
}

function normalizeAgeGroups(q: QuestionDraft): QuestionAgeGroup[] {
  if (q.age_groups?.length) return q.age_groups;
  return [q.age_group ?? "all"];
}

function ageGroupLabel(groups: QuestionAgeGroup[], en: boolean) {
  return groups
    .map((value) => GROUPS.find((g) => g.value === value)?.[en ? "en" : "am"] ?? value)
    .join(", ");
}

export function QuestionsPanel({ isOwner }: { isOwner: boolean }) {
  const { lang } = useUiLang();
  const en = lang === "en";
  const qc = useQueryClient();
  const load = useServerFn(listQuestionEditor);
  const saveFn = useServerFn(saveQuestionEditor);
  const reorderFn = useServerFn(reorderQuestionEditor);
  const deleteFn = useServerFn(deleteQuestionEditor);
  const publishFn = useServerFn(publishQuestionEditor);

  const query = useQuery({
    queryKey: ["question-editor"],
    queryFn: () => load({}),
    enabled: isOwner,
  });
  const questions = useMemo(() => (query.data?.draft ?? []) as QuestionDraft[], [query.data]);
  const [editing, setEditing] = useState<QuestionDraft | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<"am" | "en">("am");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOwner) return null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["question-editor"] });

  const save = async () => {
    if (!editing) return;
    if (!editing.field_key.trim() || !editing.label_am.trim()) {
      toast.error(en ? "Field key and Amharic question are required." : "የመስክ ቁልፍና የአማርኛ ጥያቄ ያስፈልጋሉ።");
      return;
    }
    setBusy(true);
    try {
      const ageGroups = editing.age_groups?.length
        ? editing.age_groups
        : [editing.age_group ?? "all"];
      await saveFn({
        data: {
          ...editing,
          field_key: editing.field_key.trim(),
          age_groups: ageGroups,
          age_group: ageGroups.length === 1 ? ageGroups[0] : "all",
        },
      });
      toast.success(en ? "Draft saved." : "ረቂቁ ተቀምጧል።");
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (en ? "Could not save." : "ማስቀመጥ አልተቻለም።"));
    } finally { setBusy(false); }
  };

  const drop = async (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) return;
    const next = questions.slice();
    const [moved] = next.splice(dragIndex, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    setBusy(true);
    try {
      await reorderFn({ data: { ids: next.map(q => q.id) } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (en ? "Could not reorder." : "ቅደም ተከተሉን መቀየር አልተቻለም።"));
    } finally { setBusy(false); }
  };

  const removeQuestion = async (q: QuestionDraft) => {
    if (!q.id || q.is_core) return;
    const confirmed = window.confirm(en ? `Delete “${q.label_en || q.field_key}” from the draft? Existing registrations will keep their historical version.` : `ይህን ጥያቄ ከረቂቁ ላይ ማጥፋት ይፈልጋሉ? ያሉ ምዝገባዎች የቀድሞ ቅጂያቸውን ይጠብቃሉ።`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: q.id } });
      toast.success(en ? "Question deleted from draft." : "ጥያቄው ከረቂቁ ተሰርዟል።");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (en ? "Could not delete question." : "ጥያቄውን መሰረዝ አልተቻለም።"));
    } finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true);
    try {
      const result = await publishFn({});
      toast.success(en ? `Version ${result.version} published.` : `ቅጂ ${result.version} ታትሟል።`);
      setPublishOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (en ? "Could not publish." : "ማተም አልተቻለም።"));
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-accent/40 bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{en ? "📝 Edit Registration Questions" : "📝 የምዝገባ ጥያቄዎችን አስተካክል"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {en ? "Changes stay as Draft until you Publish. Existing registrations keep their historical version." : "ለውጦች እስኪታተሙ ድረስ እንደ ረቂቅ ይቀመጣሉ። ያሉ ምዝገባዎች የቀድሞ ቅጂያቸውን ይጠብቃሉ።"}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {en ? `Published version: ${query.data?.publishedVersion ?? 0}` : `የታተመ ቅጂ: ${query.data?.publishedVersion ?? 0}`}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
        {en ? "Drag a question directly to its new position. Choose one or more age groups for the question." : "ጥያቄውን በቀጥታ ወደ ፈለጉት ቦታ ይጎትቱ። ጥያቄው ለማን እንደሚታይ አንድ ወይም ብዙ የዕድሜ ቡድን ይምረጡ።"}
      </div>

      <ul className="space-y-2">
        {questions.map((q, index) => (
          <li
            key={q.id}
            draggable={!busy}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void drop(index)}
            className={`rounded-xl border p-3 transition ${dragIndex === index ? "opacity-50" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="cursor-grab text-lg" title={en ? "Drag" : "ይጎትቱ"}>☷</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{questionLabel(q, en ? "en" : "am").split("\n")[0]}</div>
                <div className="text-xs text-muted-foreground">
                  {q.field_key} · {ageGroupLabel(normalizeAgeGroups(q), en)} · {TYPE_LABEL[q.input_type as InputType]?.[en ? "en" : "am"] ?? q.input_type}
                  {q.required ? ` · ${en ? "Required" : "አስፈላጊ"}` : ` · ${en ? "Optional" : "አማራጭ"}`}
                  {!q.active ? ` · ${en ? "Inactive" : "የተዘጋ"}` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...q, age_groups: normalizeAgeGroups(q), age_group: q.age_group ?? "all" })}>{en ? "Edit" : "አስተካክል"}</Button>
              {!q.is_core && <Button size="sm" variant="destructive" disabled={busy} onClick={() => void removeQuestion(q)}>{en ? "Delete" : "ሰርዝ"}</Button>}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(emptyDraft(questions.length + 1))}>{en ? "➕ Add question" : "➕ ጥያቄ ጨምር"}</Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>{en ? "👁️ Preview" : "👁️ ቅድመ ዕይታ"}</Button>
        <Button disabled={busy} onClick={() => setPublishOpen(true)}>{en ? "🚀 Publish" : "🚀 አሳትም"}</Button>
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? (en ? "Edit question" : "ጥያቄ አስተካክል") : (en ? "Add question" : "አዲስ ጥያቄ")}</DialogTitle>
            <DialogDescription>{en ? "Configure who receives this question and how the answer is validated." : "ጥያቄው ለማን እንደሚታይና መልሱ እንዴት እንደሚፈተሽ ያዘጋጁ።"}</DialogDescription>
          </DialogHeader>
          {editing && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Field key</Label><Input value={editing.field_key} disabled={editing.is_core} onChange={e => setEditing({ ...editing, field_key: e.target.value })} /></div>
              <div>
  <Label>{en ? "Age groups" : "የዕድሜ ቡድኖች"}</Label>
  <div className="mt-2 grid grid-cols-2 gap-2">
    {GROUPS.map(g => {
      const selected = normalizeAgeGroups(editing).includes(g.value);
      return (
        <Button
          key={g.value}
          type="button"
          size="sm"
          variant={selected ? "default" : "outline"}
          onClick={() => {
            const current = normalizeAgeGroups(editing);
            const next = g.value === "all"
              ? ["all" as QuestionAgeGroup]
              : Array.from(new Set([
                  ...current.filter(v => v !== "all"),
                  ...(selected ? [] : [g.value]),
                ]));
            if (!next.length) return;
            setEditing({ ...editing, age_groups: next, age_group: next.length === 1 ? next[0] : "all" });
          }}
        >
          {selected ? "✓ " : ""}{en ? g.en : g.am}
        </Button>
      );
    })}
  </div>
  <p className="mt-1 text-xs text-muted-foreground">
    {en ? "Select All, or select any combination of specific age groups." : "ሁሉንም ይምረጡ ወይም የተወሰኑ የዕድሜ ቡድኖችን በጥምረት ይምረጡ።"}
  </p>
</div>
            </div>
            <div><Label>{en ? "Question (Amharic)" : "ጥያቄ (አማርኛ)"}</Label><Textarea rows={3} value={editing.label_am} onChange={e => setEditing({ ...editing, label_am: e.target.value })} /></div>
            <div><Label>Question (English)</Label><Textarea rows={3} value={editing.label_en} onChange={e => setEditing({ ...editing, label_en: e.target.value })} /></div>
            <div><Label>{en ? "Input type" : "የመልስ ዓይነት"}</Label><Select value={editing.input_type} onValueChange={v => setEditing({ ...editing, input_type: v as InputType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABEL[t][en ? "en" : "am"]}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.required} onCheckedChange={v => setEditing({ ...editing, required: v })} />{en ? "Required" : "አስፈላጊ"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!editing.required} onCheckedChange={v => setEditing({ ...editing, required: !v })} />{en ? "Optional" : "አማራጭ"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_core} onCheckedChange={v => setEditing({ ...editing, is_core: v })} />{en ? "Core" : "ዋና"}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />{en ? "Active" : "ንቁ"}</label>
            </div>
            {editing.input_type === "text" && <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Min words</Label><Input type="number" min={1} value={editing.min_words ?? ""} onChange={e => setEditing({ ...editing, min_words: numberOrNull(e.target.value) })} /></div>
              <div><Label>Max words</Label><Input type="number" min={1} value={editing.max_words ?? ""} onChange={e => setEditing({ ...editing, max_words: numberOrNull(e.target.value) })} /></div>
              <div><Label>Exact words</Label><Input type="number" min={1} value={editing.exact_words ?? ""} onChange={e => setEditing({ ...editing, exact_words: numberOrNull(e.target.value) })} /></div>
            </div>}
            {editing.input_type === "options" && <div className="space-y-2"><Label>{en ? "Options" : "አማራጮች"}</Label>{editing.options.map((o, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><Input placeholder="Value" value={o.value} onChange={e => { const a = editing.options.slice(); a[i] = { ...o, value: e.target.value }; setEditing({ ...editing, options: a }); }} /><Input placeholder="አማርኛ" value={o.label_am} onChange={e => { const a = editing.options.slice(); a[i] = { ...o, label_am: e.target.value }; setEditing({ ...editing, options: a }); }} /><Input placeholder="English" value={o.label_en} onChange={e => { const a = editing.options.slice(); a[i] = { ...o, label_en: e.target.value }; setEditing({ ...editing, options: a }); }} /><Button variant="ghost" onClick={() => setEditing({ ...editing, options: editing.options.filter((_, j) => j !== i) })}>🗑️</Button></div>)}<Button variant="outline" onClick={() => setEditing({ ...editing, options: [...editing.options, { value: "", label_am: "", label_en: "" } as QuestionOption] })}>{en ? "Add option" : "አማራጭ ጨምር"}</Button></div>}
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Error (Amharic)</Label><Textarea value={editing.error_am} onChange={e => setEditing({ ...editing, error_am: e.target.value })} /></div><div><Label>Error (English)</Label><Textarea value={editing.error_en} onChange={e => setEditing({ ...editing, error_en: e.target.value })} /></div></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>{en ? "Cancel" : "ተወው"}</Button><Button disabled={busy} onClick={() => void save()}>{en ? "💾 Save Draft" : "💾 ረቂቅ አስቀምጥ"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{en ? "Publish changes?" : "ለውጦቹን ማተም?"}</DialogTitle><DialogDescription>{en ? "New registrations will use this version. Existing registrations keep their original version." : "አዲስ ምዝገባዎች ይህን ቅጂ ይጠቀማሉ። ያሉ ምዝገባዎች የቀድሞ ቅጂያቸውን ይጠብቃሉ።"}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setPublishOpen(false)}>{en ? "Cancel" : "ተወው"}</Button><Button disabled={busy} onClick={() => void publish()}>{en ? "Publish" : "አሳትም"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{en ? "Registration preview" : "የምዝገባ ቅድመ ዕይታ"}</DialogTitle></DialogHeader><div className="flex gap-2"><Button size="sm" variant={previewLang === "am" ? "default" : "outline"} onClick={() => setPreviewLang("am")}>🇪🇹 አማርኛ</Button><Button size="sm" variant={previewLang === "en" ? "default" : "outline"} onClick={() => setPreviewLang("en")}>🇬🇧 English</Button></div><ol className="space-y-2">{questions.filter(q => q.active).map((q, i) => <li key={q.id} className="rounded-xl border p-3"><div className="text-xs text-primary">{i + 1}. {ageGroupLabel(normalizeAgeGroups(q), previewLang === "en")}</div><div className="mt-1 text-sm">{questionLabel(q, previewLang)}</div>{q.input_type === "options" && <div className="mt-2 flex flex-wrap gap-2">{q.options.map((o, j) => <span key={j} className="rounded-full border px-3 py-1 text-xs">{optionLabel(o, previewLang)}</span>)}</div>}</li>)}</ol></DialogContent></Dialog>
    </section>
  );
}
