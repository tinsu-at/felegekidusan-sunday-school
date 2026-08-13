import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "የእሁድ ት/ቤት ምዝገባ ቦት | Sunday School Registration" },
      {
        name: "description",
        content:
          "የእሁድ ት/ቤት ተማሪዎች ምዝገባ በቴሌግራም ቦት አማካኝነት። ምዝገባውን በቀላሉ በአማርኛ ይጨርሱ።",
      },
      { property: "og:title", content: "የእሁድ ት/ቤት ምዝገባ ቦት" },
      {
        property: "og:description",
        content: "የእሁድ ት/ቤት ተማሪዎች ምዝገባ በቴሌግራም ቦት አማካኝነት።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  "ሙሉ ስም ከነአያት",
  "የክርስትና ስም",
  "የትውልድ ዘመን",
  "የእናት ስም እና ስልክ",
  "የአባት ስም እና ስልክ",
];

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6 text-center">
        <span className="inline-flex items-center rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
          🙏 እሁድ ት/ቤት
        </span>

        <h1 className="text-3xl font-bold leading-snug text-foreground">
          የተማሪዎች ምዝገባ በቴሌግራም
        </h1>

        <p className="text-base leading-relaxed text-muted-foreground">
          ምዝገባው በሙሉ በቴሌግራም ቦት አማካኝነት ይከናወናል። ቦቱን ከፍተው{" "}
          <span className="font-semibold text-foreground">/start</span> ብለው
          ይጀምሩ።
        </p>

        <a
          href="https://t.me/felegekiduasnbot"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          📝 ምዝገባ ጀምር
        </a>

        <div className="rounded-xl border border-border bg-card p-5 text-left">
          <h2 className="text-sm font-semibold text-card-foreground">
            የሚጠየቁ መረጃዎች
          </h2>
          <ul className="mt-3 space-y-2">
            {steps.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          🔒 የተማሪዎችና የወላጆች መረጃ በሚስጥር ተጠብቆ ይቀመጣል።
        </p>
      </div>
    </main>
  );
}
