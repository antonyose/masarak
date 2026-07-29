import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }
  return drizzle(databaseUrl, { schema });
}
