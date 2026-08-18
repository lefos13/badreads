import { describe, expect, it } from "vitest";
import { normalizeAppUrl, resolveAppUrl } from "./url-config";

/* Deployment variables are commonly created as empty placeholders; URL configuration must remain build-safe until real values are supplied. */
describe("URL configuration", () => {
  it("falls back when a deployment variable is blank", () => {
    expect(resolveAppUrl("").href).toBe("http://localhost:3000/");
  });

  it("falls back when a deployment variable is malformed", () => {
    expect(resolveAppUrl("not-a-url").href).toBe("http://localhost:3000/");
  });

  it("normalizes a valid URL for origin and auth configuration", () => {
    expect(normalizeAppUrl(" https://badreads.example.com/ ")).toBe("https://badreads.example.com");
  });
});
