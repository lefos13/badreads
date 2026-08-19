import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupportLinks, isSupportConfigured } from "./support-config";

describe("support configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns trimmed provider URLs and label when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_BMC_URL", "  https://buymeacoffee.com/badreads  ");
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "https://ko-fi.com/badreads");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_LABEL", "  Keep the roast alive  ");

    const links = getSupportLinks();

    expect(links).toEqual({
      bmcUrl: "https://buymeacoffee.com/badreads",
      kofiUrl: "https://ko-fi.com/badreads",
      label: "Keep the roast alive",
    });
    expect(isSupportConfigured(links)).toBe(true);
  });

  it("keeps configured providers while omitting blank values", () => {
    vi.stubEnv("NEXT_PUBLIC_BMC_URL", "https://buymeacoffee.com/badreads");
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_LABEL", "");

    const links = getSupportLinks();

    expect(links).toEqual({
      bmcUrl: "https://buymeacoffee.com/badreads",
      kofiUrl: undefined,
      label: "Keep the receipts honest",
    });
    expect(isSupportConfigured(links)).toBe(true);
  });

  it("uses the default label and reports no support providers when empty", () => {
    vi.stubEnv("NEXT_PUBLIC_BMC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "  ");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_LABEL", "  ");

    const links = getSupportLinks();

    expect(links).toEqual({
      bmcUrl: undefined,
      kofiUrl: undefined,
      label: "Keep the receipts honest",
    });
    expect(isSupportConfigured(links)).toBe(false);
  });
});
