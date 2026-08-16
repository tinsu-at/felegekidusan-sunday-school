import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminSettingsPanel } from "@/components/admin/settings-panel";
import { LanguageToggle } from "@/components/language-toggle";
import logoAsset from "@/assets/sunday-school-logo.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { genderLabel, useUiLang } from "@/lib/ui-i18n";
import {
  claimFirstAdmin,
  deleteRegistration,
  exportRegistrationsCsv,
  getAdminStatus,
  listRegistrations,
  setRegistrationStatus,
  updateRegistration,
  type AdminRegistration,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "የምዝገባ አስተዳደር | ሰንበት ት/ቤት" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ተማሪዎች ምዝገባ አስተዳደር ገጽ — ምዝገባዎችን ይመልከቱ፣ ያስተካክሉ እና ያስተዳድሩ።",
      },
      { property: "og:title", content: "የምዝገባ አስተዳደር | ሰንበት ት/ቤት" },
      {
        property: "og:description",
        content: "የሰንበት ት/ቤት ተማሪዎች ምዝገባ አስተዳደር ገጽ።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-accent/25 text-accent-foreground",
  approved: "bg-primary/12 text-primary",
  rejected: "bg-destructive/12 text-destructive",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang, t } = useUiLang();
  const tt = t.admin;
  const fetchStatus = useServerFn(getAdminStatus);
  const fetchList = useServerFn(listRegistrations);
  const claim = useServerFn(claimFirstAdmin);
  const doUpdate = useServerFn(updateRegistration);
  const doStatus = useServerFn(setRegistrationStatus);
  const doDelete = useServerFn(deleteRegistration);
  const doExport = useServerFn(exportRegistrationsCsv);

  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"all" | "ወንድ" | "ሴት">("all");
  const [editing, setEditing] = useState<AdminRegistration | null>(null);
  const [viewing, setViewing] = useState<AdminRegistration | null>(null);
  const [deleting, setDeleting] = useState<AdminRegistration | null>(null);
  const [tab, setTab] = useState<"registrations" | "settings">("registrations");

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => fetchStatus({}),
  });

  const isAdmin = statusQuery.data?.isAdmin ?? false;
  const isOwner = statusQuery.data?.isOwner ?? false;

  const regQuery = useQuery({
    queryKey: ["registrations"],
    queryFn: () => fetchList({}),
    enabled: isAdmin,
  });

  const rows = useMemo(() => {
    const list = regQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (gender !== "all" && r.gender !== gender) return false;
      if (!q) return true;
      return [
        r.full_name,
        r.christian_name,
        r.registration_id,
        r.mother_phone,
        r.father_phone,
      ].some((v) => v.toLowerCase().includes(q));
    });
  }, [regQuery.data, search, gender]);

  const stats = useMemo(() => {
    const list = regQuery.data ?? [];
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = (from: Date) =>
      list.filter((r) => new Date(r.created_at) >= from).length;
    return {
      total: list.length,
      today: count(startOfDay),
      week: count(startOfWeek),
      month: count(startOfMonth),
    };
  }, [regQuery.data]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["registrations"] });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (statusQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{tt.loading}</p>
      </main>
    );
  }

  if (!isAdmin) {
    const canClaim = (statusQuery.data?.adminCount ?? 1) === 0;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <LanguageToggle className="mx-auto" />
          <h1 className="text-xl font-semibold text-card-foreground">
            {tt.noAccessTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{tt.noAccessBody}</p>
          {canClaim ? (
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await claim({});
                  toast.success(tt.claimed);
                  await statusQuery.refetch();
                } catch {
                  toast.error(tt.claimFailed);
                }
              }}
            >
              {tt.claim}
            </Button>
          ) : null}
          <Button variant="outline" className="w-full" onClick={signOut}>
            {tt.signOut}
          </Button>
        </div>
      </main>
    );
  }

  const statusOptions = ["pending", "approved", "rejected"] as const;

  return (
    <main className="min-h-screen bg-background">
      <header className="brand-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8">
          <div className="flex items-center gap-4">
            <img
              src={logoAsset.url}
              alt={t.brand}
              className="h-16 w-16 rounded-full border-2 border-accent/70 bg-background object-cover shadow-md"
            />
            <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
              {t.brand}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{tt.title}</h1>
            <p className="mt-1 text-sm opacity-85">{tt.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              variant="secondary"
              onClick={signOut}
              className="rounded-full"
            >
              {tt.signOut}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["registrations", tt.tabRegistrations],
              ["settings", tt.tabSettings],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
          {isOwner ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto rounded-full"
              onClick={async () => {
                try {
                  const { csv } = await doExport({});
                  const url = URL.createObjectURL(
                    new Blob([csv], { type: "text/csv;charset=utf-8" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(tt.exportDone);
                } catch {
                  toast.error(tt.exportFailed);
                }
              }}
            >
              {tt.exportCsv}
            </Button>
          ) : null}
        </div>

        {tab === "settings" ? (
          <AdminSettingsPanel
            isOwner={isOwner}
            currentEmail={statusQuery.data?.email}
          />

        ) : (
        <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: tt.total, value: stats.total, icon: "📊" },
            { label: tt.today, value: stats.today, icon: "📅" },
            { label: tt.week, value: stats.week, icon: "🗓️" },
            { label: tt.month, value: stats.month, icon: "📈" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {s.icon} {s.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-card-foreground">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Input
            placeholder={`🔍 ${tt.search}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            {(["all", "ወንድ", "ሴት"] as const).map((g) => (
              <Button
                key={g}
                size="sm"
                variant={gender === g ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setGender(g)}
              >
                {g === "all" ? tt.all : genderLabel(g, lang)}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => void refresh()}
          >
            ↻ {tt.refresh}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {tt.showing(rows.length, stats.total)}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>{tt.columns.regId}</TableHead>
                <TableHead>{tt.columns.fullName}</TableHead>
                <TableHead>{tt.columns.christianName}</TableHead>
                <TableHead>{tt.columns.gender}</TableHead>
                <TableHead>{tt.columns.birthDate}</TableHead>
                <TableHead>{tt.columns.motherName}</TableHead>
                <TableHead>{tt.columns.motherPhone}</TableHead>
                <TableHead>{tt.columns.fatherName}</TableHead>
                <TableHead>{tt.columns.fatherPhone}</TableHead>
                <TableHead>{tt.columns.created}</TableHead>
                <TableHead>{tt.columns.status}</TableHead>
                <TableHead>{tt.columns.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={12}>{tt.loading}</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {tt.empty}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="font-semibold text-primary">
                      {r.registration_id}
                    </TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell>{r.christian_name}</TableCell>
                    <TableCell>{genderLabel(r.gender, lang)}</TableCell>
                    <TableCell>{r.birth_date_ec ?? r.birth_year_ec}</TableCell>
                    <TableCell>{r.mother_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.mother_phone}
                    </TableCell>
                    <TableCell>{r.father_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.father_phone}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={async (value) => {
                          try {
                            await doStatus({
                              data: { id: r.id, status: value as "pending" },
                            });
                            toast.success(tt.statusChanged);
                            await refresh();
                          } catch {
                            toast.error(tt.statusFailed);
                          }
                        }}
                      >
                        <SelectTrigger
                          className={`w-36 rounded-full border-0 text-xs font-semibold ${STATUS_TONE[r.status] ?? ""}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((v) => (
                            <SelectItem key={v} value={v}>
                              {tt.status[v]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewing(r)}
                        >
                          {tt.view}
                        </Button>
                        <Button size="sm" onClick={() => setEditing(r)}>
                          {tt.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleting(r)}
                        >
                          {tt.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </>
        )}
      </div>

      {/* Details */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt.detailsTitle}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <dl className="space-y-2 text-sm">
              {[
                [`🆔 ${tt.columns.regId}`, viewing.registration_id],
                [`👤 ${tt.columns.fullName}`, viewing.full_name],
                [`✝️ ${tt.columns.christianName}`, viewing.christian_name],
                [`⚥ ${tt.columns.gender}`, genderLabel(viewing.gender, lang)],
                [
                  `🎂 ${tt.columns.birthDate}`,
                  viewing.birth_date_ec ?? String(viewing.birth_year_ec),
                ],
                [`👩 ${tt.columns.motherName}`, viewing.mother_name],
                [`📞 ${tt.columns.motherPhone}`, viewing.mother_phone],
                [`👨 ${tt.columns.fatherName}`, viewing.father_name],
                [`📞 ${tt.columns.fatherPhone}`, viewing.father_phone],
                [
                  tt.columns.status,
                  tt.status[viewing.status] ?? viewing.status,
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tt.editTitle}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                try {
                  await doUpdate({
                    data: {
                      id: editing.id,
                      full_name: String(form.get("full_name")),
                      christian_name: String(form.get("christian_name")),
                      gender: String(form.get("gender")) as "ወንድ",
                      birth_date_ec: String(form.get("birth_date_ec")),
                      mother_name: String(form.get("mother_name")),
                      mother_phone: String(form.get("mother_phone")),
                      father_name: String(form.get("father_name")),
                      father_phone: String(form.get("father_phone")),
                      status: editing.status as "pending",
                    },
                  });
                  toast.success(tt.saved);
                  setEditing(null);
                  await refresh();
                } catch {
                  toast.error(tt.saveFailed);
                }
              }}
            >
              {[
                ["full_name", tt.columns.fullName, editing.full_name],
                [
                  "christian_name",
                  tt.columns.christianName,
                  editing.christian_name,
                ],
                [
                  "birth_date_ec",
                  `${tt.columns.birthDate} (DD/MM/YYYY)`,
                  editing.birth_date_ec ?? "",
                ],
                ["mother_name", tt.columns.motherName, editing.mother_name],
                ["mother_phone", tt.columns.motherPhone, editing.mother_phone],
                ["father_name", tt.columns.fatherName, editing.father_name],
                ["father_phone", tt.columns.fatherPhone, editing.father_phone],
              ].map(([name, label, value]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={name}>{label}</Label>
                  <Input id={name} name={name} defaultValue={value} required />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="gender">{tt.columns.gender}</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={editing.gender}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="ወንድ">{genderLabel("ወንድ", lang)}</option>
                  <option value="ሴት">{genderLabel("ሴት", lang)}</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit">{tt.save}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tt.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.registration_id} — {tt.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tt.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await doDelete({ data: { id: deleting.id } });
                  toast.success(tt.deleted);
                  setDeleting(null);
                  await refresh();
                } catch {
                  toast.error(tt.deleteFailed);
                }
              }}
            >
              {tt.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
