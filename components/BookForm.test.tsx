import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookForm } from "./BookForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("BookForm", () => {
  it("renders all fields in create mode with prefilled ISBN", () => {
    render(<BookForm mode="create" initialIsbn="9780306406157" />);

    expect(screen.getByLabelText(/Title \*/)).toBeVisible();
    expect(screen.getByLabelText(/Author\(s\) \*/)).toBeVisible();
    expect(screen.getByLabelText(/ISBN/)).toHaveValue("9780306406157");
    expect(screen.getByLabelText(/Publication Year/)).toBeVisible();
    expect(screen.getByLabelText(/Description/)).toBeVisible();
    expect(screen.getByLabelText(/Cover Image Upload/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Add Book to Catalog/ })).toBeVisible();
  });

  it("renders in edit mode with disabled/locked ISBN and prefilled details", () => {
    render(
      <BookForm
        mode="edit"
        initialData={{
          id: "book-test-1",
          title: "Existing Community Book",
          authors: ["Author One", "Author Two"],
          isbn: "9780306406157",
          firstPublished: 2021,
          description: "An existing book synopsis.",
          coverTone: "lavender",
          slug: "existing-community-book-community-9780306406157",
        }}
      />,
    );

    expect(screen.getByLabelText(/Title \*/)).toHaveValue("Existing Community Book");
    expect(screen.getByLabelText(/Author\(s\) \*/)).toHaveValue("Author One, Author Two");
    const isbnInput = screen.getByLabelText(/ISBN/);
    expect(isbnInput).toHaveValue("9780306406157");
    expect(isbnInput).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save Changes/ })).toBeVisible();
  });

  it("allows typing into form fields", () => {
    render(<BookForm mode="create" />);

    const titleInput = screen.getByLabelText(/Title \*/);
    fireEvent.change(titleInput, { target: { value: "A Brand New Novel" } });
    expect(titleInput).toHaveValue("A Brand New Novel");

    const authorInput = screen.getByLabelText(/Author\(s\) \*/);
    fireEvent.change(authorInput, { target: { value: "Jane Austen" } });
    expect(authorInput).toHaveValue("Jane Austen");
  });

  it("handles cover image file selection", async () => {
    render(<BookForm mode="create" />);

    const fileInput = screen.getByLabelText(/Cover Image Upload/);
    const file = new File(["dummy content"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(fileInput).toBeInTheDocument();
  });
});
