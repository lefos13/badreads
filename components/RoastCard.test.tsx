import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoastCard } from "./RoastCard";

describe("RoastCard", () => {
  it("renders user text as text instead of interpreting HTML", () => {
    render(<RoastCard roast={{
      id: "roast-xss",
      bookId: "book-x",
      authorId: "profile-x",
      author: { id: "profile-x", handle: "reader", displayName: "Reader", bio: "" },
      hook: "<script>alert(1)</script>",
      body: "Evidence that stays text and cannot execute even when a reader submits a script-looking payload.",
      rating: 5,
      flawTags: ["OTHER"],
      spoiler: false,
      createdAt: "2026-08-18T00:00:00.000Z",
      updatedAt: "2026-08-18T00:00:00.000Z",
      fairCount: 0,
      funnyCount: 0,
      bookmarkCount: 0,
      status: "PUBLISHED",
    }} bookTitle="A Book" />);

    expect(screen.getByRole("heading", { name: "<script>alert(1)</script>" })).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
  });
});
