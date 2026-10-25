/**
 * Runs once when the server starts. Validates configuration and refuses to
 * start a production server that is unsafe to run (fail closed).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Build-time page-data collection also loads this file; only validate at runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkEnv } = await import("./lib/env-check");
  const { logger } = await import("./lib/logger");
  const { errors, warnings } = checkEnv(process.env);
  for (const w of warnings) logger.warn("config.warning", { message: w });
  if (!errors.length) return;
  for (const e of errors) logger.error("config.invalid", { message: e });
  if (process.env.NODE_ENV === "production") {
    console.error(`\nRefusing to start: ${errors.length} configuration problem(s). See the messages above and .env.example.\n`);
    process.exit(1);
  }
}
