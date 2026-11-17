// Runs once when the Next.js server starts: switch on the daily scheduler.
export async function register() {
  // The import below must stay inside this positive check: Next compiles this file for the edge
  // runtime too, and only a statically false `if` keeps mongodb (and its node-only deps) out of
  // that bundle. An early `return` instead leaves the import reachable and the edge build fails.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Serverless hosts freeze the process between requests, so node-cron would never fire.
    // There, run the jobs from the host's own scheduler instead:
    //   POST /api/admin/run/{pending|checkin|nudge|brief}?token=WA_VERIFY_TOKEN
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NO_CRON === "1") {
      console.warn("[ankit-desk] serverless host detected – node-cron is off. Point an external cron at GET /api/cron?token=WA_VERIFY_TOKEN every 5 minutes.");
      return;
    }
    // A scheduler that cannot start must never take the web boards down with it.
    try {
      const { startScheduler } = await import("./lib/scheduler.js");
      startScheduler();
    } catch (e) {
      console.error("[ankit-desk] scheduler did not start:", e);
    }
  }
}
