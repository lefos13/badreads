import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/lib/auth";
import { getAuthRuntimeMode, hasEmailDeliveryConfig, isDemoMode } from "@/src/lib/runtime-config";

const handlers = toNextJsHandler(auth);

/*
 * Registration can be paused during moderation incidents without taking down
 * public reading or invalidating existing sessions. Only the magic-link issue
 * endpoint is blocked; verification and session reads continue to work.
 */

export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;

export async function POST(request: Request) {
  const isMagicLinkIssue = new URL(request.url).pathname.endsWith("/sign-in/magic-link");
  if (isMagicLinkIssue && process.env.REGISTRATION_ENABLED === "false") {
    return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "Registration is currently paused." } }, { status: 403 });
  }
  if (isMagicLinkIssue && isDemoMode()) {
    return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "Magic-link sign-in is disabled in local demo mode. Use the demo access button." } }, { status: 403 });
  }
  if (isMagicLinkIssue && !hasEmailDeliveryConfig() && process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: `Magic-link delivery is not configured (${getAuthRuntimeMode()} mode).` } }, { status: 503 });
  }
  return handlers.POST(request);
}
