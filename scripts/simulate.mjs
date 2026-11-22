// A full day of the bot, run on your laptop — no WhatsApp, no portal, no real database.
//
//   npm run simulate
//
// Ankit and a test team talk to the bot through a fake WhatsApp, the clock is moved through
// the day (9 AM → 7 PM) and every scheduled round runs (12 PM list, 5-minute reminders,
// 6 PM review, 7 PM brief). Each step is checked, and the whole day is written to
// simulation-report.html: every message exactly as it would look on the phone, with a
// PASS/FAIL under it.
//
// With OPENAI_API_KEY in .env the REAL parser and Love's real replies are used, so this also
// checks the prompts. Without it, the test suite's fake AI is used (format checks only).
// Nothing is ever sent to a real number and nothing touches MongoDB.

import { writeFileSync } from "node:fs";
import { Directory, loadSettings } from "../lib/config.js";
import { MemoryStore } from "../lib/store/memory.js";
import { Bot } from "../lib/bot.js";
import { AI } from "../lib/ai.js";
import { FakeAI } from "../tests/helpers.js";

const TZ_OFFSET = "+05:30";
const OWNER = "910000000001", SACHIN = "910000000002", PRAVEEN = "910000000003", MANISH = "910000000004";
const NAMES = { [OWNER]: "Ankit", [SACHIN]: "Sachin", [PRAVEEN]: "Praveen", [MANISH]: "Manish" };

// ---------------------------------------------------------------- fake WhatsApp
// Records everything, and answers like Meta does (a message id per send), so the bot's
// "which message did he swipe-reply to" memory works exactly as in production.
let wamidN = 0;
class SimWA {
  constructor() { this.sent = []; }
  _ok(entry) {
    const id = `wamid.SIM${++wamidN}`;
    this.sent.push({ ...entry, wamid: id, at: clock.label() });
    return new Response(JSON.stringify({ messages: [{ id }] }));
  }
  async sendText(to, body) { return this._ok({ kind: "text", to, body }); }
  async sendButtons(to, body, buttons) { return this._ok({ kind: "buttons", to, body, buttons }); }
  async sendTemplate(to, name, params = []) { return this._ok({ kind: "template", to, name, params }); }
  async downloadMedia() { throw new Error("voice notes are not simulated"); }
}

// ---------------------------------------------------------------- virtual clock (IST)
const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const clock = {
  t: new Date(`${today}T09:00:00${TZ_OFFSET}`),
  set(hhmm) { this.t = new Date(`${today}T${hhmm}:00${TZ_OFFSET}`); },
  label() { return this.t.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }); },
};

// ---------------------------------------------------------------- the bot
const settings = { ...loadSettings(process.env), store: "memory" };
const directory = new Directory({
  owner: { name: "Ankit", phone: OWNER },
  people: [
    { name: "Sachin", phone: SACHIN, does: "CRM, websites, domains and hosting" },
    { name: "Praveen", phone: PRAVEEN, aliases: ["CA Praveen"], does: "client visits, notices and rejoinders" },
    { name: "Manish", phone: MANISH, does: "Tally data and reconciliations" },
  ],
});
// Without an OpenAI key: a stand-in that answers this script's sentences the way the model
// does — including the model's habit of putting "4 pm" on TOMORROW, so the bot's own
// today-fix is really exercised. Everything else falls back to the test suite's fake.
const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
class SimAI extends FakeAI {
  async parseOwner(text, openTasks = [], now = "", memory = "", meetings = [], closed = []) {
    if (/Sachin update the CRM/i.test(text)) return { tasks: [
      { owner: "Sachin", task: "Update the CRM templates" },
      { owner: "Sachin", task: "Register the Dream City domain" },
      { owner: "Praveen", task: "Collect the Saltoris rejoinder" },
    ] };
    if (/meeting with Manish at 4/i.test(text)) return { meetings: [{ title: null, with: ["Manish"], at: `${tomorrow}T16:00`, note: null }] };
    if (/Change the Manish meeting/i.test(text) && meetings.length) return { moves: [{ meeting_id: meetings[0].id, at: `${tomorrow}T17:00` }] };
    if (/Manish recover the pending fees/i.test(text)) return { tasks: [{ owner: "Manish", task: "Recover the pending fees from Sharma ji", category: "payment" }] };
    if (/meeting with Manish tomorrow at 11/i.test(text)) return { meetings: [{ title: "Month-end planning", with: ["Manish"], at: `${tomorrow}T11:00`, note: null }] };
    if (/Remind me at 6 pm to call Sharma ji/i.test(text)) return { tasks: [{ owner: "Ankit", task: "Call Sharma ji", due_at: `${tomorrow}T18:00` }] };
    if (/^hii?$/i.test(text.trim())) return { chat: true };
    return super.parseOwner(text, openTasks, now, memory, meetings, closed);
  }
  async chat() { return "Good morning, Ankit. How can I help you today?"; }
}

