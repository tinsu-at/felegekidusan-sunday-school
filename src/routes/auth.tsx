import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LanguageToggle } from "@/components/language-toggle";
import logoAsset from "@/assets/sunday-school-logo.jpg.asset.json";
import { useUiLang } from "@/lib/ui-i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "የአስተዳዳሪ መግቢያ | ሰንበት ት/ቤት ምዝገባ" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ምዝገባ አስተዳዳሪዎች መግቢያ ገጽ። የተማሪዎች መረጃ በሚስጥር ተጠብቆ ይቀመጣል።",
      },
      { property: "og:title", content: "የአስተዳዳሪ መግቢያ | ሰንበት ት/ቤት ምዝገባ" },
      {
        property: "og:description",
        content: "የሰንበት ት/ቤት ምዝገባ አስተዳዳሪዎች መግቢያ ገጽ።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { lang, t } = useUiLang();
  const a = t.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(a.created);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/admin", replace: true });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : a.failed,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
        <div className="space-y-2 text-center">
          <img
            src={logoAsset.url}
            alt="ሰንበት ት/ቤት"
            width={80}
            height={80}
            className="mx-auto size-20 rounded-full border-2 border-accent/80 object-cover shadow-md"
          />
          <h1 className="text-2xl font-bold text-foreground">
            🔒 {a.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {a.subtitle}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{a.email}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{a.password}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? a.loading : mode === "signup" ? a.signUp : a.signIn}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-sm text-muted-foreground underline"
        >
          {mode === "signin" ? a.toSignUp : a.toSignIn}
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!email) {
              toast.error(
                lang === "en"
                  ? "Enter your email first"
                  : "እባክዎ መጀመሪያ ኢሜይልዎን ያስገቡ",
              );
              return;
            }
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success(
              lang === "en"
                ? "Password reset link sent — check your email"
                : "የይለፍ ቃል ማደስ አገናኝ ተልኳል — ኢሜይልዎን ይመልከቱ",
            );
          }}
          className="w-full text-center text-xs text-muted-foreground underline"
        >
          {lang === "en" ? "Forgot password?" : "የይለፍ ቃል ረስተዋል?"}
        </button>

      </div>
    </main>
  );
}
