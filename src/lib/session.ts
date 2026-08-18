import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  if (process.env.DEMO_MODE !== "false" && !process.env.DATABASE_URL) {
    return { user: { id: "profile-mara", email: "demo@badreads.local", name: "Mara Reads" } };
  }

  return auth.api.getSession({ headers: await headers() });
}
