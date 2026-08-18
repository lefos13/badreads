import * as schema from "@/src/db/schema";

/*
 * Better Auth resolves model names against exported Drizzle schema keys. This
 * project keeps those exports plural while the physical PostgreSQL tables are
 * singular, so the adapter must opt into plural key resolution explicitly.
 */
export const authDatabaseOptions = {
  provider: "pg" as const,
  schema,
  usePlural: true as const,
};
