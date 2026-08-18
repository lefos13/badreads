import { describe, expect, it } from "vitest";
import { parseCSV, slugify } from "@/scripts/import-books";

describe("catalog importer helpers", () => {
  it("generates URL-safe, predictable slugs", () => {
    expect(slugify("The Da Vinci Code", "OL14933414W")).toBe("the-da-vinci-code-ol14933414w");
    expect(slugify("Tomorrow, and Tomorrow, and Tomorrow", "OL27192661W")).toBe(
      "tomorrow-and-tomorrow-and-tomorrow-ol27192661w",
    );
    expect(slugify("   Spaces & Symbols!   ", "OL123W")).toBe("spaces-symbols-ol123w");
    expect(slugify("", "OL99W")).toBe("book-ol99w");
  });

  it("parses CSV rows into BookImportItems correctly", () => {
    const csv = `title,authors,providerWorkId,firstPublished,description,coverTone,isbn
"The Great Book","Jane Doe; John Smith",OL12345W,2021,"A great description",acid,9780123456789
"Another Book","Solo Author",OL67890W,2019,"Another description",coral,9780987654321`;

    const items = parseCSV(csv);
    expect(items).toHaveLength(2);

    expect(items[0]).toEqual({
      title: "The Great Book",
      authors: ["Jane Doe", "John Smith"],
      providerWorkId: "OL12345W",
      firstPublished: 2021,
      description: "A great description",
      coverTone: "acid",
      isbn: "9780123456789",
    });

    expect(items[1]).toEqual({
      title: "Another Book",
      authors: ["Solo Author"],
      providerWorkId: "OL67890W",
      firstPublished: 2019,
      description: "Another description",
      coverTone: "coral",
      isbn: "9780987654321",
    });
  });

  it("handles empty and malformed CSV input gracefully", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("title,authors,providerWorkId")).toEqual([]);
  });
});
