import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareReceiptButton } from "./ShareReceiptButton";

describe("ShareReceiptButton", () => {
  it("renders the share button", () => {
    render(
      <ShareReceiptButton
        authorHandle="critic"
        bookTitle="A Bad Book"
        hook="Terrible plot."
        rating={5}
        roastId="roast-1"
      />,
    );

    expect(screen.getByRole("button", { name: "Share receipt for A Bad Book" })).toBeVisible();
    expect(screen.getByText("↗ Share")).toBeVisible();
  });

  it("copies quote to clipboard and changes state to Copied!", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ShareReceiptButton
        authorHandle="critic"
        bookTitle="A Bad Book"
        hook="Terrible plot."
        rating={5}
        roastId="roast-1"
      />,
    );

    const button = screen.getByRole("button", { name: "Share receipt for A Bad Book" });
    fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalled();
    expect(await screen.findByText("✓ Copied!")).toBeVisible();
  });

  it("uses navigator.share if available", () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      share: shareMock,
    });

    render(
      <ShareReceiptButton
        authorHandle="critic"
        bookTitle="A Bad Book"
        hook="Terrible plot."
        rating={5}
        roastId="roast-1"
      />,
    );

    const button = screen.getByRole("button", { name: "Share receipt for A Bad Book" });
    fireEvent.click(button);

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Badreads receipt: A Bad Book",
      }),
    );
  });
});
