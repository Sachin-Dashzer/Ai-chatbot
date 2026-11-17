import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, makeClock, text, voice, VOICE, OWNER, HIMANSHU, SHALU, RAJNEESH, PULKIT } from "./helpers.js";
import { extractJson } from "../lib/ai.js";
import { cronDays } from "../lib/scheduler.js";
import { workDaySet } from "../lib/time.js";

test("example Monday: P1 instant, P2 batched, one check-in, one reply, nudge, brief, unblock", async () => {
  const clock = makeClock(); clock.at(16, 8);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, SHALU, RAJNEESH, PULKIT]) await bot.handleMessage(text(p, "Hi"));
  wa.sent.length = 0;

  clock.at(16, 9, 10);
  await bot.handleMessage(voice(OWNER, "v1"));
  assert.match(wa.last(HIMANSHU).body, /P1/);
  assert.match(wa.last(HIMANSHU).body, /Galaxy Royal/);
  assert.match(wa.last(OWNER).body, /Assigned/);

  clock.at(16, 11, 30);
  const before = Object.fromEntries([HIMANSHU, SHALU, RAJNEESH].map((p) => [p, wa.to(p).length]));
  await bot.handleMessage(voice(OWNER, "v2"));
  for (const p of Object.keys(before)) assert.equal(wa.to(p).length, before[p]);
  assert.match(wa.last(OWNER).body, /Assigned \(5\)/);

  clock.at(16, 12);
  await bot.runBatch();
  assert.match(wa.last(HIMANSHU).body, /New tasks from Ankit \(2\)/);
  assert.match(wa.last(SHALU).body, /New task from Ankit \(1\)/);
  assert.equal(wa.to(HIMANSHU).length, before[HIMANSHU] + 1);

  clock.at(16, 15, 15);
  await bot.handleMessage(text(OWNER, "Pulkit – last 7 days Amazon ad spend report"));
  clock.at(16, 16);
  await bot.runBatch();
  assert.match(wa.last(PULKIT).body, /Amazon/);

  clock.at(16, 18);
  const b4 = wa.to(HIMANSHU).length;
  await bot.runCheckin();
  assert.equal(wa.to(HIMANSHU).length, b4 + 1);
  const chk = wa.last(HIMANSHU).body;
  assert.ok(chk.includes("1. #") && chk.includes("2. #") && chk.includes("3. #") && chk.includes("Reply in ONE message"));
  assert.match(wa.last(OWNER).body, /Your day/);

  await bot.handleMessage(voice(HIMANSHU, "h1"));
  const ack = wa.last(HIMANSHU).body;
  assert.ok(ack.includes("Done") && ack.includes("Working") && ack.includes("Stuck on Ankit"));
  await bot.handleMessage(text(RAJNEESH, "1 done"));

  clock.at(16, 19);
  const marks = Object.fromEntries([HIMANSHU, SHALU, RAJNEESH, PULKIT].map((p) => [p, wa.to(p).length]));
  await bot.runNudge();
  assert.equal(wa.to(SHALU).length, marks[SHALU] + 1);
  assert.equal(wa.to(PULKIT).length, marks[PULKIT] + 1);
  assert.equal(wa.to(HIMANSHU).length, marks[HIMANSHU]);
  assert.equal(wa.to(RAJNEESH).length, marks[RAJNEESH]);
  await bot.handleMessage(text(SHALU, "1 working, clinic data comes tomorrow"));

  clock.at(17, 8, 30);
  await bot.runBrief();
  const brief = wa.last(OWNER).body;
  assert.ok(brief.includes("PENDING ON YOU (2)") && brief.includes("rate approval") && brief.includes("Goodbite"), brief);
  assert.ok(brief.includes("HoldPoint: 1 done | 1 working | 1 stuck"), brief);
  assert.ok(brief.includes("EPC: 1 done"), brief);
  assert.ok(brief.includes("NO UPDATE YESTERDAY:* Pulkit"), brief);

  const stuck = (await bot.store.findOne("tasks", { stuck_on: "ankit" })).id;
  await bot.handleMessage(text(OWNER, `Himanshu ${stuck} – rate 4,500 per visit approved`));
  assert.match(wa.last(HIMANSHU).body, /rate 4,500/);
  assert.match(wa.last(OWNER).body, /moved back to working/);
  assert.equal((await bot.getTask(stuck)).status, "working");

  const own = (await bot.store.findOne("tasks", { owner: "Ankit" })).id;
  await bot.handleMessage(text(OWNER, `done ${own}`));
  assert.equal((await bot.getTask(own)).status, "done");
});

