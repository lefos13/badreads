import "dotenv/config";
import { db } from "@/src/db";

if (!db) {
  process.stdout.write("DATABASE_URL is not configured; demo data remains in memory for local development.\n");
} else {
  process.stdout.write("Database connection is ready. Seed records can be imported from the curated launch set.\n");
}
