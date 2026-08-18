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

export function isDemoMode(environment: RuntimeEnvironment = process.env) {
  if (environment.NODE_ENV === "production") return false;
  return environment.DEMO_MODE !== "false";
}

export function hasEmailDeliveryConfig(environment: RuntimeEnvironment = process.env) {
  return Boolean(environment.RESEND_API_KEY?.trim() && environment.RESEND_FROM_EMAIL?.trim());
}

export function getAuthRuntimeMode(environment: RuntimeEnvironment = process.env) {
  if (isDemoMode(environment)) return "demo" as const;
  return hasEmailDeliveryConfig(environment) ? "email" as const : "unconfigured" as const;
}