const realAI = Boolean(settings.openaiApiKey);
const wa = new SimWA();
const bot = new Bot({ settings, store: new MemoryStore(), wa, ai: realAI ? new AI(settings, directory) : new SimAI(), directory, now: () => clock.t });

// ---------------------------------------------------------------- steps and checks
let n = 0;
const timeline = [];
const msg = (from, body, extra = {}) => ({ from, id: `sim${++n}`, type: "text", text: { body }, ...extra });
const tap = (from, id) => ({ from, id: `sim${++n}`, type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: "tap" } } });

async function step(title, hhmm, action, checks = []) {
  clock.set(hhmm);
  const before = wa.sent.length;
  let error = null, input = null;
  try { input = await action(); } catch (e) { error = e; }
  const out = wa.sent.slice(before);
  const results = [];
  for (const [label, fn] of checks) {
    let ok = false, why = "";
    try { ok = Boolean(await fn(out)); } catch (e) { why = e.message; }
    results.push({ label, ok, why });
  }
  if (error) results.unshift({ label: "step ran without an error", ok: false, why: error.stack || String(error) });
  timeline.push({ title, at: clock.label(), input, out, results });
  const bad = results.filter((r) => !r.ok);
  console.log(`${bad.length ? "✗" : "✓"} ${clock.label()}  ${title}` + (bad.length ? `\n    ${bad.map((b) => `FAIL: ${b.label}${b.why ? ` (${b.why.split("\n")[0]})` : ""}`).join("\n    ")}` : ""));
}

const toAnkit = (out) => out.filter((m) => m.to === OWNER);
const body = (m) => (m.kind === "template" ? `[template ${m.name}] ${m.params.join(" · ")}` : m.body || "");
const ankitSays = (out) => toAnkit(out).map(body).join("\n\n");
const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);
const noEmojiHearts = (s) => !s.includes("💛");
const todayStr = (iso) => iso && iso.slice(0, 10) === today;
const say = (from, text, extra) => async () => { await bot.handleMessage(msg(from, text, extra)); return { from, text }; };

// ---------------------------------------------------------------- the day
await step("Ankit says hi", "09:00", say(OWNER, "Hii"), [
  ["Love answers (no 'couldn't tell who this is for')", (o) => toAnkit(o).length && !/couldn.t tell/i.test(ankitSays(o))],
  ["reply is in English, no Devanagari", (o) => !hasDevanagari(ankitSays(o))],
  ["no 💛 in a professional reply", (o) => noEmojiHearts(ankitSays(o))],
]);

await step("Ankit assigns work to two people", "09:02",
  say(OWNER, "Sachin update the CRM templates and register the Dream City domain. Praveen collect the Saltoris rejoinder."), [
  ["Ankit gets an '📋 Assigned' confirmation", (o) => /Assigned/.test(ankitSays(o))],
  ["Sachin receives his task(s) with Done/Working/Remark buttons", (o) => o.some((m) => m.to === SACHIN && (m.kind === "buttons" || m.kind === "template"))],
  ["Praveen receives his task", (o) => o.some((m) => m.to === PRAVEEN)],
  ["at least 3 open tasks now", async () => (await bot.openTasks()).length >= 3],
]);