test("closed 24h window: the template carries the task, the reply does not repeat it", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "Pulkit – Amazon report"));
  clock.at(16, 12);
  await bot.runBatch();
  let m = wa.last(PULKIT);
  assert.equal(m.kind, "template"); assert.equal(m.name, "task_assigned");
  // The task itself rides in the template, so the person sees the work without replying first.
  assert.equal(m.params[0], "Pulkit");
  assert.match(m.params[1], /Amazon/);
  assert.deepEqual(m.payloads, []); // no button on this template: replying is what releases the text
  assert.equal(await bot.store.count("pending_msgs", { phone: PULKIT }), 1); // the task waits in full
  clock.at(16, 18);
  await bot.runCheckin();
  assert.equal(wa.to(PULKIT).filter((x) => x.kind === "template").length, 2);
  await bot.handleMessage(text(PULKIT, "ok"));  // any reply opens the window and flushes what was held
  // Both templates already carried this text, so the flush must not repeat it.
  const texts = wa.to(PULKIT).filter((x) => x.kind === "text").map((x) => x.body);
  assert.ok(!texts.some((t) => t.includes("New task") || t.includes("Your open tasks")));
  assert.equal(await bot.store.count("pending_msgs", { phone: PULKIT }), 0); // dequeued all the same
  clock.at(18, 10);
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Shalu", task: "Call bank today", priority: "urgent" }] });
  await bot.handleMessage(text(OWNER, "Shalu call bank urgent"));
  m = wa.last(SHALU);
  assert.equal(m.kind, "template"); assert.equal(m.params[0], "Shalu");
  assert.match(m.params[1], /Call bank today/); // a P1 names the task in the template too
  // The P1 was named in the template, so the reply does not send it a second time.
  await bot.handleMessage(text(SHALU, "ji"));
  assert.ok(!wa.to(SHALU).some((x) => x.kind === "text" && x.body.includes("Call bank today")));

  // Longer than a template parameter holds: it is cut there, so the full text
  // must still arrive as plain text the moment the window opens.
  clock.at(18, 11);
  const long = "Z".repeat(1200);
  await bot.deliver(bot.d.byName("Pulkit"), long);
  assert.equal(wa.last(PULKIT).kind, "template");
  await bot.handleMessage(text(PULKIT, "ok"));
  assert.ok(wa.to(PULKIT).some((x) => x.kind === "text" && x.body.includes(long)));
});

test("start: the owner opens the 24-hour window before there is a task to send", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "start Narendra"));
  assert.match(wa.last(OWNER).body, /Don't know/); // not in people.yaml for the tests

  await bot.handleMessage(text(OWNER, "start Pulkit"));
  const m = wa.last(PULKIT);
  assert.equal(m.kind, "template"); assert.equal(m.name, "task_assigned");
  // Nothing is held for him yet, so the task parameter falls back to a neutral phrase.
  assert.deepEqual(m.params, ["Pulkit", "a task update"]);
  assert.match(wa.last(OWNER).body, /task_assigned sent/);

  await bot.handleMessage(text(PULKIT, "hi")); // the window is open now
  await bot.handleMessage(text(OWNER, "start Pulkit"));
  assert.match(wa.last(OWNER).body, /window already open/);
  assert.equal(wa.to(PULKIT).filter((x) => x.kind === "template").length, 1);

  wa.failing = [SHALU];
  await bot.handleMessage(text(OWNER, "start Shalu"));
  assert.match(wa.last(OWNER).body, /NOT sent/); // a rejected template is reported, not swallowed
});

