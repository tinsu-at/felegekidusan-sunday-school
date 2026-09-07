import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LanguageToggle } from "@/components/language-toggle";
import logoAsset from "@/assets/sunday-school-logo.jpg.asset.json";
import { useUiLang } from "@/lib/ui-i18n";
import { listPublicForms } from "@/lib/modules.functions";

export const Route = createFileRoute("/forms/")({
  head: () => ({
    meta: [
      { title: "ቅጾች | Sunday School Forms" },
      {
        name: "description",
        content:
          "የሰንበት ት/ቤት ክፍሎች ክፍት ቅጾች — Open Sunday School department forms you can fill in online.",
      },
      { property: "og:title", content: "ቅጾች | Sunday School Forms" },
      {
        property: "og:description",
        content: "የሰንበት ት/ቤት ክፍሎች ክፍት ቅጾች።",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FormsIndex,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">
        ቅጾቹን መጫን አልተቻለም። / Could not load the forms.
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">አልተገኘም / Not found</p>
    </main>
  ),
});

function FormsIndex() {
  const { lang } = useUiLang();
  const fetchForms = useServerFn(listPublicForms);
  const query = useQuery({
    queryKey: ["public-forms"],
    queryFn: () => fetchForms({}),
  });

  const am = lang === "am";
  const forms = query.data ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="brand-gradient text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex justify-end">
            <LanguageToggle />
          </div>
          <img
            src={logoAsset.url}
            alt={am ? "ሰንበት ት/ቤት" : "Sunday School"}
            className="mt-4 h-20 w-20 rounded-full border-2 border-accent/70 bg-background object-cover shadow-md"
          />
          <h1 className="mt-4 text-3xl font-bold">
            {am ? "ክፍት ቅጾች" : "Open forms"}
          </h1>
          <p className="mt-2 text-sm opacity-90">
            {am
              ? "የሚፈልጉትን ቅጽ ይምረጡ እና ይሙሉ።"
              : "Pick a form below and fill it in."}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 px-6 py-10">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">
            {am ? "በመጫን ላይ…" : "Loading…"}
          </p>
        ) : forms.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {am
              ? "አሁን ክፍት ቅጽ የለም።"
              : "There are no open forms right now."}
          </p>
        ) : (
          forms.map((f) => {
            const title =
              (am ? f.title_am : f.title_en) || f.title_am || f.title_en;
            const desc =
              (am ? f.description_am : f.description_en) ||
              f.description_am ||
              f.description_en;
            return (
              <Link
                key={f.id}
                to="/forms/$slug"
                params={{ slug: f.slug }}
                className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50"
              >
                <p className="text-lg font-semibold text-card-foreground">
                  {title}
                </p>
                {desc ? (
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                ) : null}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