await step("Ankit books a meeting with no day named", "09:05", say(OWNER, "Set a meeting with Manish at 4 pm"), [
  ["'Meeting scheduled' confirmation", (o) => /Meeting scheduled/i.test(ankitSays(o))],
  ["meeting is TODAY, not tomorrow", async () => todayStr((await bot.upcomingMeetings())[0]?.at)],
  ["Manish is invited", (o) => o.some((m) => m.to === MANISH)],
]);

await step("Ankit reschedules it", "09:07", say(OWNER, "Change the Manish meeting time to 5 PM"), [
  ["'Meeting rescheduled' (not a delete card)", (o) => /rescheduled/i.test(ankitSays(o)) && !/Delete these/i.test(ankitSays(o))],
  ["still exactly one meeting", async () => (await bot.upcomingMeetings()).length === 1],
  ["it is today at 17:00", async () => (await bot.upcomingMeetings())[0]?.at.startsWith(`${today}T17:00`)],
  ["not mistaken for a contact edit", (o) => !/Say which part/i.test(ankitSays(o))],
]);

await step("Ankit sets himself a reminder", "09:09", say(OWNER, "Remind me at 6 pm to call Sharma ji"), [
  ["a timed task for Ankit exists today at 18:00", async () =>
    (await bot.openTasks("Ankit")).some((t) => (t.due_at || "").startsWith(`${today}T18:00`))],
]);

await step("Sachin taps Working on his first task", "10:15", async () => {
  const t = (await bot.openTasks("Sachin")).sort((a, b) => a.id - b.id)[0];
  await bot.handleMessage(tap(SACHIN, `st:${t.id}:working`));
  return { from: SACHIN, text: `[taps ⏳ Working on #${t.id}]` };
}, [
  ["task is now 'working'", async () => (await bot.openTasks("Sachin")).some((t) => t.status === "working")],
  ["Ankit is told Sachin replied", (o) => /Sachin\* has replied/.test(ankitSays(o))],
]);

await step("Sachin finishes a task", "11:30", async () => {
  const t = (await bot.openTasks("Sachin")).sort((a, b) => a.id - b.id)[0];
  await bot.handleMessage(tap(SACHIN, `st:${t.id}:done`));
  return { from: SACHIN, text: `[taps ✅ Done on #${t.id}]` };
}, [
  ["Ankit sees '✅ Done'", (o) => /Done/.test(ankitSays(o))],
]);

await step("12 PM pending round", "12:00", async () => { await bot.runPending(); return { job: "runPending()" }; }, [
  // Praveen has not replied to this morning's template, so WhatsApp's 24h window is still
  // closed: his list must be HELD for when he replies, never dropped and never sent as a
  // second template on top of the first.
  ["Praveen's list is sent, or held until he replies", async (o) =>
    o.some((m) => m.to === PRAVEEN) || (await bot.store.count("pending_msgs", { phone: PRAVEEN })) > 0],
  ["no sample/demo task names anywhere", (o) => !o.some((m) => /26AS|Dehradun|car insurance|mediclaim/i.test(body(m)))],
]);

await step("Ankit asks for the task list", "13:00", say(OWNER, "Provide list and status of all tasks"), [
  ["formatted list, not a paragraph", (o) => /Open tasks \(\d+\)/.test(ankitSays(o))],
  ["status icons and task codes on each line", (o) => /^[⬜⏳🚧] \*[TAPO]\d+\* /m.test(ankitSays(o))],
  ["grouped by category, in order", (o) => {
    const s = ankitSays(o);
    return s.indexOf("🙋 *Open tasks on me*") < s.indexOf("👥 *Open tasks on team*");
  }],
]);

await step("Ankit reopens a task by swiping onto Sachin's 'Done' reply", "13:05", async () => {
  const done = wa.sent.filter((m) => m.to === OWNER && /has replied:[\s\S]*Done/.test(m.body || "")).pop();
  await bot.handleMessage(msg(OWNER, "Reopen this task", { context: { id: done.wamid } }));
  return { from: OWNER, text: "↩️ (swipe-reply on Sachin's Done message) Reopen this task" };
}, [
  ["'reopened' confirmation", (o) => /reopened/i.test(ankitSays(o))],
  ["Sachin is told it was reopened", (o) => o.some((m) => m.to === SACHIN && /reopened/i.test(body(m)))],
]);

