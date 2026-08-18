import { z } from "zod";
import { analyticsEvents } from "@/src/db/schema";
import { db } from "@/src/db";
import { getSession } from "@/src/lib/session";
import { consumeRateLimit } from "@/src/lib/rate-limit";

const eventSchema = z.object({
  eventName: z.enum(["page_view", "roast_started", "roast_submitted", "reaction_set", "follow_set", "bookmark_set", "report_submitted"]),
  properties: z.record(z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()])).default({}),
});

/*
 * Analytics accepts a small allow-list of anonymous product events. It never
 * accepts email, raw IP, or arbitrary HTML, so instrumentation cannot become
 * an accidental shadow profile or a log-injection surface.
 */

export async function POST(request: Request) {
  const session = await getSession();
  const key = session?.user?.id ?? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous");
  const rateLimit = await consumeRateLimit(`analytics:${key}`, 120, 60 * 60 * 1000);
  if (!rateLimit.allowed) return Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Analytics limit reached." } }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid analytics payload." } }, { status: 422 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid analytics payload." } }, { status: 422 });

  if (db) {
    try {
      await db.insert(analyticsEvents).values({
        profileId: null,
        eventName: parsed.data.eventName,
        properties: parsed.data.properties,
      });
    } catch {
      return Response.json({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE", message: "Analytics is temporarily unavailable." } }, { status: 503 });
    }
  }

  return Response.json({ ok: true, data: { accepted: true } }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
