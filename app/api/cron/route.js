// One URL for every scheduled job, for hosts that freeze the process between requests (Vercel,
// Lambda), where node-cron can never fire. Point any external cron at it every 5 minutes:
//   GET /api/cron?token=WA_VERIFY_TOKEN
// It runs whatever is due in the configured time zone and claims each slot in the store first, so
// a retry or an overlapping hit cannot send the same message twice. That makes a slot at-most-once:
// a job that throws half way is reported in `failed` and logged, and is not retried that day.
import { getBot } from "../../../lib/runtime.js";
import { parts } from "../../../lib/time.js";
import { cronDays } from "../../../lib/scheduler.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// A slot still fires if its time passed within this many minutes, so a late cron (or an hourly one)
// catches up instead of losing the day.
const WINDOW_MIN = 59;
const DAY_NUM = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// ponytail: week-wrapping ranges ("sat-sun") are not handled, exactly like the cron spec node-cron
// is given. Fine for "mon-sat"; list days individually ("sat,sun") if you ever need the wrap.
function isWorkday(spec, dayNum) {
  return cronDays(spec).split(",").some((part) => {
    const [from, to = from] = part.split("-").map(Number);
    return dayNum >= from && dayNum <= to;
  });
}

export async function GET(req) {
  const bot = getBot();
  const s = bot.s;
  const secret = process.env.CRON_SECRET || s.waVerifyToken;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (new URL(req.url).searchParams.get("token") !== s.waVerifyToken && bearer !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  // An always-on host runs these from node-cron already; doing both would send everything twice.
  if (globalThis.__ankitDeskCron) return Response.json({ ran: [], note: "in-process scheduler is running" });

  const now = parts(bot.now(), s.timezone);
  if (!isWorkday(s.workDays, DAY_NUM[now.weekday])) {
    return Response.json({ ran: [], note: `not a work day (${s.workDays})` });
  }

  const slots = [
    ...s.batchTimes.split(",").map((t) => [t.trim(), "batch"]),
    [s.checkinTime, "checkin"], [s.nudgeTime, "nudge"], [s.briefTime, "brief"],
  ].filter(([t]) => t);
  const jobs = { batch: () => bot.runBatch(), checkin: () => bot.runCheckin(), nudge: () => bot.runNudge(), brief: () => bot.runBrief() };

  const date = bot.today();
  const ran = [], failed = [];
  for (const [hhmm, job] of slots) {
    const [h, m] = hhmm.split(":").map(Number);
    const late = now.H * 60 + now.M - (h * 60 + m);
    if (late < 0 || late > WINDOW_MIN) continue;
    const key = `${job}@${hhmm}`;
    if (await bot.store.findOne("job_runs", { date, key })) continue;
    try {
      await bot.store.insert("job_runs", { date, key, at: bot.nowIso() });
    } catch {
      continue; // a parallel hit claimed this slot (unique index on date+key)
    }
    try {
      await jobs[job]();
      ran.push(key);
    } catch (e) {
      console.error(`[ankit-desk] cron ${key} failed`, e);
      failed.push(key);
    }
  }
  return Response.json({ ran, failed, at: bot.nowIso() });
}

export const POST = GET;
