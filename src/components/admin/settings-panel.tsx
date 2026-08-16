/**
 * Owner-only settings: Telegram admin list + editable Help & Information.
 * Self-contained so the admin area can be dropped into another site:
 * it only needs the server functions in `@/lib/admin.functions`.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiLang } from "@/lib/ui-i18n";
import {
  addDashboardAdmin,
  listBotAdmins,
  listDashboardAdmins,
  listHelpContent,
  removeBotAdmin,
  removeDashboardAdmin,
  resetHelpContent,
  saveBotAdmin,
  saveHelpContent,
  OWNER_EMAIL,
  type HelpRow,
} from "@/lib/admin.functions";

type HelpDraft = HelpRow;

const emptyHelp = (lang: "am" | "en"): HelpDraft => ({
  lang,
  title: "",
  body: "",
  instructions: "",
  contacts: "",
  announcements: "",
  buttons: [],
});

const OWNER_COPY = {
  am: {
    section: "⚙️ የባለቤት ቅንብሮች",
    owner: "ባለቤት (Owner)",
    accounts: "የዳሽቦርድ አስተዳዳሪዎች",
    accountsDesc:
      "የመግቢያ ፈቃድ ያላቸው መለያዎች። ባለቤት ብቻ መጨመር/ማስወገድ ይችላል።",
    email: "ኢሜይል",
    role: "ሚና",
    admin: "አስተዳዳሪ",
    ownerRole: "ባለቤት",
    add: "አስተዳዳሪ ጨምር",
    remove: "አስወግድ",
    added: "ተጨምሯል",
    invited: "ግብዣ ተልኳል",
    removed: "ተወግዷል",
    failed: "አልተሳካም",
    empty: "እስካሁን አስተዳዳሪ አልተጨመረም",
    protected: "የባለቤት መለያ",
  },
  en: {
    section: "⚙️ Owner Settings",
    owner: "Owner",
    accounts: "Dashboard administrators",
    accountsDesc:
      "Accounts allowed to sign in to /admin. Only the owner can add or remove them.",
    email: "Email",
    role: "Role",
    admin: "Admin",
    ownerRole: "Owner",
    add: "Add administrator",
    remove: "Remove",
    added: "Access granted",
    invited: "Invitation sent",
    removed: "Access removed",
    failed: "Something went wrong",
    empty: "No administrators yet",
    protected: "Owner account",
  },
} as const;

export function AdminSettingsPanel({
  isOwner,
  currentEmail,
}: {
  isOwner: boolean;
  currentEmail?: string;
}) {
  const { lang, t } = useUiLang();
  const tt = t.admin;
  const o = OWNER_COPY[lang === "en" ? "en" : "am"];
  const queryClient = useQueryClient();

  const fetchAdmins = useServerFn(listBotAdmins);
  const fetchHelp = useServerFn(listHelpContent);
  const doSaveAdmin = useServerFn(saveBotAdmin);
  const doRemoveAdmin = useServerFn(removeBotAdmin);
  const doSaveHelp = useServerFn(saveHelpContent);
  const doResetHelp = useServerFn(resetHelpContent);
  const fetchAccounts = useServerFn(listDashboardAdmins);
  const doAddAccount = useServerFn(addDashboardAdmin);
  const doRemoveAccount = useServerFn(removeDashboardAdmin);

  const adminsQuery = useQuery({
    queryKey: ["bot-admins"],
    queryFn: () => fetchAdmins({}),
    enabled: isOwner,
  });
  const helpQuery = useQuery({
    queryKey: ["help-content"],
    queryFn: () => fetchHelp({}),
    enabled: isOwner,
  });
  const accountsQuery = useQuery({
    queryKey: ["dashboard-admins"],
    queryFn: () => fetchAccounts({}),
    enabled: isOwner,
  });

  const [helpLang, setHelpLang] = useState<"am" | "en">("am");
  const [draft, setDraft] = useState<HelpDraft>(emptyHelp("am"));
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const row = (helpQuery.data ?? []).find((r) => r.lang === helpLang);
    setDraft(row ? { ...row, buttons: row.buttons ?? [] } : emptyHelp(helpLang));
  }, [helpQuery.data, helpLang]);

  const previewText = [
    draft.title,
    draft.body,
    draft.instructions,
    draft.contacts,
    draft.announcements,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        {tt.ownerOnly}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Owner settings: dashboard accounts */}
      <section className="space-y-4 rounded-2xl border border-accent/40 bg-card p-6 shadow-sm lg:col-span-2">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            {o.section}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {o.owner}:{" "}
            <span className="font-medium text-foreground">
              {currentEmail && currentEmail !== OWNER_EMAIL
                ? currentEmail
                : OWNER_EMAIL}
            </span>
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {o.accounts}
            </h3>
            <p className="text-xs text-muted-foreground">{o.accountsDesc}</p>
          </div>

          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              try {
                const res = await doAddAccount({
                  data: {
                    email: String(fd.get("account_email") ?? ""),
                    role: String(fd.get("account_role") ?? "admin") as "admin",
                  },
                });
                toast.success(res.invited ? o.invited : o.added);
                form.reset();
                await queryClient.invalidateQueries({
                  queryKey: ["dashboard-admins"],
                });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : o.failed);
              }
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="account_email">{o.email}</Label>
              <Input
                id="account_email"
                name="account_email"
                type="email"
                required
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account_role">{o.role}</Label>
              <select
                id="account_role"
                name="account_role"
                defaultValue="admin"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="admin">{o.admin}</option>
                <option value="owner">{o.ownerRole}</option>
              </select>
            </div>
            <Button type="submit" className="self-end">
              {o.add}
            </Button>
          </form>

          <ul className="space-y-2">
            {(accountsQuery.data ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">{o.empty}</li>
            ) : (
              (accountsQuery.data ?? []).map((a) => (
                <li
                  key={a.user_id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {a.email || a.user_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.role === "owner" ? o.ownerRole : o.admin}
                      {a.isOwnerAccount ? ` · ${o.protected}` : ""}
                    </span>
                  </span>
                  {a.isOwnerAccount ? null : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await doRemoveAccount({
                            data: { user_id: a.user_id },
                          });
                          toast.success(o.removed);
                          await queryClient.invalidateQueries({
                            queryKey: ["dashboard-admins"],
                          });
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : o.failed,
                          );
                        }
                      }}
                    >
                      {o.remove}
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>


      {/* Telegram admins */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">
            👥 {tt.admins.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{tt.admins.desc}</p>
          <p className="mt-1 text-xs text-info">{tt.admins.hint}</p>
        </div>

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const chatRaw = String(form.get("telegram_chat_id") ?? "").trim();
            try {
              await doSaveAdmin({
                data: {
                  telegram_user_id: Number(form.get("telegram_user_id")),
                  ...(chatRaw ? { telegram_chat_id: Number(chatRaw) } : {}),
                  label: String(form.get("label") ?? ""),
                  role: String(form.get("role") ?? "admin") as "admin",
                  active: true,
                },
              });
              toast.success(tt.admins.saved);
              (e.target as HTMLFormElement).reset();
              await queryClient.invalidateQueries({ queryKey: ["bot-admins"] });
            } catch {
              toast.error(tt.admins.failed);
            }
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="telegram_user_id">{tt.admins.telegramId}</Label>
            <Input
              id="telegram_user_id"
              name="telegram_user_id"
              inputMode="numeric"
              required
              placeholder="123456789"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telegram_chat_id">{tt.admins.chatId}</Label>
            <Input
              id="telegram_chat_id"
              name="telegram_chat_id"
              inputMode="numeric"
              placeholder="123456789"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="label">{tt.admins.label}</Label>
            <Input id="label" name="label" maxLength={100} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">{tt.admins.role}</Label>
            <select
              id="role"
              name="role"
              defaultValue="admin"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="admin">{tt.admins.roleAdmin}</option>
              <option value="owner">{tt.admins.roleOwner}</option>
            </select>
          </div>
          <Button type="submit" className="sm:col-span-2">
            {tt.admins.add}
          </Button>
        </form>

        <ul className="space-y-2">
          {(adminsQuery.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">{tt.admins.empty}</li>
          ) : (
            (adminsQuery.data ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {a.label || `ID ${a.telegram_user_id}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.telegram_user_id} ·{" "}
                    {a.role === "owner" ? tt.admins.roleOwner : tt.admins.roleAdmin}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await doRemoveAdmin({ data: { id: a.id } });
                      toast.success(tt.admins.removed);
                      await queryClient.invalidateQueries({
                        queryKey: ["bot-admins"],
                      });
                    } catch {
                      toast.error(tt.admins.failed);
                    }
                  }}
                >
                  {tt.admins.remove}
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Help & Information */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">
              📖 {tt.help.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tt.help.desc}</p>
          </div>
          <div className="flex gap-1 rounded-full border border-border p-1">
            {(["am", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setHelpLang(l)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  helpLang === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {l === "am" ? "🇪🇹 አማርኛ" : "🇬🇧 English"}
              </button>
            ))}
          </div>
        </div>

        {preview ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm">
            {previewText}
          </pre>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{tt.help.fieldTitle}</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            {(
              [
                ["body", tt.help.body],
                ["instructions", tt.help.instructions],
                ["contacts", tt.help.contacts],
                ["announcements", tt.help.announcements],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Textarea
                  rows={3}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label>{tt.help.buttons}</Label>
              {draft.buttons.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={tt.help.buttonText}
                    value={b.text}
                    onChange={(e) => {
                      const next = [...draft.buttons];
                      next[i] = { ...b, text: e.target.value };
                      setDraft({ ...draft, buttons: next });
                    }}
                  />
                  <Input
                    placeholder={tt.help.buttonUrl}
                    value={b.url}
                    onChange={(e) => {
                      const next = [...draft.buttons];
                      next[i] = { ...b, url: e.target.value };
                      setDraft({ ...draft, buttons: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        buttons: draft.buttons.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {draft.buttons.length < 6 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      buttons: [...draft.buttons, { text: "", url: "" }],
                    })
                  }
                >
                  + {tt.help.addButton}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              try {
                await doSaveHelp({
                  data: {
                    ...draft,
                    lang: helpLang,
                    buttons: draft.buttons.filter((b) => b.text && b.url),
                  },
                });
                toast.success(tt.help.saved);
                await queryClient.invalidateQueries({
                  queryKey: ["help-content"],
                });
              } catch {
                toast.error(tt.help.failed);
              }
            }}
          >
            {tt.help.save}
          </Button>
          <Button variant="outline" onClick={() => setPreview((p) => !p)}>
            👁 {tt.help.preview}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await doResetHelp({ data: { lang: helpLang } });
                toast.success(tt.help.resetDone);
                await queryClient.invalidateQueries({
                  queryKey: ["help-content"],
                });
              } catch {
                toast.error(tt.help.failed);
              }
            }}
          >
            ↺ {tt.help.reset}
          </Button>
        </div>
      </section>
    </div>
  );
}
