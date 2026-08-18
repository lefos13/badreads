import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModerationAuditLog } from "./ModerationAuditLog";
import type { ModerationAction } from "@/src/domain/types";

const mockActions: ModerationAction[] = [
  {
    id: "action-1",
    roastId: "roast-1",
    moderatorId: "mod-1",
    decision: "APPROVE",
    note: "Great critique.",
    createdAt: "2026-08-18T12:00:00.000Z",
  },
  {
    id: "action-2",
    roastId: "roast-2",
    moderatorId: "mod-1",
    decision: "REMOVE",
    note: "Violated community guidelines.",
    createdAt: "2026-08-18T13:00:00.000Z",
  },
];

describe("ModerationAuditLog", () => {
  it("renders moderation decisions, decision badges, and notes", () => {
    render(<ModerationAuditLog actions={mockActions} />);

    expect(screen.getByText("APPROVE")).toHaveClass("decision-positive");
    expect(screen.getByText("REMOVE")).toHaveClass("decision-negative");
    expect(screen.getByText(/Great critique/)).toBeVisible();
    expect(screen.getByText(/Violated community guidelines/)).toBeVisible();
  });

  it("handles empty audit actions list", () => {
    render(<ModerationAuditLog actions={[]} />);
    expect(screen.getByText(/No recorded moderation actions yet/)).toBeVisible();
  });
});
