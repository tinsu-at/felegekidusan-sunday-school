import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUiLang } from "@/lib/ui-i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "የይለፍ ቃል ማደስ | ሰንበት ት/ቤት ምዝገባ" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ምዝገባ አስተዳዳሪ መለያ የይለፍ ቃል በደህንነት ያድሱ።",
      },
      { property: "og:title", content: "የይለፍ ቃል ማደስ | ሰንበት ት/ቤት ምዝገባ" },
      {
        property: "og:description",
        content: "የአስተዳዳሪ መለያ የይለፍ ቃል ማደስ ገጽ።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { lang } = useUiLang();
  const am = lang !== "en";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(am ? "የይለፍ ቃል ተቀይሯል" : "Password updated");
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : am
            ? "አልተሳካም"
            : "Could not update the password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-card-foreground">
          🔑 {am ? "አዲስ የይለፍ ቃል" : "Set a new password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {am
            ? "ከኢሜይል የመጣውን አገናኝ ተጠቅመው ገብተዋል። አዲስ የይለፍ ቃል ያስገቡ።"
            : "You arrived from the recovery link. Choose a new password."}
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-password">
            {am ? "አዲስ የይለፍ ቃል" : "New password"}
          </Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "…" : am ? "አስቀምጥ" : "Save password"}
        </Button>
      </form>
    </main>
  );
}
