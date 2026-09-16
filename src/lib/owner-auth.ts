import type { createClient } from '@supabase/supabase-js';

export const OWNER_EMAILS = [
  'tinsaetsegaye85@gmail.com',
] as const;

export function isOwnerEmail(email: unknown): boolean {
  return OWNER_EMAILS.includes(
    String(email ?? '').trim().toLowerCase() as (typeof OWNER_EMAILS)[number],
  );
}

type SupabaseAuthClient = ReturnType<typeof createClient>;

export async function getAuthenticatedEmail(
  supabase: SupabaseAuthClient,
  claims: Record<string, unknown>,
): Promise<string> {
  const claimEmail = String(claims.email ?? '').trim().toLowerCase();
  if (claimEmail) return claimEmail;

  const { data } = await supabase.auth.getUser();
  return String(data.user?.email ?? '').trim().toLowerCase();
}
