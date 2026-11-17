import fs from "node:fs";
import { randomBytes } from "node:crypto";
import * as webpush from "web-push";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const keys = webpush.generateVAPIDKeys();
const values = {
  CRON_SECRET: process.env.CRON_SECRET || randomBytes(32).toString("hex"),
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || keys.publicKey,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || keys.privateKey,
};
if (
  Boolean(process.env.VAPID_PUBLIC_KEY) !==
  Boolean(process.env.VAPID_PRIVATE_KEY)
)
  throw new Error("Both VAPID keys must be configured together.");
const lines = Object.entries(values)
  .filter(([key]) => !process.env[key])
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");
if (lines) fs.appendFileSync(".env.local", `\n${lines}\n`);
console.log(
  "Push keys and scheduler secret are configured in .env.local (values hidden). Keep these keys stable across releases.",
);
