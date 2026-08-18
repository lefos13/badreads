import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactionButtons } from "./ReactionButtons";
import type { Roast } from "@/src/domain/types";

vi.mock("@/app/actions", () => ({
  setReactionAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  setBookmarkAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

const mockRoast: Roast = {
  id: "roast-123",
  bookId: "book-1",
  authorId: "author-1",
  author: { id: "author-1", handle: "critic", displayName: "Critic", bio: "" },
  hook: "A hollow shell of a novel.",
  body: "The prose is wooden and the plot goes nowhere for three hundred pages.",
  rating: 4,
  flawTags: ["PROSE", "PLOT"],
  spoiler: false,
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
  fairCount: 5,
  funnyCount: 2,
  bookmarkCount: 1,
  status: "PUBLISHED",
};

describe("ReactionButtons", () => {
  it("renders default counts and inactive state when no initialState is passed", () => {
    render(<ReactionButtons roast={mockRoast} />);

    const fairBtn = screen.getByRole("button", { name: /Fair 5/ });
    const funnyBtn = screen.getByRole("button", { name: /Funny 2/ });
    const saveBtn = screen.getByRole("button", { name: /Save 1/ });

    expect(fairBtn).toHaveAttribute("aria-pressed", "false");
    expect(funnyBtn).toHaveAttribute("aria-pressed", "false");
    expect(saveBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("hydrates with passed initialState (e.g. user already reacted Fair and Saved)", () => {
    render(
      <ReactionButtons
        initialState={{ fair: true, funny: false, bookmarked: true }}
        roast={mockRoast}
      />,
    );

    const fairBtn = screen.getByRole("button", { name: /Fair 5/ });
    const funnyBtn = screen.getByRole("button", { name: /Funny 2/ });
    const saveBtn = screen.getByRole("button", { name: /Save 1/ });

    expect(fairBtn).toHaveAttribute("aria-pressed", "true");
    expect(fairBtn).toHaveClass("reaction-active");
    expect(funnyBtn).toHaveAttribute("aria-pressed", "false");
    expect(saveBtn).toHaveAttribute("aria-pressed", "true");
    expect(saveBtn).toHaveClass("reaction-active");
  });

  it("optimistically increments count and flips active state on click", () => {
    render(<ReactionButtons roast={mockRoast} />);

    const funnyBtn = screen.getByRole("button", { name: /Funny 2/ });
    fireEvent.click(funnyBtn);

    expect(screen.getByRole("button", { name: /Funny 3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