test("unknown numbers and duplicates ignored, unclear tasks reported", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  const msg = text(OWNER, "something vague");
  await bot.handleMessage(msg);
  assert.match(wa.last(OWNER).body, /Couldn't tell/);
  await bot.handleMessage(text("919999999999", "hi"));
  assert.equal(wa.to("919999999999").length, 0);
  const n = wa.sent.length;
  await bot.handleMessage(msg);
  assert.equal(wa.sent.length, n);
});

test("per-person settings: reminder off, check-in days, pause with P1 still delivered", async () => {
  const clock = makeClock(); clock.at(16, 9); // Monday
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, SHALU, RAJNEESH, PULKIT]) await bot.handleMessage(text(p, "Hi"));
  await bot.handleMessage(text(OWNER, "reminder off Shalu"));
  assert.match(wa.last(OWNER).body, /reminder off/);
  await bot.handleMessage(text(OWNER, "checkin Rajneesh mon thu"));
  assert.match(wa.last(OWNER).body, /check-in Mon Thu/);
  await bot.handleMessage(text(OWNER, "pause Pulkit today"));
  assert.match(wa.last(OWNER).body, /paused 16 Nov/);
  await bot.handleMessage(text(OWNER, "settings"));
  assert.match(wa.last(OWNER).body, /Shalu: check-in daily · reminder off/);

  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Shalu", task: "Oct collections", priority: "normal" },
    { owner: "Rajneesh", task: "GSTR-2B recon", priority: "normal" },
    { owner: "Pulkit", task: "Ad spend report", priority: "normal" },
    { owner: "Pulkit", task: "Call courier now", priority: "urgent" }] });
  await bot.handleMessage(text(OWNER, "four tasks"));
  assert.match(wa.last(OWNER).body, /held – Pulkit is paused/);
  assert.match(wa.last(PULKIT).body, /Call courier now/);
  const nPulkit = wa.to(PULKIT).length;

  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Himanshu", task: "Check GST for EPC", priority: "normal" }] });
  await bot.handleMessage(text(OWNER, "check GST for EPC Himanshu"));
  assert.match(wa.last(OWNER).body, /Assigned/);

  clock.at(16, 12); await bot.runBatch();
  clock.at(16, 18); await bot.runCheckin();
  assert.match(wa.last(RAJNEESH).body, /Your open tasks/);
  clock.at(16, 19); await bot.runNudge();
  assert.ok(!wa.to(SHALU).some((m) => m.kind === "text" && m.body.startsWith("Reminder")));
  assert.equal(wa.to(PULKIT).length, nPulkit);

  clock.at(17, 12); await bot.runBatch();
  const lp = wa.last(PULKIT);
  assert.ok(lp.kind === "template" || lp.body.includes("Ad spend report"));
  const nRaj = wa.to(RAJNEESH).length;
  clock.at(17, 18); await bot.runCheckin();
  assert.equal(wa.to(RAJNEESH).length, nRaj);

  await bot.handleMessage(text(OWNER, "pause Himanshu till 20 nov"));
  assert.match(wa.last(OWNER).body, /paused 17 Nov–20 Nov/);
  await bot.handleMessage(text(OWNER, "resume Himanshu"));
  assert.doesNotMatch(wa.last(OWNER).body, /paused/);
});

