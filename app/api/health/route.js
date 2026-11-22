// Liveness for the host, and — with the token — the one URL that answers "why did nothing
// go out?": which scheduler is actually running, what schedule it is running, whether today
// counts as a work day at all, and which slots have already fired.
//
//   GET /api/health                              -> {"ok":true}            (host healthcheck)
//   GET /api/health?token=WA_VERIFY_TOKEN        -> the whole picture
//
// The detail is behind the token because it names the schedule and the store; the bare check
// stays public and must never fail, so it answers before anything else is touched.
import { getBot } from "../../../lib/runtime.js";
import { parts } from "../../../lib/time.js";
import { isWorkday } from "../../../lib/scheduler.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  const token = process.env.WA_VERIFY_TOKEN || "";
  const given = new URL(req.url).searchParams.get("token");
  const secret = process.env.CRON_SECRET || token;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  // No token configured means no detail: an empty string must never unlock this.
  if (!token || (given !== token && bearer !== secret)) return Response.json({ ok: true });

  const out = { ok: true };
  try {
    const bot = getBot();
    const s = bot.s;
    const now = parts(bot.now(), s.timezone);
    // __ankitDeskCron is set by startScheduler(): on an always-on host (Railway) it is the
    // proof node-cron is live. On a serverless host instrumentation.js switches itself off
    // and /api/cron has to be hit from outside instead.
    const inProcess = Boolean(globalThis.__ankitDeskCron);
    const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NO_CRON === "1");
    out.now = bot.nowIso();
    out.timezone = s.timezone;
    out.scheduler = inProcess ? "in-process (node-cron)" : serverless ? "external cron must hit /api/cron" : "NOT RUNNING";
    out.workDays = s.workDays;
    out.workdayToday = isWorkday(s.workDays, now.weekday);
    out.slots = { pending: s.pendingTimes, review: s.reviewTime, nudge: s.nudgeTime, brief: s.briefTime };
    out.store = s.store;
    // Slots claimed by /api/cron today. node-cron does not claim them, so on an always-on
    // host this is empty by design — `scheduler` is the signal there, not this.
    const runs = await bot.store.find("job_runs", { date: bot.today() }, { sort: { id: 1 } });
    out.cronSlotsToday = runs.map((r) => `${r.key} at ${r.at.slice(11, 16)}`);
  } catch (e) {
    // A bot that cannot even be built is exactly what this endpoint exists to report.
    out.ok = false;
    out.error = String(e.message || e).slice(0, 300);
  }
  return Response.json(out);
}
