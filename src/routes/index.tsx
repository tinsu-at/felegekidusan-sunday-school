import { createFileRoute, Link } from "@tanstack/react-router";

import { LanguageToggle } from "@/components/language-toggle";
import { useUiLang } from "@/lib/ui-i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ሰንበት ት/ቤት ምዝገባ | Sunday School Registration" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ተማሪዎች ምዝገባ በቴሌግራም ቦት — Register Sunday School students through our Telegram bot in Amharic or English.",
      },
      { property: "og:title", content: "ሰንበት ት/ቤት ምዝገባ | Sunday School Registration" },
      {
        property: "og:description",
        content: "የሰንበት ት/ቤት ተማሪዎች ምዝገባ በቴሌግራም ቦት አማካኝነት።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useUiLang();
  const l = t.landing;

  return (
    <main className="min-h-screen bg-background">
      <div className="brand-gradient text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="flex justify-end">
            <LanguageToggle />
          </div>
          <p className="mt-6 inline-flex rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold tracking-wide">
            {l.badge}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            {l.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm opacity-90 sm:text-base">
            {l.subtitle}
          </p>
          <a
            href="https://t.me"
            className="mt-7 inline-flex items-center justify-center rounded-full bg-card px-6 py-3 text-sm font-semibold text-primary shadow-sm transition hover:opacity-90"
          >
            {l.cta}
          </a>
        </div>
      </div>

      <section className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">
            {l.stepsTitle}
          </h2>
          <ol className="mt-4 space-y-3">
            {l.steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">
            {l.helpTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {l.contacts.map((c) => (
              <div key={c.phone} className="rounded-xl bg-muted/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {c.role}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {c.name}
                </p>
                <a
                  href={`tel:${c.phone}`}
                  className="mt-1 block text-sm text-primary"
                >
                  📞 {c.phone}
                </a>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">{l.privacy}</p>

        <div className="text-center">
          <Link
            to="/auth"
            className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
          >
            {l.adminLogin}
          </Link>
        </div>
      </section>
    </main>
  );
}
