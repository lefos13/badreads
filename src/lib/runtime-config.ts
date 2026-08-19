/*
 * Keep deployment mode decisions in one server-safe module. Local demo mode
 * is useful when Neon is available but email delivery is not; production must
 * never become an unauthenticated demo because an environment variable was
 * omitted or copied from the local template.
 */

type RuntimeEnvironment = {
  NODE_ENV?: string;
  DEMO_MODE?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};
export function cleanEnvString(value?: string): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

export function isDemoMode(environment: RuntimeEnvironment = process.env) {
  if (environment.NODE_ENV === "production") return false;
  const demo = cleanEnvString(environment.DEMO_MODE);
  return demo !== "false";
}

export function hasEmailDeliveryConfig(environment: RuntimeEnvironment = process.env) {
  const apiKey = cleanEnvString(environment.RESEND_API_KEY);
  const from = cleanEnvString(environment.RESEND_FROM_EMAIL);
  return Boolean(apiKey && from);
}
export function getAuthRuntimeMode(environment: RuntimeEnvironment = process.env) {
  if (isDemoMode(environment)) return "demo" as const;
  return hasEmailDeliveryConfig(environment) ? "email" as const : "unconfigured" as const;
}
