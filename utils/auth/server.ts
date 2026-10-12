import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const authSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production");
}

export const auth = betterAuth({
  appName: "Lumium",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: authSecret ?? "lumium-local-development-secret-only-32chars",
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [nextCookies()],
});