await step("5-minute meeting reminder", "16:55", async () => { await bot.runDue(); return { job: "runDue() at 16:55" }; }, [
  ["Ankit gets 'Meeting in 5 minutes'", (o) => /Meeting in 5 minutes/.test(ankitSays(o))],
]);

await step("Reminder for his own 6 PM task", "17:55", async () => { await bot.runDue(); return { job: "runDue() at 17:55" }; }, [
  ["Ankit is reminded about Sharma ji", (o) => /Sharma/i.test(ankitSays(o))],
]);

await step("Ankit uses a task code", "17:57", async () => {
  const t = (await bot.openTasks("Praveen"))[0];
  await bot.handleMessage(msg(OWNER, `${bot.code(t)} due 7 pm`));
  return { from: OWNER, text: `${bot.code(t)} due 7 pm` };
}, [
  ["the code is understood and the time is set for today 19:00", async () =>
    (await bot.openTasks("Praveen"))[0].due_at?.startsWith(`${today}T19:00`)],
  ["confirmation names the code", (o) => /\*T\d+\* is now due Today, 07:00 PM/.test(ankitSays(o))],
]);

await step("A payment task lands on Payment and recovery", "17:58", say(OWNER, "Manish recover the pending fees from Sharma ji"), [
  ["it gets a P code", (o) => /\*P\d+\* · Manish · 💰 Payment and recovery/.test(ankitSays(o))],
]);

await step("6 PM review", "18:00", async () => { await bot.runReview(); return { job: "runReview()" }; }, []);

await step("7 PM brief", "19:00", async () => { await bot.runBrief(); return { job: "runBrief()" }; }, [
  ["brief reaches Ankit", (o) => /DAILY BRIEF/.test(ankitSays(o))],
  ["five categories, in order", (o) => {
    const s = ankitSays(o);
    const at = ["MEETINGS AHEAD", "PAYMENT AND RECOVERY", "OPEN TASKS ON ME", "OPEN TASKS ON TEAM", "OTHER TASKS"].map((h) => s.indexOf(h));
    return at.every((x) => x >= 0) && at.every((x, i) => !i || x > at[i - 1]);
  }],
  ["team section lists real tasks with codes, not only counts", (o) => /\*Sachin\* ·[^\n]*\n[✅⏳🚧⬜] \*T\d+\*/.test(ankitSays(o))],
  ["status legend present", (o) => /✅ done · ⏳ working/.test(ankitSays(o))],
]);

await step("Ankit books tomorrow's meeting (a day IS named)", "19:05", say(OWNER, "Set a meeting with Manish tomorrow at 11 am"), [
  ["it stays on TOMORROW at 11:00", async () => (await bot.upcomingMeetings()).some((m) => m.at.startsWith(`${tomorrow}T11:00`))],
]);

await step("Ankit clears the calendar", "19:10", say(OWNER, "Saari meeting delete krdo"), [
  ["confirmation card first, nothing deleted yet", async (o) => /Delete these/.test(ankitSays(o)) && (await bot.upcomingMeetings()).length === 1],
]);

await step("Ankit taps 'Yes, delete'", "19:11", async () => {
  const card = wa.sent.filter((m) => m.to === OWNER && m.kind === "buttons" && /Delete these/.test(m.body)).pop();
  await bot.handleMessage(tap(OWNER, card.buttons[0].id));
  return { from: OWNER, text: "[taps 🗑 Yes, delete]" };
}, [
  ["no meetings left", async () => (await bot.upcomingMeetings()).length === 0],
  ["Manish is told it is called off (or it waits for his window)", async (o) =>
    o.some((m) => m.to === MANISH) || (await bot.store.count("pending_msgs", { phone: MANISH })) > 0],
]);

