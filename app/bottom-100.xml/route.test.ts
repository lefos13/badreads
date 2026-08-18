import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /bottom-100.xml", () => {
  it("returns valid RSS 2.0 XML with the Bottom 100 ranking", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const xml = await response.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" ?>');
    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<title>Badreads — The Bottom 100</title>");
  });
});
