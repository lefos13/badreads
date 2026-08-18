import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoastForm } from "./RoastForm";

vi.mock("@/app/actions", () => ({
  submitRoastAction: vi.fn().mockResolvedValue({ ok: true, roastId: "roast-new-123", message: "Roast published." }),
}));

describe("RoastForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders form fields, character limits, and rating radio buttons", () => {
    render(<RoastForm bookId="book-1" bookTitle="The Great Novel" />);

    expect(screen.getByLabelText("The hook")).toHaveAttribute("maxlength", "140");
    expect(screen.getByLabelText("The receipts")).toHaveAttribute("maxlength", "3000");
    expect(screen.getByRole("button", { name: "Publish the verdict" })).toBeVisible();
    expect(screen.getByText("0/140")).toBeVisible();
    expect(screen.getByText(/0\/3,000/)).toBeVisible();
  });

  it("limits flaw tag selection to a maximum of 3 tags", () => {
    render(<RoastForm bookId="book-1" bookTitle="The Great Novel" />);

    const pacing = screen.getByLabelText("PACING");
    const prose = screen.getByLabelText("PROSE");
    const plot = screen.getByLabelText("PLOT");
    const characters = screen.getByLabelText("CHARACTERS");

    fireEvent.click(pacing);
    fireEvent.click(prose);
    fireEvent.click(plot);
    expect(screen.getByText("3/3 selected")).toBeVisible();

    // 4th tag should be rejected
    fireEvent.click(characters);
    expect(screen.getByText("3/3 selected")).toBeVisible();
    expect(characters).not.toBeChecked();
  });

  it("restores draft from sessionStorage", () => {
    sessionStorage.setItem(
      "badreads_draft_book-1",
      JSON.stringify({
        hook: "A truly terrible book.",
        body: "Here is all the receipts and evidence about why this book failed so hard.",
        rating: 5,
        selectedTags: ["PROSE"],
      }),
    );

    render(<RoastForm bookId="book-1" bookTitle="The Great Novel" />);

    expect(screen.getByDisplayValue("A truly terrible book.")).toBeVisible();
    expect(
      screen.getByDisplayValue(
        "Here is all the receipts and evidence about why this book failed so hard.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/Draft restored from your browser session/)).toBeVisible();
  });
});
