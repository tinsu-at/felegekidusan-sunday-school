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
import { supabase } from "@/integrations/supabase/client";
import {
  claimFirstAdmin,
  deleteRegistration,
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

const STATUS_LABEL: Record<string, string> = {
  pending: "በመጠባበቅ",
  approved: "ተቀብሏል",
  rejected: "ተቀባይነት አላገኘም",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getAdminStatus);
  const fetchList = useServerFn(listRegistrations);
  const claim = useServerFn(claimFirstAdmin);
  const doUpdate = useServerFn(updateRegistration);
  const doStatus = useServerFn(setRegistrationStatus);
  const doDelete = useServerFn(deleteRegistration);

  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"all" | "ወንድ" | "ሴት">("all");
  const [editing, setEditing] = useState<AdminRegistration | null>(null);
  const [viewing, setViewing] = useState<AdminRegistration | null>(null);
  const [deleting, setDeleting] = useState<AdminRegistration | null>(null);

  const statusQuery = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => fetchStatus({}),
  });

  const isAdmin = statusQuery.data?.isAdmin ?? false;

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["registrations"] });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (statusQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">በመጫን ላይ...</p>
      </main>
    );
  }

  if (!isAdmin) {
    const canClaim = (statusQuery.data?.adminCount ?? 1) === 0;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            🔒 ፈቃድ አልተሰጠዎትም
          </h1>
          <p className="text-sm text-muted-foreground">
            ይህ ገጽ ለተፈቀደላቸው አስተዳዳሪዎች ብቻ ነው።
          </p>
          {canClaim ? (
            <Button
              onClick={async () => {
                try {
                  await claim({});
                  toast.success("የአስተዳዳሪ ፈቃድ ተሰጥቷል።");
                  await statusQuery.refetch();
                } catch {
                  toast.error("ፈቃድ መስጠት አልተቻለም።");
                }
              }}
            >
              እኔን የመጀመሪያ አስተዳዳሪ አድርግ
            </Button>
          ) : null}
          <Button variant="outline" onClick={signOut}>
            ውጣ
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            📋 የሰንበት ት/ቤት ምዝገባ አስተዳደር
          </h1>
          <Button variant="outline" onClick={signOut}>
            ውጣ
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "📊 ጠቅላላ ምዝገባ", value: stats.total },
            { label: "📅 የዛሬ ምዝገባ", value: stats.today },
            { label: "📅 የዚህ ሳምንት ምዝገባ", value: stats.week },
            { label: "📅 የዚህ ወር ምዝገባ", value: stats.month },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-card-foreground">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="🔍 ስም፣ የክርስትና ስም፣ የምዝገባ ቁጥር ወይም ስልክ ይፈልጉ"
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
                onClick={() => setGender(g)}
              >
                {g === "all" ? "ሁሉም" : g}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>የምዝገባ ቁጥር</TableHead>
                <TableHead>ሙሉ ስም</TableHead>
                <TableHead>የክርስትና ስም</TableHead>
                <TableHead>ጾታ</TableHead>
                <TableHead>የትውልድ ዘመን</TableHead>
                <TableHead>የእናት ስም</TableHead>
                <TableHead>የእናት ስልክ</TableHead>
                <TableHead>የአባት ስም</TableHead>
                <TableHead>የአባት ስልክ</TableHead>
                <TableHead>የምዝገባ ቀን</TableHead>
                <TableHead>ሁኔታ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {regQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={12}>በመጫን ላይ...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12}>ምዝገባ አልተገኘም።</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.registration_id}
                    </TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell>{r.christian_name}</TableCell>
                    <TableCell>{r.gender}</TableCell>
                    <TableCell>
                      {r.birth_date_ec ?? r.birth_year_ec}
                    </TableCell>
                    <TableCell>{r.mother_name}</TableCell>
                    <TableCell>{r.mother_phone}</TableCell>
                    <TableCell>{r.father_name}</TableCell>
                    <TableCell>{r.father_phone}</TableCell>
                    <TableCell>
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={async (value) => {
                          try {
                            await doStatus({ data: { id: r.id, status: value as "pending" } });
                            toast.success("ሁኔታው ተቀይሯል።");
                            await refresh();
                          } catch {
                            toast.error("ሁኔታውን መቀየር አልተቻለም።");
                          }
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([v, label]) => (
                            <SelectItem key={v} value={v}>
                              {label}
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
                          ዝርዝር
                        </Button>
                        <Button size="sm" onClick={() => setEditing(r)}>
                          አስተካክል
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleting(r)}
                        >
                          ሰርዝ
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Details */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>የምዝገባ ዝርዝር</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <dl className="space-y-2 text-sm">
              {[
                ["🆔 የምዝገባ ቁጥር", viewing.registration_id],
                ["👤 ሙሉ ስም", viewing.full_name],
                ["✝️ የክርስትና ስም", viewing.christian_name],
                ["⚥ ጾታ", viewing.gender],
                ["🎂 የትውልድ ዘመን", viewing.birth_date_ec ?? String(viewing.birth_year_ec)],
                ["👩 የእናት ስም", viewing.mother_name],
                ["📞 የእናት ስልክ", viewing.mother_phone],
                ["👨 የአባት ስም", viewing.father_name],
                ["📞 የአባት ስልክ", viewing.father_phone],
                ["ሁኔታ", STATUS_LABEL[viewing.status] ?? viewing.status],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
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
            <DialogTitle>ምዝገባ አስተካክል</DialogTitle>
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
                  toast.success("ተስተካክሏል።");
                  setEditing(null);
                  await refresh();
                } catch {
                  toast.error("ማስተካከል አልተቻለም። መረጃውን ያረጋግጡ።");
                }
              }}
            >
              {[
                ["full_name", "ሙሉ ስም", editing.full_name],
                ["christian_name", "የክርስትና ስም", editing.christian_name],
                [
                  "birth_date_ec",
                  "የትውልድ ዘመን (ቀን/ወር/ዓመት)",
                  editing.birth_date_ec ?? "",
                ],
                ["mother_name", "የእናት ስም", editing.mother_name],
                ["mother_phone", "የእናት ስልክ", editing.mother_phone],
                ["father_name", "የአባት ስም", editing.father_name],
                ["father_phone", "የአባት ስልክ", editing.father_phone],
              ].map(([name, label, value]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={name}>{label}</Label>
                  <Input id={name} name={name} defaultValue={value} required />
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="gender">ጾታ</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={editing.gender}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="ወንድ">ወንድ</option>
                  <option value="ሴት">ሴት</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="submit">አስቀምጥ</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ምዝገባውን ይሰርዙ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.registration_id} — ይህ እርምጃ መመለስ አይችልም።
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>አይ</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await doDelete({ data: { id: deleting.id } });
                  toast.success("ተሰርዟል።");
                  setDeleting(null);
                  await refresh();
                } catch {
                  toast.error("መሰረዝ አልተቻለም።");
                }
              }}
            >
              አዎ፣ ሰርዝ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
