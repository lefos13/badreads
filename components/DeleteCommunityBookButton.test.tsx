import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeleteCommunityBookButton } from "./DeleteCommunityBookButton";
import * as actions from "@/app/actions";

vi.mock("@/app/actions", () => ({
  deleteCommunityBookAction: vi.fn(),
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe("DeleteCommunityBookButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders delete button with label", () => {
    render(<DeleteCommunityBookButton bookId="book-1" bookTitle="Test Book" />);
    expect(screen.getByRole("button", { name: /delete book entry/i })).toBeVisible();
  });

  it("prompts confirmation and deletes book on confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(actions.deleteCommunityBookAction).mockResolvedValue({
      ok: true,
      message: "Community book entry deleted.",
    });

    render(<DeleteCommunityBookButton bookId="book-1" bookTitle="Test Book" redirectUrl="/community" />);
    const button = screen.getByRole("button", { name: /delete book entry/i });
    fireEvent.click(button);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Test Book"));
    expect(actions.deleteCommunityBookAction).toHaveBeenCalledWith("book-1");
  });

  it("does not call delete action if confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DeleteCommunityBookButton bookId="book-1" bookTitle="Test Book" />);
    const button = screen.getByRole("button", { name: /delete book entry/i });
    fireEvent.click(button);

    expect(window.confirm).toHaveBeenCalled();
    expect(actions.deleteCommunityBookAction).not.toHaveBeenCalled();
  });
});
