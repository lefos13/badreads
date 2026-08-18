import { SignInForm } from "@/components/SignInForm";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <main className="page-width"><SignInForm demoMode={process.env.DEMO_MODE !== "false" && !process.env.DATABASE_URL} registrationEnabled={process.env.REGISTRATION_ENABLED !== "false"} /></main>;
}