test("Ankit's own day: score, natural update, list-number reply, yesterday in brief", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  const plan = { tasks: [
    { owner: "me", business: "PHMG", task: "Complete CRM templates for PHMG staff", priority: "urgent" },
    { owner: "me", business: "HoldPoint", task: "Visit Sharma ji at Sector 76", priority: "normal" },
    { owner: "me", business: "Personal", task: "Meet bank manager about Minenii", priority: "normal" }] };
  bot.ai.parseOwner = async (t, open) => t.includes("CRM") ? plan
    : { tasks: [], own_updates: [{ task_id: open.find((x) => x.description.includes("CRM")).id, status: "done" }] };
  await bot.handleMessage(text(OWNER, "Me – CRM templates urgent, visit Sharma ji, meet bank manager"));
  assert.match(wa.last(OWNER).body, /Assigned \(3\)/);
  clock.at(16, 14);
  await bot.handleMessage(text(OWNER, "templates ho gaye"));
  assert.match(wa.last(OWNER).body, /Today: 1 of 3 done/);
  clock.at(16, 18);
  await bot.runCheckin();
  const msg = wa.last(OWNER).body;
  assert.ok(msg.includes("1 of 3 done") && msg.includes("✓ #") && msg.includes("1. #") && msg.includes("2. #"));
  await bot.handleMessage(text(OWNER, "1 done"));
  assert.match(wa.last(OWNER).body, /Today: 2 of 3 done/);
  clock.at(17, 8, 30);
  await bot.runBrief();
  const brief = wa.last(OWNER).body;
  assert.ok(brief.includes("YOUR DAY YESTERDAY: 2 of 3 done") && brief.includes("Meet bank manager"), brief);
});

test("boards and safeguards: privacy, attention, tick, P1, newlink, move, assign, duplicates, reopen, CSV", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  bot.s.baseUrl = "https://desk.example.com";
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Rajneesh", business: "EPC", task: "Oct GSTR-2B reconciliation", priority: "urgent" },
    { owner: "Shalu", business: "Ryan", task: "Oct collections", priority: "normal" },
    { owner: "me", business: "EPC", task: "EPC GST templates", priority: "urgent" },
    { owner: "me", business: "Personal", task: "Buy mediclaim", priority: "normal" }] });
  await bot.handleMessage(text(OWNER, "four tasks"));
  await bot.handleMessage(text(OWNER, "boards"));
  const links = wa.last(OWNER).body;
  assert.ok(links.includes("Master (only you): https://desk.example.com/board/") && links.includes("EPC → Rajneesh") && !links.includes("Personal"));

  const epcKey = await bot.boards.keyFor("EPC");
  let team = await bot.boards.teamBoard("EPC");
  const allTeam = JSON.stringify(team);
  assert.ok(allTeam.includes("Oct GSTR-2B reconciliation"));
  assert.ok(!allTeam.includes("Oct collections") && !allTeam.includes("EPC GST templates") && !allTeam.includes("mediclaim"));

  clock.at(17, 10);
  team = await bot.boards.teamBoard("EPC");
  assert.equal(team.attention.length, 1);

  const master = await bot.boards.masterBoard("attention");
  assert.ok(JSON.stringify(master).includes("Buy mediclaim"));
  assert.ok(JSON.stringify(await bot.boards.masterBoard("ryan")).includes("Oct collections"));

  const tid = (await bot.store.findOne("tasks", { description: "Buy mediclaim" })).id;
  await bot.boards.act(tid, "done");
  assert.equal((await bot.getTask(tid)).status, "done");
  const sid = (await bot.store.findOne("tasks", { description: "Oct collections" })).id;
  await bot.boards.act(sid, "p1");
  assert.equal((await bot.getTask(sid)).priority, "urgent");

  await bot.handleMessage(text(OWNER, "newlink EPC"));
  assert.equal(await bot.boards.scopeOf(epcKey), null);
  assert.match(wa.last(OWNER).body, /New link/);

  await bot.handleMessage(text(OWNER, `move ${sid} EPC`));
  assert.equal((await bot.getTask(sid)).business, "EPC");
  await bot.handleMessage(text(OWNER, `assign ${sid} Rajneesh`));
  assert.equal((await bot.getTask(sid)).owner, "Rajneesh");
  const m = wa.last(RAJNEESH);
  assert.equal(m.kind, "template"); assert.equal(m.params[0], "Rajneesh");
  assert.match(m.params[1], /Oct collections/); // reassigned work names itself in the template too
  assert.ok((await bot.store.find("pending_msgs", { phone: RAJNEESH })).some((r) => r.text.includes("Oct collections")));

  const rid = (await bot.store.findOne("tasks", { description: "Oct GSTR-2B reconciliation" })).id;
  bot.ai.parseOwner = async () => ({ tasks: [], duplicates: [{ task_id: rid }] });
  await bot.handleMessage(text(OWNER, "Rajneesh 2B recon again"));
  assert.match(wa.last(OWNER).body, /Already open/);

  await bot.handleMessage(text(OWNER, `reopen ${tid}`));
  assert.equal((await bot.getTask(tid)).status, "working");

  const csv = await bot.boards.exportCsv();
  assert.ok(csv.startsWith("id,business,owner") && csv.includes("Buy mediclaim"));
});

