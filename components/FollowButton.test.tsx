import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowButton } from "./FollowButton";

const mockSetFollow = vi.fn().mockResolvedValue({ ok: true, data: { active: true } });

vi.mock("@/app/actions", () => ({
  setFollowAction: (...args: unknown[]) => mockSetFollow(...args),
}));

describe("FollowButton", () => {
  it("renders 'Follow reviewer' when initialFollowing is false", () => {
    render(<FollowButton initialFollowing={false} profileId="profile-target" />);
    expect(screen.getByRole("button", { name: "Follow reviewer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Follow reviewer" })).toHaveClass("button-primary");
  });

  it("renders 'Following' when initialFollowing is true", () => {
    render(<FollowButton initialFollowing={true} profileId="profile-target" />);
    expect(screen.getByRole("button", { name: "Following" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Following" })).toHaveClass("button-quiet");
  });

  it("toggles following state on click", () => {
    render(<FollowButton initialFollowing={false} profileId="profile-target" />);

    const button = screen.getByRole("button", { name: "Follow reviewer" });
    fireEvent.click(button);

    expect(mockSetFollow).toHaveBeenCalledWith({
      followeeId: "profile-target",
      active: true,
    });
    expect(screen.getByRole("button", { name: "Following" })).toBeVisible();
  });
});
