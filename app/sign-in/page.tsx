import { SignInForm } from "@/components/SignInForm";
import { isDemoMode } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const isProduction = process.env.NODE_ENV === "production";
  const allowDevBypass = !isProduction && process.env.ALLOW_DEV_AUTH_BYPASS === "true";
  return (
    <main className="page-width">
      <SignInForm
        allowDevBypass={allowDevBypass}
        demoMode={isDemoMode()}
        registrationEnabled={process.env.REGISTRATION_ENABLED !== "false"}
      />
    </main>
  );
}