test("message log, msgs command, remark history on master board only", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Himanshu", business: "HoldPoint", task: "Galaxy Royal invoice", priority: "normal" },
    { owner: "Himanshu", business: "HoldPoint", task: "Sector 76 site visit", priority: "normal" }] });
  await bot.handleMessage(text(OWNER, "two tasks"));
  clock.at(16, 18);
  await bot.runCheckin();
  const ids = (await bot.store.find("tasks", {}, { sort: { id: 1 } })).map((t) => t.id);
  bot.ai.parseStatus = async (t) =>
    t.includes("1 done") ? { updates: [{ task_id: ids[0], status: "done" }] }
      : t.includes("Thursday") ? { updates: [{ task_id: ids[1], status: "working", note: "Client moved visit to Thursday" }] }
        : { updates: [], other: "Wants a call about AMC rate" };
  await bot.handleMessage(text(HIMANSHU, "1 done"));
  await bot.handleMessage(text(HIMANSHU, "2 mein client ne date change ki, Thursday ko visit"));
  VOICE.hv = "Sir AMC rate pe baat karni hai, call kar lena";
  await bot.handleMessage(voice(HIMANSHU, "hv"));

  const rows = await bot.store.find("messages", { person: "Himanshu" }, { sort: { id: 1 } });
  assert.deepEqual(rows.map((r) => r.text), ["1 done", "2 mein client ne date change ki, Thursday ko visit", "Sir AMC rate pe baat karni hai, call kar lena"]);
  assert.equal(rows[2].kind, "voice");

  await bot.handleMessage(text(OWNER, "msgs Himanshu"));
  const out = wa.last(OWNER).body;
  assert.ok(out.includes("Last 3 messages – Himanshu") && out.includes("🎤") && out.includes("Thursday ko visit"));

  await bot.handleMessage(text(OWNER, `Himanshu ${ids[1]} – ok, confirm by Wednesday`));
  const msgs = JSON.stringify(await bot.boards.masterBoard("messages", "Himanshu"));
  assert.ok(msgs.includes("call kar lena") && msgs.includes('"voice":true'));
  const hp = await bot.boards.masterBoard("holdpoint");
  const card = hp.sections.flatMap((s) => s.cards).find((c) => c.id === ids[1]);
  assert.equal(card.remarks.length, 2);
  assert.ok(JSON.stringify(card.remarks).includes("Client moved visit to Thursday") && JSON.stringify(card.remarks).includes("confirm by Wednesday"));
  const teamCards = JSON.stringify(await bot.boards.teamBoard("HoldPoint"));
  assert.ok(!teamCards.includes("confirm by Wednesday"));
});

test("helpers: JSON extraction and cron day mapping", () => {
  assert.equal(extractJson('ok {"updates":[{"task_id":3}]} x').updates[0].task_id, 3);
  assert.deepEqual(extractJson("none").tasks, []);
  assert.equal(cronDays("mon-sat"), "1-6");
  assert.equal(cronDays("mon,thu"), "1,4");
  assert.deepEqual([...workDaySet("mon-sat")], ["mon", "tue", "wed", "thu", "fri", "sat"]);
  assert.deepEqual([...workDaySet("mon,thu")], ["mon", "thu"]);
  assert.deepEqual([...workDaySet("sat-tue")], ["sat", "sun", "mon", "tue"]); // a range that wraps the week
  assert.deepEqual([...workDaySet("nonsense")], []);
});

