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
      body: "<img src=x onerror=alert(2)> Evidence that stays text and cannot execute even when a reader submits a script-looking payload.",
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
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText(
        "<img src=x onerror=alert(2)> Evidence that stays text and cannot execute even when a reader submits a script-looking payload.",
      ),
    ).toBeVisible();
  });

  it("passes only the reaction scalars to the client reaction buttons", () => {
    render(
      <RoastCard
        bookTitle="A Book"
        reactionState={{ fair: true, funny: false, bookmarked: false }}
        roast={{
          id: "roast-scalars",
          bookId: "book-1",
          authorId: "profile-1",
          author: { id: "profile-1", handle: "reader", displayName: "Reader", bio: "" },
          hook: "A memorable hook",
          body: "Evidence text describing the literary problems in detail at length.",
          rating: 3,
          flawTags: ["PACING"],
          spoiler: false,
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
          fairCount: 7,
          funnyCount: 3,
          bookmarkCount: 2,
          status: "PUBLISHED",
        }}
      />,
    );

    const fairBtn = screen.getByRole("button", { name: "◒ Fair 7" });
    expect(fairBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "✦ Funny 3" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "◇ Save 2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders imported web review source badge and external link when present", () => {
    render(
      <RoastCard
        bookTitle="The Da Vinci Code"
        roast={{
          id: "roast-source-test",
          bookId: "book-1",
          authorId: "profile-1",
          author: { id: "profile-1", handle: "reviewer", displayName: "Reviewer", bio: "" },
          hook: "A memorable hook",
          body: "Evidence text describing the literary problems in detail.",
          rating: 4,
          flawTags: ["PROSE"],
          spoiler: false,
          sourceLabel: "Goodreads 1-Star Archive",
          sourceUrl: "https://www.goodreads.com/book/show/968",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
          fairCount: 5,
          funnyCount: 2,
          bookmarkCount: 1,
          status: "PUBLISHED",
        }}
      />,
    );

    const sourceLink = screen.getByRole("link", { name: /goodreads 1-star archive ↗/i });
    expect(sourceLink).toBeVisible();
    expect(sourceLink).toHaveAttribute("href", "https://www.goodreads.com/book/show/968");
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
