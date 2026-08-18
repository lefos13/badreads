import { headers } from "next/headers";
import { auth } from "./auth";
import { isDemoMode } from "./runtime-config";

export async function getSession() {
  if (isDemoMode()) {
    return { user: { id: "profile-mara", email: "demo@badreads.local", name: "Mara Reads" } };
  }

  return auth.api.getSession({ headers: await headers() });
}
