import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "start", ...args],
  { stdio: "inherit", env: process.env },
);
const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
const port =
  portIndex >= 0 ? args[portIndex + 1] : (process.env.PORT ?? "3000");
let running = false;
async function tick() {
  if (
    running ||
    !process.env.CRON_SECRET ||
    process.env.RUN_BACKGROUND_JOBS === "0"
  )
    return;
  running = true;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/internal/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok)
      console.error(
        `Background jobs returned ${response.status}; retrying next minute.`,
      );
  } catch {
    console.error("Background jobs waiting for the app; retrying next minute.");
  } finally {
    running = false;
  }
}
const timer = setInterval(tick, 60000);
const initial = setTimeout(tick, 5000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    clearTimeout(initial);
    child.kill(signal);
  });
child.on("exit", (code) => {
  clearInterval(timer);
  clearTimeout(initial);
  process.exitCode = code ?? 0;
});
