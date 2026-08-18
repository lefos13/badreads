import { getSession } from "@/src/lib/session";
import { getDomainStore } from "@/src/domain/repository";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  const result = await getDomainStore().exportProfile(session.user.id);
  if (!result.ok) return Response.json({ ok: false, error: { code: result.code, message: result.message } }, { status: 404 });

  return Response.json({ ok: true, data: result.data }, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=badreads-account-export.json",
    },
  });
}
