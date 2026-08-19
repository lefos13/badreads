import { describe, expect, it } from "vitest";
import {
  BYPASS_DEMO_EMAILS,
  isBypassEmail,
  getLatestDevMagicLink,
  setLatestDevMagicLink,
} from "./auth";

describe("auth bypass configuration", () => {
  it("identifies lefterisevagelinos1996@gmail.com as a bypass email", () => {
    expect(BYPASS_DEMO_EMAILS).toContain("lefterisevagelinos1996@gmail.com");
    expect(isBypassEmail("lefterisevagelinos1996@gmail.com")).toBe(true);
    expect(isBypassEmail("LEFTERISEVAGELINOS1996@GMAIL.COM")).toBe(true);
    expect(isBypassEmail("  lefterisevagelinos1996@gmail.com  ")).toBe(true);
  });

  it("identifies non-bypass emails correctly", () => {
    expect(isBypassEmail("random@example.com")).toBe(false);
  });

  it("stores and retrieves latest dev magic link", () => {
    const testEmail = "lefterisevagelinos1996@gmail.com";
    const testUrl = "http://localhost:3000/api/auth/magic-link/verify?token=abc123xyz&callbackURL=%2Fwrite";

    setLatestDevMagicLink(testEmail, testUrl, "abc123xyz");

    const retrieved = getLatestDevMagicLink(testEmail);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe(testEmail);
    expect(retrieved?.url).toBe(testUrl);
    expect(retrieved?.token).toBe("abc123xyz");

    const latest = getLatestDevMagicLink();
    expect(latest?.url).toBe(testUrl);
  });
});
