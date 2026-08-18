import { searchCatalog } from "@/src/catalog/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor") ?? "0";

  if (query.length < 2 || query.length > 120) {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Search for at least two characters." } },
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
