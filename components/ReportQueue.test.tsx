import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportQueue } from "./ReportQueue";
import type { ReportWithContext } from "@/src/domain/types";

const mockResolve = vi.fn().mockResolvedValue({ ok: true, data: {} });

vi.mock("@/app/actions", () => ({
  resolveReportAction: (...args: unknown[]) => mockResolve(...args),
}));

const mockReports: ReportWithContext[] = [
  {
    id: "report-1",
    roastId: "roast-1",
    reporterId: "profile-reporter",
    category: "PERSONAL_ATTACK",
    note: "This critique attacks the author's family.",
    status: "OPEN",
    createdAt: "2026-08-18T00:00:00.000Z",
    roast: {
      hook: "Personal insult hook.",
      body: "Unacceptable personal attacks rather than book receipts.",
      rating: 5,
      spoiler: false,
      authorHandle: "angry_reviewer",
      bookTitle: "Target Book",
      bookSlug: "target-book",
      status: "PUBLISHED",
    },
  },
];

describe("ReportQueue", () => {
  it("renders report category, reporter note, and the target roast context", () => {
    render(<ReportQueue reports={mockReports} />);

    expect(screen.getByText(/PERSONAL ATTACK/)).toBeVisible();
    expect(screen.getByText(/This critique attacks the author's family/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Personal insult hook." })).toBeVisible();
    expect(screen.getByText(/angry_reviewer/)).toBeVisible();
    expect(screen.getByText(/Target Book/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Uphold + hide" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeVisible();
  });

  it("handles empty report queue", () => {
    render(<ReportQueue reports={[]} />);
    expect(screen.getByText(/No open reports/)).toBeVisible();
  });

  it("removes resolved report on uphold action", async () => {
    render(<ReportQueue reports={mockReports} />);

    const upholdBtn = screen.getByRole("button", { name: "Uphold + hide" });
    fireEvent.click(upholdBtn);

    expect(mockResolve).toHaveBeenCalledWith({
      reportId: "report-1",
      status: "UPHELD",
    });
    expect(await screen.findByText(/Report upheld; roast hidden/)).toBeVisible();
  });
});
