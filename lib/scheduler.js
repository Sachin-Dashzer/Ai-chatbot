// Daily jobs (India time by default): 12 & 4 PM batches, 6 PM check-in, 7 PM reminder, 8:30 AM brief.
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
  s.batchTimes.split(",").map((x) => x.trim()).filter(Boolean).forEach((t, i) => at(t, `batch${i}`, () => bot.runBatch()));
  at(s.checkinTime, "checkin", () => bot.runCheckin());
  at(s.nudgeTime, "nudge", () => bot.runNudge());
  at(s.briefTime, "brief", () => bot.runBrief());
  console.log(`[ankit-desk] scheduler on: batches ${s.batchTimes}, check-in ${s.checkinTime}, nudge ${s.nudgeTime}, brief ${s.briefTime} (${s.workDays}, ${s.timezone})`);
}
