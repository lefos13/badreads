import { describe, expect, it } from "vitest";
import { launchSeed } from "./launch-seed";

describe("launch seed", () => {
  it("contains the curated public surface with stable unique identifiers", () => {
    expect(launchSeed.books).toHaveLength(4);
    expect(launchSeed.profiles).toHaveLength(4);
    expect(launchSeed.roasts).toHaveLength(4);

    for (const records of [launchSeed.books, launchSeed.profiles, launchSeed.roasts]) {
      expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
      expect(records.every((record) => /^[0-9a-f-]{36}$/.test(record.id))).toBe(true);
    }
  });

  it("keeps every roast inside the public content contract", () => {
    const bookIds = new Set(launchSeed.books.map((book) => book.id));
    const profileIds = new Set(launchSeed.profiles.map((profile) => profile.id));

    for (const roast of launchSeed.roasts) {
      expect(bookIds.has(roast.bookWorkId)).toBe(true);
      expect(profileIds.has(roast.authorProfileId)).toBe(true);
      expect(roast.hook.length).toBeGreaterThanOrEqual(10);
      expect(roast.hook.length).toBeLessThanOrEqual(140);
      expect(roast.body.length).toBeGreaterThanOrEqual(80);
      expect(roast.body.length).toBeLessThanOrEqual(3000);
      expect(roast.rating).toBeGreaterThanOrEqual(1);
      expect(roast.rating).toBeLessThanOrEqual(5);
      expect(roast.flawTags.length).toBeGreaterThanOrEqual(1);
      expect(roast.flawTags.length).toBeLessThanOrEqual(3);
    }
  });

  it("uses provider work IDs as stable catalog identifiers", () => {
    expect(new Set(launchSeed.books.map((book) => book.providerWorkId)).size).toBe(launchSeed.books.length);
    expect(new Set(launchSeed.books.map((book) => book.slug)).size).toBe(launchSeed.books.length);
    expect(launchSeed.books.every((book) => book.provider === "openlibrary")).toBe(true);
  });
});
