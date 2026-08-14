import { useUiLang } from "@/lib/ui-i18n";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "am", label: "🇪🇹 አማርኛ" },
  { value: "en", label: "🇬🇧 English" },
] as const;

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useUiLang();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm",
        className,
      )}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            lang === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