test("cron endpoint: runs a due slot once, ignores off-window, off-day, bad token, live node-cron", async () => {
  const clock = makeClock(); clock.at(16, 11, 30); // Mon 16 Nov 2026
  const { bot, wa } = setup(clock);
  globalThis.__ankitDesk = bot;            // the route reads the shared bot off globalThis
  delete globalThis.__ankitDeskCron;
  const { GET } = await import("../app/api/cron/route.js");
  const hit = async () => (await GET(new Request(`http://x/api/cron?token=${bot.s.waVerifyToken}`))).json();

  await bot.handleMessage(text(OWNER, "Pulkit – last 7 days Amazon ad spend report"));
  assert.equal(wa.to(PULKIT).length, 0);   // P2: nothing until the batch slot

  assert.equal((await GET(new Request("http://x/api/cron?token=wrong"))).status, 403);

  clock.at(16, 11, 59);
  assert.deepEqual((await hit()).ran, []); // 12:00 has not arrived

  clock.at(16, 12, 5);                     // a cron 5 minutes late still catches the slot
  assert.deepEqual((await hit()).ran, ["batch@12:00"]);
  assert.equal(wa.to(PULKIT).length, 1);

  clock.at(16, 12, 20);                    // a retry must not send the same batch twice
  assert.deepEqual((await hit()).ran, []);
  assert.equal(wa.to(PULKIT).length, 1);

  clock.at(16, 14);                        // more than an hour late: the slot is gone, not resent
  assert.deepEqual((await hit()).ran, []);

  clock.at(22, 12, 5);                     // Sunday, WORK_DAYS is mon-sat
  assert.match((await hit()).note, /not a work day/);

  globalThis.__ankitDeskCron = true;       // always-on host: node-cron owns the schedule
  clock.at(17, 12, 5);
  assert.match((await hit()).note, /in-process scheduler/);
  delete globalThis.__ankitDeskCron;
  delete globalThis.__ankitDesk;
});

test("a failed WhatsApp send never loses the task: the next batch retries it", async () => {
  const clock = makeClock(); clock.at(16, 10);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, PULKIT]) await bot.handleMessage(text(p, "Hi"));
  wa.sent.length = 0;

  // P1: told instantly, but WhatsApp rejects it. Ankit must be told, and the task must stay queued.
  clock.at(16, 11);
  wa.failing = [HIMANSHU];
  await bot.handleMessage(voice(OWNER, "v1"));
  assert.match(wa.last(OWNER).body, /NOT delivered/);
  const p1 = (await bot.openTasks("Himanshu"))[0];
  assert.equal(p1.notified, 0);

  // P2: the batch send fails too, so nothing is marked delivered.
  wa.failing = [HIMANSHU, PULKIT];
  await bot.handleMessage(text(OWNER, "Pulkit – last 7 days Amazon ad spend report"));
  const p2 = (await bot.openTasks("Pulkit"))[0];
  clock.at(16, 12);
  const first = await bot.runBatch();
  assert.equal(first.sent.length, 0);
  assert.equal(first.failed.length, 2, JSON.stringify(first));
  assert.equal((await bot.getTask(p1.id)).notified, 0);
  assert.equal((await bot.getTask(p2.id)).notified, 0);

  // WhatsApp recovers: the 4 PM batch delivers both and only then marks them.
  wa.failing = [];
  clock.at(16, 16);
  const second = await bot.runBatch();
  assert.deepEqual(second.failed, []);
  assert.match(wa.last(HIMANSHU).body, /Galaxy Royal/);
  assert.match(wa.last(PULKIT).body, /Amazon/);
  assert.equal((await bot.getTask(p1.id)).notified, 1);
  assert.equal((await bot.getTask(p2.id)).notified, 1);

  // And a broken number for one person must not stop the rest of the team.
  wa.failing = [HIMANSHU];
  await bot.handleMessage(text(OWNER, "Pulkit – last 7 days Amazon ad spend report"));
  clock.at(16, 17);
  const third = await bot.runBatch();
  assert.deepEqual(third.sent, ["Pulkit:1"]);
});
