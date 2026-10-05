/**
 * Server-only staff authorisation helpers shared by the module platform.
 * Mirrors the owner identity used by the registration dashboard.
 */

const OWNER_EMAILS = [
  "tinsaetsegaye85@gmail.com",
] as const;

export function isOwnerEmail(email: unknown): boolean {
  return OWNER_EMAILS.includes(
    String(email ?? "").trim().toLowerCase() as (typeof OWNER_EMAILS)[number],
  );
}

type Ctx = {
  supabase: unknown;
  userId: string;
  claims?: Record<string, unknown>;
};

type HasRoleRpc = (
  fn: "has_role",
  args: { _user_id: string; _role: "owner" | "admin" },
) => PromiseLike<{ data: unknown }>;

function rpcOf(context: Ctx): HasRoleRpc {
  const client = context.supabase as { rpc: HasRoleRpc };
  return client.rpc.bind(client);
}

/** Throws unless the caller holds the owner role (or is the owner account). */
export async function assertOwner(context: Ctx): Promise<void> {
  if (isOwnerEmail(context.claims?.["email"])) return;
  const { data } = await rpcOf(context)("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (!data) throw new Error("Forbidden");
}

/** Throws unless the caller is an admin or the owner. */
export async function assertStaff(context: Ctx): Promise<void> {
  if (isOwnerEmail(context.claims?.["email"])) return;
  const [{ data: admin }, { data: owner }] = await Promise.all([
    rpcOf(context)("has_role", {
      _user_id: context.userId,
      _role: "admin",
    }),
    rpcOf(context)("has_role", {
      _user_id: context.userId,
      _role: "owner",
    }),
  ]);
  if (!admin && !owner) throw new Error("Forbidden");
}
