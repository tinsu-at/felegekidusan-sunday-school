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
import { QuestionsPanel } from "@/components/admin/questions-panel";
import { ModulesPanel } from "@/components/admin/modules-panel";

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
  const [tab, setTab] = useState<"registrations" | "modules" | "settings">(
    "registrations",
  );

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
    return {
      total: list.length,
      pending: list.filter((r) => r.status === "pending").length,
      approved: list.filter((r) => r.status === "approved").length,
      rejected: list.filter((r) => r.status === "rejected").length,
      today: list.filter((r) => new Date(r.created_at) >= startOfDay).length,
      week: list.filter((r) => new Date(r.created_at) >= startOfWeek).length,
    };
  }, [regQuery.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["registrations"] });
  };

  const statusOptions = ["pending", "approved", "rejected"] as const;

  const onExport = async () => {
    try {
      const result = await doExport({});
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tt.exportDone);
    } catch {
      toast.error(tt.exportFailed);
    }
  };

  if (statusQuery.isLoading) {
    return <div className="p-6 text-muted-foreground">{tt.loading}</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <img src={logoAsset.src} alt="Sunday School" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <h1 className="font-semibold">{t.brand}</h1>
                <p className="text-xs text-muted-foreground">{tt.ownerOnly}</p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          {statusQuery.data?.adminCount === 0 ? (
            <>
              <h2 className="text-2xl font-bold">{tt.ownerOnly}</h2>
              <p className="mt-3 text-muted-foreground">{tt.empty}</p>
              <Button className="mt-6" onClick={async () => { try { await claim({}); await statusQuery.refetch(); } catch { toast.error(tt.saveFailed); } }}>
                {tt.save}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">{tt.ownerOnly}</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logoAsset.src} alt="Sunday School" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <h1 className="font-semibold">{t.brand}</h1>
              <p className="text-xs text-muted-foreground">{tt.detailsTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>Home</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <Button variant={tab === "registrations" ? "default" : "outline"} onClick={() => setTab("registrations")}>{tt.tabRegistrations}</Button>
          <Button variant={tab === "modules" ? "default" : "outline"} onClick={() => setTab("modules")}>Modules</Button>
          <Button variant={tab === "settings" ? "default" : "outline"} onClick={() => setTab("settings")}>{tt.tabSettings}</Button>
        </div>

        {tab === "modules" ? <ModulesPanel /> : tab === "settings" ? <><QuestionsPanel /><AdminSettingsPanel /></> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["total", "pending", "approved", "rejected", "today", "week"].map((key) => (
                <div key={key} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">{key}</div>
                  <div className="mt-1 text-2xl font-bold">{stats[key as keyof typeof stats]}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registrations" className="max-w-md" />
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ወንድ">{genderLabel("ወንድ", lang)}</SelectItem>
                    <SelectItem value="ሴት">{genderLabel("ሴት", lang)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={refresh}>{tt.refresh}</Button>
                {isOwner && <Button onClick={onExport}>{tt.exportCsv}</Button>}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt.columns.regId}</TableHead>
                    <TableHead>{tt.columns.fullName}</TableHead>
                    <TableHead>{tt.columns.christianName}</TableHead>
                    <TableHead>{tt.columns.gender}</TableHead>
                    <TableHead>{tt.columns.birthDate}</TableHead>
                    <TableHead>{tt.columns.age}</TableHead>
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
                      <TableCell colSpan={13}>{tt.loading}</TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">{tt.empty}</TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        <TableCell className="font-semibold text-primary">{r.registration_id}</TableCell>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell>{r.christian_name}</TableCell>
                        <TableCell>{genderLabel(r.gender, lang)}</TableCell>
                        <TableCell>{r.birth_date_ec ?? r.birth_year_ec}</TableCell>
                        <TableCell>{r.age_years ?? "—"}</TableCell>
                        <TableCell>{r.mother_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.mother_phone}</TableCell>
                        <TableCell>{r.father_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.father_phone}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Select value={r.status} onValueChange={async (value) => {
                            try {
                              await doStatus({ data: { id: r.id, status: value as "pending" } });
                              toast.success(tt.statusChanged);
                              await refresh();
                            } catch { toast.error(tt.statusFailed); }
                          }}>
                            <SelectTrigger className={`w-36 rounded-full border-0 text-xs font-semibold ${STATUS_TONE[r.status] ?? ""}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{statusOptions.map((v) => <SelectItem key={v} value={v}>{tt.status[v]}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setViewing(r)}>{tt.view}</Button>
                            <Button size="sm" onClick={() => setEditing(r)}>{tt.edit}</Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleting(r)}>{tt.delete}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">{tt.showing(rows.length, regQuery.data?.length ?? 0)}</p>
          </>
        )}
      </main>

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
                [`🔢 ${tt.columns.age}`, viewing.age_years ?? "—"],
                [`👩 ${tt.columns.motherName}`, viewing.mother_name],
                [`📞 ${tt.columns.motherPhone}`, viewing.mother_phone],
                [`👨 ${tt.columns.fatherName}`, viewing.father_name],
                [`📞 ${tt.columns.fatherPhone}`, viewing.father_phone],
                [
                  tt.columns.status,
                  tt.status[viewing.status] ?? viewing.status,
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tt.editTitle}</DialogTitle></DialogHeader>
          {editing ? (
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await doUpdate({ data: {
                  id: editing.id,
                  full_name: String(form.get("full_name") ?? ""),
                  christian_name: String(form.get("christian_name") ?? ""),
                  gender: String(form.get("gender") ?? editing.gender) as "ወንድ" | "ሴት",
                  birth_date_ec: String(form.get("birth_date_ec") ?? ""),
                  mother_name: String(form.get("mother_name") ?? ""),
                  mother_phone: String(form.get("mother_phone") ?? ""),
                  father_name: String(form.get("father_name") ?? ""),
                  father_phone: String(form.get("father_phone") ?? ""),
                  status: editing.status as "pending" | "approved" | "rejected",
                }});
                toast.success(tt.saved);
                setEditing(null);
                await refresh();
              } catch { toast.error(tt.saveFailed); }
            }}>
              <div><Label htmlFor="full_name">{tt.columns.fullName}</Label><Input id="full_name" name="full_name" defaultValue={editing.full_name} /></div>
              <div><Label htmlFor="christian_name">{tt.columns.christianName}</Label><Input id="christian_name" name="christian_name" defaultValue={editing.christian_name} /></div>
              <div><Label htmlFor="birth_date_ec">{tt.columns.birthDate}</Label><Input id="birth_date_ec" name="birth_date_ec" defaultValue={editing.birth_date_ec ?? String(editing.birth_year_ec)} /></div>
              <div><Label htmlFor="mother_name">{tt.columns.motherName}</Label><Input id="mother_name" name="mother_name" defaultValue={editing.mother_name} /></div>
              <div><Label htmlFor="mother_phone">{tt.columns.motherPhone}</Label><Input id="mother_phone" name="mother_phone" defaultValue={editing.mother_phone} /></div>
              <div><Label htmlFor="father_name">{tt.columns.fatherName}</Label><Input id="father_name" name="father_name" defaultValue={editing.father_name} /></div>
              <div><Label htmlFor="father_phone">{tt.columns.fatherPhone}</Label><Input id="father_phone" name="father_phone" defaultValue={editing.father_phone} /></div>
              <div><Label>{tt.columns.gender}</Label><Select name="gender" defaultValue={editing.gender}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ወንድ">{genderLabel("ወንድ", lang)}</SelectItem><SelectItem value="ሴት">{genderLabel("ሴት", lang)}</SelectItem></SelectContent></div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>{tt.cancel}</Button><Button type="submit">{tt.save}</Button></DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tt.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{tt.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tt.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleting) return;
              try {
                await doDelete({ data: { id: deleting.id } });
                toast.success(tt.deleted);
                setDeleting(null);
                await refresh();
              } catch { toast.error(tt.deleteFailed); }
            }}>{tt.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
