import { searchCatalog } from "@/src/catalog/service";
import { consumeRateLimit } from "@/src/lib/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor") ?? "0";

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const rateLimit = await consumeRateLimit(`catalog:${clientKey}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return Response.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Too many catalog searches. Try again in a minute." } },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (query.length < 2 || query.length > 120) {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Search for at least two characters." } },
      { status: 422 },
    );
  }
  if (!/^\d+$/.test(cursor)) {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "That catalog cursor is invalid." } },
      { status: 422 },
    );
  }

  try {
    const result = await searchCatalog(query, cursor);
    return Response.json({ ok: true, data: result }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog search is temporarily unavailable.";
    return Response.json({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE", message } }, { status: 503 });
  }
}
