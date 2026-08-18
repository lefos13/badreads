import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedFilterBar } from "./FeedFilterBar";

describe("FeedFilterBar", () => {
  it("renders all filter options and marks active state", () => {
    render(<FeedFilterBar currentFlaw="PROSE" />);

    const proseLink = screen.getByRole("link", { name: "PROSE" });
    const allLink = screen.getByRole("link", { name: "All verdicts" });

    expect(proseLink).toHaveClass("sort-pill-active");
    expect(allLink).not.toHaveClass("sort-pill-active");
  });

  it("marks All verdicts as active when no filter is selected", () => {
    render(<FeedFilterBar />);

    const allLink = screen.getByRole("link", { name: "All verdicts" });
    expect(allLink).toHaveClass("sort-pill-active");
  });
});
