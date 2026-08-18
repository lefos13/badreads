import { describe, expect, it } from "vitest";
import { accounts, sessions, users, verifications } from "@/src/db/schema";
import { authDatabaseOptions } from "./auth-database";

/*
 * Keep the Better Auth adapter contract explicit at the Drizzle boundary so
 * table-key renames and type drift fail in a fast, dependency-free test.
 */
describe("Better Auth database contract", () => {
  it("resolves the plural Drizzle schema exports", () => {
    expect(authDatabaseOptions.usePlural).toBe(true);
    expect(authDatabaseOptions.schema.users).toBe(users);
    expect(authDatabaseOptions.schema.sessions).toBe(sessions);
    expect(authDatabaseOptions.schema.accounts).toBe(accounts);
    expect(authDatabaseOptions.schema.verifications).toBe(verifications);
  });

  it("stores email verification as a required boolean with a default", () => {
    expect(users.emailVerified.getSQLType()).toBe("boolean");
    expect(users.emailVerified.notNull).toBe(true);
    expect(users.emailVerified.hasDefault).toBe(true);
  });
});
