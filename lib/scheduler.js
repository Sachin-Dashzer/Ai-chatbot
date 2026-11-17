
import cron from "node-cron";
import { getBot } from "./runtime.js";

const DAY_NUM = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export function cronDays(spec) {
  // "mon-sat" -> "1-6", "mon,thu" -> "1,4"
  return spec.toLowerCase().split(",").map((part) => part.trim().split("-").map((d) => DAY_NUM[d.slice(0, 3)]).join("-")).join(",");
}

export function startScheduler() {
  if (globalThis.__ankitDeskCron) return;
  globalThis.__ankitDeskCron = true;
  const bot = getBot();
  const s = bot.s;
  const days = cronDays(s.workDays);
  const at = (hhmm, name, fn) => {
    const [h, m] = hhmm.split(":").map(Number);
    cron.schedule(`${m} ${h} * * ${days}`, async () => {
      try { await fn(); } catch (e) { console.error(`[ankit-desk] job ${name} failed`, e); }
    }, { timezone: s.timezone });
  };
  s.pendingTimes.split(",").map((x) => x.trim()).filter(Boolean).forEach((t, i) => at(t, `pending${i}`, () => bot.runPending()));
  at(s.reviewTime, "review", () => bot.runReview());
  at(s.nudgeTime, "nudge", () => bot.runNudge());
  at(s.briefTime, "brief", () => bot.runBrief());
  // Every minute, every day: the one job that is not a fixed daily slot. A task due at
  // 9 PM is due at 9 PM, work day or not.
  cron.schedule("* * * * *", async () => {
    try { await bot.runDue(); } catch (e) { console.error("[ankit-desk] job due failed", e); }
  }, { timezone: s.timezone });
  console.log(`[ankit-desk] scheduler on: pending lists ${s.pendingTimes}, review ${s.reviewTime}, nudge ${s.nudgeTime}, brief ${s.briefTime} (${s.workDays}, ${s.timezone})`);
}
