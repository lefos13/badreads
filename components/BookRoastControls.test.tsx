import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookRoastControls } from "./BookRoastControls";

describe("BookRoastControls", () => {
  it("renders sort options with active state", () => {
    render(
      <BookRoastControls
        bookSlug="the-alchemist"
        currentSort="savage"
        filteredCount={5}
        totalCount={5}
      />,
    );

    const savageLink = screen.getByRole("link", { name: "★ Most Savage (5★)" });
    expect(savageLink).toHaveClass("sort-pill-active");
  });

  it("renders active flaw filter banner and clear link when flaw is active", () => {
    render(
      <BookRoastControls
        bookSlug="the-alchemist"
        currentFlaw="PACING"
        currentSort="newest"
        filteredCount={2}
        totalCount={10}
      />,
    );

    expect(screen.getByText(/Filtering by PACING/)).toBeVisible();
    expect(screen.getByText(/(2 of 10)/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filter ✕" })).toHaveAttribute(
      "href",
      "/books/the-alchemist?sort=newest",
    );
  });
});