// ---------------------------------------------------------------- report
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// WhatsApp formatting: *bold*, _italic_, ~strike~, ```mono```
const wa2html = (s) => esc(s)
  .replace(/```([\s\S]*?)```/g, "<code>$1</code>")
  .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<b>$2</b>")
  .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<i>$2</i>")
  .replace(/(^|[\s(])~([^~\n]+)~/g, "$1<s>$2</s>")
  .replace(/\n/g, "<br>");
const bubble = (m) => `<div class="b in"><div class="to">→ ${esc(NAMES[m.to] || m.to)}${m.kind === "template" ? " · <span class='tpl'>template " + esc(m.name) + "</span>" : ""}</div>` +
  `<div>${m.kind === "template" ? esc(m.params.join("  ·  ")) : wa2html(m.body)}</div>` +
  (m.buttons ? `<div class="btns">${m.buttons.map((b) => `<span>${esc(b.title)}</span>`).join("")}</div>` : "") +
  `<div class="t">${esc(m.at)}</div></div>`;
const passed = timeline.flatMap((s) => s.results).filter((r) => r.ok).length;
const total = timeline.flatMap((s) => s.results).length;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ankit Desk simulation – ${today}</title><style>
body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#efeae2;color:#111b21}
header{position:sticky;top:0;background:#075e54;color:#fff;padding:14px 18px;z-index:2}
header h1{margin:0;font-size:18px} header p{margin:4px 0 0;opacity:.85;font-size:13px}
.score{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:12px;font-weight:600;background:${passed === total ? "#25d366" : "#e53935"}}
main{max-width:760px;margin:0 auto;padding:12px}
.step{background:#ffffffb3;border-radius:10px;margin:14px 0;padding:10px 12px}
.step h2{font-size:14px;margin:0 0 8px;color:#54656f} .step h2 b{color:#111b21}
.b{max-width:85%;padding:7px 10px 4px;border-radius:8px;margin:6px 0;box-shadow:0 1px .5px #0002;word-wrap:break-word}
.in{background:#fff} .out{background:#d9fdd3;margin-left:auto}
.to{font-size:12px;color:#008069;font-weight:600;margin-bottom:2px} .tpl{color:#8696a0;font-weight:400}
.t{font-size:11px;color:#667781;text-align:right} .job{font-size:12px;color:#54656f;font-style:italic}
.btns{display:flex;flex-direction:column;gap:4px;margin-top:6px} .btns span{border-top:1px solid #e9edef;text-align:center;color:#027eb5;padding:5px 0}
.chk{font-size:13px;margin:3px 0} .ok{color:#1b8a3a} .no{color:#c62828;font-weight:600} .why{color:#c62828;font-size:12px;white-space:pre-wrap}
code{background:#f0f2f5;padding:0 3px;border-radius:3px}
</style></head><body><header><h1>Ankit Desk — one simulated day (${today})</h1>
<p>${realAI ? "Real OpenAI parser and replies" : "Stand-in AI: flows and formats only (put OPENAI_API_KEY in .env to test the real prompts too)"} · fake WhatsApp · in-memory store</p>
<span class="score">${passed}/${total} checks passed</span></header><main>
${timeline.map((s) => `<section class="step"><h2>${esc(s.at)} · <b>${esc(s.title)}</b></h2>
${s.input && s.input.text ? `<div class="b out"><div class="to">${esc(NAMES[s.input.from])}</div>${wa2html(s.input.text)}<div class="t">${esc(s.at)}</div></div>` : ""}
${s.input && s.input.job ? `<div class="job">⚙️ scheduled job: ${esc(s.input.job)}</div>` : ""}
${s.out.length ? s.out.map(bubble).join("") : `<div class="job">(nothing sent)</div>`}
${s.results.map((r) => `<div class="chk ${r.ok ? "ok" : "no"}">${r.ok ? "✔" : "✘"} ${esc(r.label)}</div>${r.why ? `<div class="why">${esc(r.why)}</div>` : ""}`).join("")}
</section>`).join("")}
</main></body></html>`;
writeFileSync("simulation-report.html", html);
console.log(`\n${passed}/${total} checks passed · ${realAI ? "real AI" : "stand-in AI"} · report: simulation-report.html`);
process.exit(passed === total ? 0 : 1);
