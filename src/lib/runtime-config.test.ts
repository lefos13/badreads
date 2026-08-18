import { describe, expect, it } from "vitest";
import { getAuthRuntimeMode, hasEmailDeliveryConfig, isDemoMode } from "./runtime-config";

/*
 * These checks protect the boundary between the convenient local demo and
 * production authentication. A database alone must not make the app appear
 * ready for email sign-in, and a copied demo flag must not weaken production.
 */
describe("runtime authentication configuration", () => {
  it("keeps local demo mode available when Neon is configured without Resend", () => {
    const environment = { NODE_ENV: "development", DEMO_MODE: "true", RESEND_API_KEY: "", RESEND_FROM_EMAIL: "" };

    expect(isDemoMode(environment)).toBe(true);
    expect(hasEmailDeliveryConfig(environment)).toBe(false);
    expect(getAuthRuntimeMode(environment)).toBe("demo");
  });

  it("requires both Resend credentials before enabling email mode", () => {
    expect(getAuthRuntimeMode({ NODE_ENV: "development", DEMO_MODE: "false", RESEND_API_KEY: "key" })).toBe("unconfigured");
    expect(getAuthRuntimeMode({ NODE_ENV: "development", DEMO_MODE: "false", RESEND_FROM_EMAIL: "Badreads <onboarding@resend.dev>" })).toBe("unconfigured");
    expect(getAuthRuntimeMode({ NODE_ENV: "development", DEMO_MODE: "false", RESEND_API_KEY: "key", RESEND_FROM_EMAIL: "Badreads <onboarding@resend.dev>" })).toBe("email");
  });

  it("never enables demo mode in production", () => {
    const environment = { NODE_ENV: "production", DEMO_MODE: "true" };

    expect(isDemoMode(environment)).toBe(false);
    expect(getAuthRuntimeMode(environment)).toBe("unconfigured");
  });
});
