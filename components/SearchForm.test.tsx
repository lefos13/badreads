import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Counts how many times the scanner module is actually evaluated, so we can
// prove the heavy @zxing/library chunk is only pulled in on user intent.
const scannerModule = vi.hoisted(() => ({ loads: 0 }));
vi.mock("./IsbnScannerModal", async (importOriginal) => {
  scannerModule.loads += 1;
  return await importOriginal<typeof import("./IsbnScannerModal")>();
});

// Let any pending dynamic-import promises settle.
async function flushDynamicImport() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("SearchForm", () => {
  it("renders search input, camera scan button, and submit button without loading the scanner", () => {
    render(<SearchForm initialQuery="Alchemist" />);

    expect(screen.getByRole("searchbox", { name: /Search books/ })).toHaveValue("Alchemist");
    expect(screen.getByRole("button", { name: /Scan book ISBN/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
    expect(scannerModule.loads).toBe(0);
  });

  it("preloads the scanner chunk on pointer enter without mounting it", async () => {
    render(<SearchForm />);

    expect(scannerModule.loads).toBe(0);

    fireEvent.pointerEnter(screen.getByRole("button", { name: /Scan book ISBN/ }));
    await flushDynamicImport();

    expect(scannerModule.loads).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens scanner modal when camera button is clicked", async () => {
    render(<SearchForm />);

    fireEvent.click(screen.getByRole("button", { name: /Scan book ISBN/ }));

    expect(await screen.findByRole("dialog", { name: /Scan Book ISBN/ })).toBeVisible();
  });

  it("preloads on focus without opening the scanner", async () => {
    render(<SearchForm />);

    fireEvent.focus(screen.getByRole("button", { name: /Scan book ISBN/ }));
    await flushDynamicImport();

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
