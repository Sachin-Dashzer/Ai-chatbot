// Runs once when the Next.js server starts: switch on the daily scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler.js");
    startScheduler();
  }
}
