import { SignInForm } from "@/components/SignInForm";
import { isDemoMode } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <main className="page-width"><SignInForm demoMode={isDemoMode()} registrationEnabled={process.env.REGISTRATION_ENABLED !== "false"} /></main>;
}
