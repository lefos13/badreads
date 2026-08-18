import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.trim();

function createDatabaseClient(): NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema> | null {
  if (!databaseUrl) return null;

  if (databaseUrl.includes("neon.tech") || databaseUrl.startsWith("https://")) {
    return drizzleNeon(neon(databaseUrl), { schema });
  }

  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzlePostgres(client, { schema });
}

export const db = createDatabaseClient();
