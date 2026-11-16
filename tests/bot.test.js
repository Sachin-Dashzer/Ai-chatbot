import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, makeClock, text, voice, tap, VOICE, OWNER, HIMANSHU, SHALU, RAJNEESH, PULKIT } from "./helpers.js";
import { extractJson } from "../lib/ai.js";
import { cronDays } from "../lib/scheduler.js";

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

test("closed 24h window: tap-View template, then full text; P1 uses urgent template", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "Pulkit – Amazon report"));
  clock.at(16, 12);
  await bot.runBatch();
  let m = wa.last(PULKIT);
  assert.equal(m.kind, "template"); assert.equal(m.name, "ankit_desk_update");
  assert.deepEqual(m.params, ["Pulkit", "1 new task"]); assert.deepEqual(m.payloads, ["view"]);
  clock.at(16, 18);
  await bot.runCheckin();
  assert.equal(wa.to(PULKIT).filter((x) => x.kind === "template").length, 2);
  await bot.handleMessage(tap(PULKIT, "view"));
  const texts = wa.to(PULKIT).filter((x) => x.kind === "text").map((x) => x.body);
  assert.ok(texts.some((t) => t.includes("New task")) && texts.some((t) => t.includes("Your open tasks")));
  clock.at(18, 10);
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Shalu", task: "Call bank today", priority: "urgent" }] });
  await bot.handleMessage(text(OWNER, "Shalu call bank urgent"));
  m = wa.last(SHALU);
  assert.equal(m.kind, "template"); assert.equal(m.name, "urgent_task"); assert.ok(m.params.includes("Call bank today"));
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
  assert.equal(m.kind, "template"); assert.equal(m.name, "urgent_task"); assert.ok(m.params.includes("Oct collections"));

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
});
