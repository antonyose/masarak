import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { authRateLimitStorage } from "@/lib/auth-rate-limit";

function productionRequired(value: string | undefined, name: string, developmentFallback: string) {
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is required in production.`);
  return developmentFallback;
}

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
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customStorage: authRateLimitStorage,
  },
  trustedOrigins: [
    "https://masarak.live",
    "https://masarak-58p2ie82j-antonyoses-projects.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  secret: productionRequired(
    process.env.BETTER_AUTH_SECRET,
    "BETTER_AUTH_SECRET",
    "local-development-secret-only-32chars",
  ),
  baseURL: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BETTER_AUTH_URL || "https://masarak.live"),
});
