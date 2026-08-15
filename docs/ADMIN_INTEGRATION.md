# Admin dashboard — integration notes

The admin area is deliberately self-contained so it can be dropped into an
existing website with minimal wiring.

## Files

| Purpose | Path |
| --- | --- |
| Route guard (sign-in required) | `src/routes/_authenticated/route.tsx` |
| Dashboard page (`/admin`) | `src/routes/_authenticated/admin.tsx` |
| Owner settings (Telegram admins, Help) | `src/components/admin/settings-panel.tsx` |
| Login page (`/auth`) | `src/routes/auth.tsx` |
| Server functions (all data access) | `src/lib/admin.functions.ts` |
| Bilingual labels | `src/lib/ui-i18n.tsx` |
| Language switcher | `src/components/language-toggle.tsx` |

Every read/write goes through the server functions in
`src/lib/admin.functions.ts`. The UI never talks to the database directly, so
the same functions can back a different front end.

## Roles

| Role | Can |
| --- | --- |
| `owner` | manage Telegram admins, edit Help & settings, export CSV, plus everything an admin can do |
| `admin` | view / search / filter registrations, edit them, change status, delete |

Roles live in the `user_roles` table (never on a profile row). Access is
enforced twice: database RLS policies (`has_role(auth.uid(), …)`) and an
`assertOwner` check inside owner-only server functions.

The first signed-in user can claim `owner` + `admin` once, while no admin
exists. After that, add roles by inserting into `user_roles`.

## Telegram admins

`bot_admins` holds Telegram user/chat ids. Each new registration is sent to
every row with `active = true`, de-duplicated, plus the optional
`TELEGRAM_ADMIN_CHAT_ID` fallback. Staff can send `/id` to the bot to read
their own Telegram id.

## Help & Information

`help_content` stores one row per language (`am`, `en`) with title, body,
instructions, contacts, announcements and up to six link buttons. The bot
reads it on every `/help`, so saved changes appear in Telegram immediately —
no redeploy.

## Embedding in another site

1. Copy `src/lib/admin.functions.ts`, `src/lib/ui-i18n.tsx`,
   `src/components/admin/`, `src/components/language-toggle.tsx` and the two
   route files.
2. Keep the auth guard: any route under `_authenticated/` is sign-in gated.
3. Point the target project at the same backend (same Supabase project env
   vars). No schema changes are needed.
4. Secrets stay server-side only: `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`,
   `SCHOOL_NOTIFICATION_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`. Never reference
   them from browser code.
