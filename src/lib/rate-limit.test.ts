import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimits } from "./rate-limit";

describe("rate limits", () => {
  beforeEach(() => resetRateLimits());

  it("allows a bounded number of operations and reports remaining capacity", async () => {
    expect(await consumeRateLimit("test", 2, 60_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await consumeRateLimit("test", 2, 60_000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await consumeRateLimit("test", 2, 60_000)).toMatchObject({ allowed: false, remaining: 0 });
  });
});
