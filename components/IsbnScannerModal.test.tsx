import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IsbnScannerModal } from "./IsbnScannerModal";

describe("IsbnScannerModal", () => {
  it("renders modal header, close button, and manual input fallback", () => {
    const handleScan = vi.fn();
    const handleClose = vi.fn();

    render(<IsbnScannerModal onClose={handleClose} onScan={handleScan} />);

    expect(screen.getByRole("dialog", { name: /Scan Book ISBN/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Close barcode scanner/ })).toBeVisible();
    expect(screen.getByPlaceholderText(/type 10 or 13-digit ISBN/)).toBeVisible();
  });

  it("submits valid manual ISBN", () => {
    const handleScan = vi.fn();
    const handleClose = vi.fn();

    render(<IsbnScannerModal onClose={handleClose} onScan={handleScan} />);

    const input = screen.getByPlaceholderText(/type 10 or 13-digit ISBN/);
    fireEvent.change(input, { target: { value: "9780062315007" } });

    const submitBtn = screen.getByRole("button", { name: "Use ISBN" });
    fireEvent.click(submitBtn);

    expect(handleScan).toHaveBeenCalledWith("9780062315007");
  });

  it("closes modal on close button click", () => {
    const handleScan = vi.fn();
    const handleClose = vi.fn();

    render(<IsbnScannerModal onClose={handleClose} onScan={handleScan} />);

    const closeBtn = screen.getByRole("button", { name: /Close barcode scanner/ });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
