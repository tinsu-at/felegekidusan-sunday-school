import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "server-only", message: "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`." }] },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  eslintPluginPrettier,
  {
    // Formatting is handled by Prettier separately; it should not block CI.
    rules: { "prettier/prettier": "off" },
  },
  {
    // Lovable-generated adapter: the timer is intentionally mutable because its callback closes over it.
    files: ["src/integrations/supabase/previewAuthStorage.ts"],
    rules: { "prefer-const": "off" },
  },
  {
    // Telegram keycap/variation-selector regex is intentional; ESLint's rule is a false positive here.
    files: ["src/lib/telegram-bot.server.ts"],
    rules: { "no-misleading-character-class": "off" },
  },
);
