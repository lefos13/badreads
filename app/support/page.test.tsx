import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SupportPage from "./page";

describe("SupportPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders configured support providers with their outbound URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_BMC_URL", "https://buymeacoffee.com/badreads");
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "https://ko-fi.com/badreads");

    render(await SupportPage());

    expect(screen.getByRole("link", { name: "Support with Buy Me a Coffee" })).toHaveAttribute(
      "href",
      "https://buymeacoffee.com/badreads",
    );
    expect(screen.getByRole("link", { name: "Support with Ko-fi" })).toHaveAttribute(
      "href",
      "https://ko-fi.com/badreads",
    );
  });

  it("shows the coming-soon state when no provider is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_BMC_URL", "");
    vi.stubEnv("NEXT_PUBLIC_KOFI_URL", "");

    render(await SupportPage());

    expect(screen.getByRole("heading", { name: "Support coming soon" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Support with/ })).toBeNull();
  });
});
