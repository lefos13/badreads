import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCard } from "./BookCard";

describe("BookCard", () => {
  const baseBook = {
    id: "book-1",
    slug: "the-alchemist",
    title: "The Alchemist",
    authors: ["Paulo Coelho"],
    firstPublished: 1988,
    description: "A shepherd follows omens.",
    coverTone: "acid" as const,
  };

  it("renders cover image when coverUrl is provided", () => {
    render(
      <BookCard
        book={{
          ...baseBook,
          coverUrl: "https://covers.openlibrary.org/b/id/8368314-M.jpg",
        }}
        average={4.2}
        roastCount={12}
      />,
    );

    const image = screen.getByRole("img", { name: "Cover of The Alchemist" });
    expect(image).toBeInTheDocument();
    expect(image).toHaveClass("book-cover-image");
  });

  it("renders fallback cover title without img when coverUrl is null", () => {
    render(
      <BookCard
        book={{
          ...baseBook,
          coverUrl: null,
        }}
        average={null}
        roastCount={0}
      />,
    );

    expect(screen.getByRole("heading", { name: "The Alchemist" })).toBeInTheDocument();
    expect(document.querySelector(".cover-title")?.textContent).toBe("The Alchemist");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders community-added badge when isCommunityAdded is true", () => {
    render(
      <BookCard
        book={{
          ...baseBook,
          isCommunityAdded: true,
        }}
      />,
    );

    expect(screen.getByText("✳ Community Added")).toBeInTheDocument();
  });
});
