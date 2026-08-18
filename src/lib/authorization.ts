import { getSession } from "./session";
import { isDemoMode } from "./runtime-config";

export async function hasModeratorAccess() {
  if (isDemoMode()) return true;
  const session = await getSession();
  const allowed = (process.env.MODERATOR_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "MODERATOR" || role === "ADMIN" || Boolean(session?.user?.email && allowed.includes(session.user.email.toLowerCase()));
}
