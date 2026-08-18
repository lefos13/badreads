import { db } from "@/src/db";

if (!db) {
  console.log("DATABASE_URL is not configured; demo data remains in memory for local development.");
} else {
  console.log("Database connection is ready. Seed records can be imported from the curated launch set.");
}
