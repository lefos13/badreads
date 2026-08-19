import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SearchForm", () => {
  it("renders search input, camera scan button, and submit button", () => {
    render(<SearchForm initialQuery="Alchemist" />);

    expect(screen.getByRole("searchbox", { name: /Search books/ })).toHaveValue("Alchemist");
    expect(screen.getByRole("button", { name: /Scan book ISBN/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeVisible();
  });

  it("opens scanner modal when camera button is clicked", () => {
    render(<SearchForm />);

    const cameraBtn = screen.getByRole("button", { name: /Scan book ISBN/ });
    fireEvent.click(cameraBtn);

    expect(screen.getByRole("dialog", { name: /Scan Book ISBN/ })).toBeVisible();
  });
});
