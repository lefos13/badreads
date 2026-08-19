import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInForm } from "./SignInForm";

vi.mock("@/app/actions", () => ({
  requestDevBypassMagicLinkAction: vi.fn().mockResolvedValue({
    ok: true,
    url: "http://localhost:3000/api/auth/magic-link/verify?token=test123token&callbackURL=%2Fwrite",
    message: "Bypass magic link generated.",
  }),
}));

describe("SignInForm", () => {
  it("renders demo mode UI when demoMode is true", () => {
    render(<SignInForm demoMode={true} registrationEnabled={true} />);

    expect(screen.getByText(/Local demo \/ no email required/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue in local demo/i })).toBeInTheDocument();
  });

  it("renders email input and sends magic link without bypass button by default", () => {
    render(<SignInForm demoMode={false} registrationEnabled={true} />);

    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send me a magic link/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /1-Click Local DB Bypass \(Lefteris\)/i })).not.toBeInTheDocument();
  });

  it("renders dev bypass button only when allowDevBypass is true", () => {
    render(<SignInForm allowDevBypass={true} demoMode={false} registrationEnabled={true} />);

    expect(screen.getByRole("button", { name: /1-Click Local DB Bypass \(Lefteris\)/i })).toBeInTheDocument();
  });
  it("allows typing an email address", () => {
    render(<SignInForm demoMode={false} registrationEnabled={true} />);

    const emailInput = screen.getByLabelText(/Email address/i);
    fireEvent.change(emailInput, { target: { value: "lefterisevagelinos1996@gmail.com" } });
    expect(emailInput).toHaveValue("lefterisevagelinos1996@gmail.com");
  });
});
