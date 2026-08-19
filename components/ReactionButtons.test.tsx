import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactionButtons } from "./ReactionButtons";

vi.mock("@/app/actions", () => ({
  setReactionAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  setBookmarkAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

const baseProps = {
  roastId: "roast-123",
  fairCount: 5,
  funnyCount: 2,
  bookmarkCount: 1,
};

describe("ReactionButtons", () => {
  it("renders default counts and inactive state when no initialState is passed", () => {
    render(<ReactionButtons {...baseProps} />);

    const fairBtn = screen.getByRole("button", { name: /Fair 5/ });
    const funnyBtn = screen.getByRole("button", { name: /Funny 2/ });
    const saveBtn = screen.getByRole("button", { name: /Save 1/ });

    expect(fairBtn).toHaveAttribute("aria-pressed", "false");
    expect(funnyBtn).toHaveAttribute("aria-pressed", "false");
    expect(saveBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the exact button glyphs and labels", () => {
    render(<ReactionButtons {...baseProps} />);

    expect(screen.getByRole("button", { name: "◒ Fair 5" })).toBeVisible();
    expect(screen.getByRole("button", { name: "✦ Funny 2" })).toBeVisible();
    expect(screen.getByRole("button", { name: "◇ Save 1" })).toBeVisible();
  });

  it("hydrates with passed initialState (e.g. user already reacted Fair and Saved)", () => {
    render(
      <ReactionButtons
        {...baseProps}
        initialState={{ fair: true, funny: false, bookmarked: true }}
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
    render(<ReactionButtons {...baseProps} />);

    const funnyBtn = screen.getByRole("button", { name: /Funny 2/ });
    fireEvent.click(funnyBtn);

    expect(screen.getByRole("button", { name: /Funny 3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("optimistically toggles the bookmark count", () => {
    render(<ReactionButtons {...baseProps} initialState={{ fair: false, funny: false, bookmarked: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /Save 1/ }));

    expect(screen.getByRole("button", { name: /Save 0/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("forwards the roast id to the reaction action", async () => {
    const { setReactionAction } = await import("@/app/actions");
    render(<ReactionButtons {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Fair 5/ }));

    expect(setReactionAction).toHaveBeenCalledWith({
      roastId: "roast-123",
      kind: "FAIR",
      active: true,
    });
  });
});
