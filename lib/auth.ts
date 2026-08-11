import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "@/db/client";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDatabase(), {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder-client-secret",
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-build-time-only-32chars",
  baseURL: process.env.BETTER_AUTH_URL || "https://masarak.live",
});
