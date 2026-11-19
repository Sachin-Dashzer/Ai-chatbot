import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, makeClock, text, voice, VOICE, OWNER, HIMANSHU, SHALU, RAJNEESH, PULKIT, tap, btn } from "./helpers.js";
import { TEAM } from "../lib/boards.js";
import { extractJson } from "../lib/ai.js";
import { cronDays } from "../lib/scheduler.js";
import { workDaySet } from "../lib/time.js";

test("example Monday: every task goes straight out, one list per round, reply, nudge, review, brief, unblock", async () => {
  const clock = makeClock(); clock.at(16, 8);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, SHALU, RAJNEESH, PULKIT]) await bot.handleMessage(text(p, "Hi"));
  wa.sent.length = 0;

  clock.at(16, 9, 10);
  await bot.handleMessage(voice(OWNER, "v1"));
  // Straight to Himanshu, with the three taps under it. No queue, no clock.
  const first = wa.last(HIMANSHU);
  assert.equal(first.kind, "buttons");
  assert.match(first.body, /New task from Ankit/);
  assert.match(first.body, /Galaxy Royal/);
  assert.deepEqual(first.buttons.map((b) => b.title), ["✅ Done", "⏳ Working", "✍️ Remark"]);
  assert.match(wa.last(OWNER).body, /Assigned/);

  clock.at(16, 11, 30);
  const before = Object.fromEntries([HIMANSHU, SHALU, RAJNEESH].map((p) => [p, wa.to(p).length]));
  await bot.handleMessage(voice(OWNER, "v2"));
  assert.equal(wa.to(HIMANSHU).length, before[HIMANSHU] + 2); // two of the five are his
  assert.equal(wa.to(SHALU).length, before[SHALU] + 1);
  assert.equal(wa.to(RAJNEESH).length, before[RAJNEESH] + 1);
  assert.match(wa.last(OWNER).body, /Assigned \(5\)/);

  // 11:59: the list of what is still on them, so nothing is forgotten by lunch.
  clock.at(16, 11, 59);
  const round = await bot.runPending();
  assert.deepEqual(round.failed, []);
  assert.match(wa.last(HIMANSHU).body, /Pending with you \(3\)/);
  assert.equal(wa.last(HIMANSHU).kind, "text");          // an announcement never carries buttons
  assert.equal(wa.last(SHALU).kind, "text");             // one task, and still no buttons
  assert.equal(wa.to(PULKIT).length, 0);                 // nothing open, so nothing sent
  const chk = wa.last(HIMANSHU).body;
  // Every pending job named in full: that is the whole point of the round.
  for (const t of await bot.openTasks("Himanshu")) assert.ok(chk.includes(t.description), `not named: ${t.description}`);
  assert.ok(chk.includes("*1.*") && chk.includes("*2.*") && chk.includes("*3.*"));
  // An announcement, so nothing that makes it a question and no internal ids.
  assert.ok(!chk.includes("Reply in ONE message"), "the round no longer asks for a reply");
  assert.ok(!/\*\d+\. #\d+\*/.test(chk), "no task ids in the announcement");
  // "1 done" has to mean the 1 he is looking at, so the numbering follows the list just sent.
  const numbering = await bot.store.find("checkin_items", { owner: "Himanshu" }, { sort: { idx: 1 } });
  assert.deepEqual(numbering.map((r) => r.idx), [1, 2, 3]);
  assert.deepEqual(numbering.map((r) => r.task_id), (await bot.openTasks("Himanshu")).map((t) => t.id));

  clock.at(16, 15, 15);
  await bot.handleMessage(text(OWNER, "Pulkit - last 7 days Amazon ad spend report"));
  assert.match(wa.last(PULKIT).body, /Amazon/);          // instantly, not at 4 PM

  clock.at(16, 16);
  await bot.runPending();
  assert.match(wa.last(PULKIT).body, /Pending with you \(1\)/);

  // 6 PM is Ankit's alone now. The team were asked for their status with their list, so they
  // are not sent the same tasks a second time this evening.
  clock.at(16, 18);
  const b4 = wa.to(HIMANSHU).length;
  await bot.runReview();
  assert.equal(wa.to(HIMANSHU).length, b4);
  // His day, then everything he handed out today.
  const six = wa.last(OWNER).body;
  assert.match(six, /Your day/);
  assert.match(six, /ASSIGNED TODAY \(6\)/);
  assert.match(six, /\*Himanshu\* · 3 tasks/);
  assert.match(six, /Score: 0 of 6 done/);

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
  assert.ok(brief.includes("OPEN A WEEK OR MORE (0)"), brief);
  assert.ok(brief.includes("Himanshu: 1 done | 1 working | 1 stuck"), brief);
  assert.ok(brief.includes("Rajneesh: 1 done"), brief);
  assert.ok(brief.includes("NO UPDATE YESTERDAY:* Pulkit"), brief);

  const stuck = (await bot.store.findOne("tasks", { stuck_on: "ankit" })).id;
  await bot.handleMessage(text(OWNER, `Himanshu ${stuck} - rate 4,500 per visit approved`));
  assert.match(wa.last(HIMANSHU).body, /rate 4,500/);
  assert.equal(wa.last(HIMANSHU).kind, "buttons"); // he can close it with a tap there and then
  assert.match(wa.last(OWNER).body, /moved back to working/);
  assert.equal((await bot.getTask(stuck)).status, "working");

  const own = (await bot.store.findOne("tasks", { owner: "Ankit" })).id;
  await bot.handleMessage(text(OWNER, `done ${own}`));
  assert.equal((await bot.getTask(own)).status, "done");
});

test("closed 24h window: the template carries what it can, and the full message still arrives", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "Pulkit - Amazon report"));
  let m = wa.last(PULKIT);
  // Outside the window only the approved template can reach him, so the work rides in its body.
  assert.equal(m.kind, "template"); assert.equal(m.name, "task_reminder");
  assert.equal(m.params[0], "Pulkit");
  assert.match(m.params[1], /Amazon/);
  assert.equal(m.params.length, 3);
  assert.deepEqual(m.payloads, []);
  assert.equal(await bot.store.count("pending_msgs", { phone: PULKIT }), 1);

  clock.at(16, 16);
  await bot.runPending();
  assert.equal(wa.to(PULKIT).filter((x) => x.kind === "template").length, 2);

  // The reply opens the window. A template parameter cannot carry a newline, so what it showed
  // him was the message flattened onto one line - not the message. Both are now sent in full.
  await bot.handleMessage(text(PULKIT, "ok"));
  assert.ok(wa.to(PULKIT).some((x) => x.kind === "buttons" && x.body.includes("Amazon") && x.body.includes("New task from Ankit")));
  // His list is an announcement, so it comes back as plain text, buttons or not.
  assert.ok(wa.to(PULKIT).some((x) => x.kind === "text" && x.body.includes("Pending with you")));
  assert.equal(await bot.store.count("pending_msgs", { phone: PULKIT }), 0);

  clock.at(18, 10);
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Shalu", task: "Call bank today" }] });
  await bot.handleMessage(text(OWNER, "Shalu call bank now"));
  m = wa.last(SHALU);
  assert.equal(m.kind, "template"); assert.equal(m.params[0], "Shalu");
  assert.match(m.params[1], /Call bank today/);
  await bot.handleMessage(text(SHALU, "ji"));
  assert.ok(wa.to(SHALU).some((x) => x.kind === "buttons" && x.body.includes("Call bank today")));
  // A tap on an older template that still had a button stays harmless.
  await bot.handleMessage(tap(SHALU, "view"));
  assert.match(wa.last(SHALU).body, /all caught up/);

  // Longer than a template parameter holds: cut there, so the full text must still arrive.
  clock.at(18, 11);
  const long = "Z".repeat(1200);
  await bot.deliver(bot.d.byName("Pulkit"), long);
  assert.equal(wa.last(PULKIT).kind, "template");
  await bot.handleMessage(text(PULKIT, "ok"));
  assert.ok(wa.to(PULKIT).some((x) => x.kind === "text" && x.body.includes(long)));
});

test("buttons: a tap is a status update, and Remark takes the words that follow", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(HIMANSHU, "Hi"));
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Himanshu",
    task: "Send the Galaxy Royal invoice with the revised AMC rate of 4,500 per visit" }] });
  await bot.handleMessage(text(OWNER, "Himanshu invoice"));
  const t = await bot.store.findOne("tasks", { owner: "Himanshu" });
  // The whole instruction reaches him, not a fifteen-word label of it.
  assert.match(wa.last(HIMANSHU).body, /revised AMC rate of 4,500 per visit/);
  assert.deepEqual(wa.last(HIMANSHU).buttons.map((b) => b.id), [`st:${t.id}:done`, `st:${t.id}:working`, `st:${t.id}:remark`]);

  await bot.handleMessage(btn(HIMANSHU, `st:${t.id}:working`));
  assert.equal((await bot.getTask(t.id)).status, "working");
  assert.match(wa.last(HIMANSHU).body, /Noted – \*#\d+\* is working/);
  // A tap counts as today's answer, so the 7 PM reminder leaves him alone.
  assert.equal((await bot.store.findOne("checkins", { date: bot.today(), owner: "Himanshu" })).replied, 1);
  clock.at(16, 19);
  const n = wa.to(HIMANSHU).length;
  await bot.runNudge();
  assert.equal(wa.to(HIMANSHU).length, n);

  // Remark: the bot asks, and the next message he sends lands on that task and on Ankit.
  await bot.handleMessage(btn(HIMANSHU, `st:${t.id}:remark`));
  assert.match(wa.last(HIMANSHU).body, /Send your remark now/);
  await bot.handleMessage(text(HIMANSHU, "noted, client ne Thursday maanga hai"));
  assert.match(wa.last(OWNER).body, /Himanshu\* on #\d+/);
  assert.match(wa.last(OWNER).body, /Thursday maanga hai/);
  assert.match((await bot.getTask(t.id)).note, /Thursday maanga hai/);
  const notes = await bot.store.find("task_notes", { task_id: t.id });
  assert.ok(notes.some((r) => r.status === "Remark" && r.text.includes("Thursday")));
  assert.equal(await bot.store.count("awaiting_remark", { person: "Himanshu" }), 0);

  await bot.handleMessage(btn(HIMANSHU, `st:${t.id}:done`));
  assert.equal((await bot.getTask(t.id)).status, "done");
  // A tap on something already closed changes nothing.
  await bot.handleMessage(btn(HIMANSHU, `st:${t.id}:done`));
  assert.match(wa.last(HIMANSHU).body, /not one of your open tasks/);

  // A Remark tap nobody followed up on expires with the day, so tomorrow's "1 done" is read
  // as the status reply it is and not as a remark on a task he has forgotten about.
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Himanshu", task: "Collect the Palm Grove deposit" }] });
  await bot.handleMessage(text(OWNER, "one more"));
  const t2 = await bot.store.findOne("tasks", { description: "Collect the Palm Grove deposit" });
  await bot.handleMessage(btn(HIMANSHU, `st:${t2.id}:remark`));
  clock.at(17, 10);
  bot.ai.parseStatus = async () => ({ updates: [{ task_id: t2.id, status: "done" }] });
  await bot.handleMessage(text(HIMANSHU, "1 done"));
  assert.equal((await bot.getTask(t2.id)).status, "done");
});

test("6 PM overview: everything assigned today, by person and status", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, SHALU]) await bot.handleMessage(text(p, "Hi"));
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Himanshu", task: "Send Galaxy Royal invoice" },
    { owner: "Himanshu", task: "Fix Sector 76 site visit" },
    { owner: "Shalu", task: "Match October collections" }] });
  await bot.handleMessage(text(OWNER, "three tasks"));
  const ids = (await bot.store.find("tasks", {}, { sort: { id: 1 } })).map((t) => t.id);
  await bot.handleMessage(btn(HIMANSHU, `st:${ids[0]}:done`));
  await bot.handleMessage(btn(SHALU, `st:${ids[2]}:working`));

  await bot.handleMessage(text(OWNER, "today"));
  const o = wa.last(OWNER).body;
  assert.match(o, /ASSIGNED TODAY \(3\)/);
  assert.match(o, /\*Himanshu\* · 2 tasks/);
  assert.match(o, /\*Shalu\* · 1 task/);
  assert.match(o, /Score: 1 of 3 done/);
  assert.match(o, /1 working/);
  assert.match(o, /No word yet on: #\d+ Himanshu/);

  // And it is the tail of the 6 PM message, whether or not Ankit has tasks of his own.
  clock.at(16, 18);
  await bot.runReview();
  const six = wa.last(OWNER).body;
  assert.match(six, /Nothing of your own today/);
  assert.match(six, /ASSIGNED TODAY \(3\)/);
});

test("messages board: the whole team is listed, a chosen person's thread holds only theirs", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot } = setup(clock);
  await bot.handleMessage(text(SHALU, "Collection kal bhej dunga"));
  await bot.handleMessage(text(HIMANSHU, "Invoice bhej diya"));

  const all = await bot.boards.masterBoard("messages", "");
  assert.deepEqual(all.chats.map((c) => c.name).sort(), ["Himanshu", "Pulkit", "Rajneesh", "Shalu"]);
  assert.equal(all.selected, "");

  const shalu = await bot.boards.masterBoard("messages", "Shalu");
  assert.equal(shalu.selected, "Shalu");
  const thread = JSON.stringify(shalu.thread);
  assert.ok(thread.includes("Collection kal bhej dunga") && !thread.includes("Invoice bhej diya"));

  // The merged thread holds the whole team.
  const everyone = JSON.stringify((await bot.boards.masterBoard("messages", "~all")).thread);
  assert.ok(everyone.includes("Collection kal bhej dunga") && everyone.includes("Invoice bhej diya"));

  // Somebody who is not on the list is ignored rather than emptying the screen.
  const unknown = await bot.boards.masterBoard("messages", "Nobody");
  assert.equal(unknown.selected, "");
  assert.equal(unknown.chats.length, 4);
});

test("start: the owner opens the 24-hour window before there is a task to send", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "start Narendra"));
  assert.match(wa.last(OWNER).body, /Don't know/); // not in people.yaml for the tests

  await bot.handleMessage(text(OWNER, "start Pulkit"));
  const m = wa.last(PULKIT);
  assert.equal(m.kind, "template"); assert.equal(m.name, "task_reminder");
  assert.deepEqual(m.params, ["Pulkit", "a task update", "today"]);
  assert.match(wa.last(OWNER).body, /task_reminder sent/);

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

test("per-person settings: reminder off, reporting days, and a pause that holds everything", async () => {
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

  const nPulkit = wa.to(PULKIT).length;
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Shalu", task: "Oct collections" },
    { owner: "Rajneesh", task: "GSTR-2B recon" },
    { owner: "Pulkit", task: "Ad spend report" },
    { owner: "Pulkit", task: "Call courier now" }] });
  await bot.handleMessage(text(OWNER, "four tasks"));
  assert.match(wa.last(OWNER).body, /held – Pulkit is paused/);
  assert.equal(wa.to(PULKIT).length, nPulkit); // on leave means on leave: nothing gets through
  // Held means unsent, not queued twice: the tasks sit at notified:0 and the first pending
  // round after the pause carries them.
  assert.equal(await bot.store.count("tasks", { owner: "Pulkit", notified: 0 }), 2);

  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Himanshu", task: "Check GST for EPC" }] });
  await bot.handleMessage(text(OWNER, "check GST for EPC Himanshu"));
  assert.match(wa.last(OWNER).body, /Assigned/);

  clock.at(16, 11, 59); await bot.runPending();
  assert.equal(wa.to(PULKIT).length, nPulkit); // still paused
  assert.match(wa.last(RAJNEESH).body, /Pending with you/);
  // Monday is one of his reporting days, so an answer is expected and tracked.
  assert.equal(await bot.store.count("checkins", { date: "2026-11-16", owner: "Rajneesh" }), 1);
  clock.at(16, 19); await bot.runNudge();
  assert.ok(!wa.to(SHALU).some((m) => m.kind === "text" && m.body.startsWith("Reminder")));
  assert.equal(wa.to(PULKIT).length, nPulkit);

  clock.at(17, 11, 59); await bot.runPending(); // the pause is over: what was held goes out
  const lp = wa.last(PULKIT);
  assert.ok(lp.kind === "template" || lp.body.includes("Ad spend report"));
  // Tuesday is not one of Rajneesh's reporting days: he still sees what is pending on him,
  // but no answer is owed, so nothing can count as a missed update. A day after his last
  // message the window has closed, so it reaches him as the template plus a held list.
  const lr = wa.last(RAJNEESH);
  assert.ok(lr.kind === "template" || lr.body.includes("Pending with you"));
  assert.ok((await bot.store.find("pending_msgs", { phone: RAJNEESH })).some((r) => r.text.includes("Pending with you")));
  assert.equal(await bot.store.count("checkins", { date: "2026-11-17", owner: "Rajneesh" }), 0);

  await bot.handleMessage(text(OWNER, "pause Himanshu till 20 nov"));
  assert.match(wa.last(OWNER).body, /paused 17 Nov–20 Nov/);
  await bot.handleMessage(text(OWNER, "resume Himanshu"));
  assert.doesNotMatch(wa.last(OWNER).body, /paused/);
});

test("Ankit's own day: score, natural update, list-number reply, yesterday in brief", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  const plan = { tasks: [
    { owner: "me", task: "Complete CRM templates for PHMG staff" },
    { owner: "me", task: "Visit Sharma ji at Sector 76" },
    { owner: "me", task: "Meet bank manager about Minenii" }] };
  bot.ai.parseOwner = async (t, open) => t.includes("CRM") ? plan
    : { tasks: [], own_updates: [{ task_id: open.find((x) => x.description.includes("CRM")).id, status: "done" }] };
  await bot.handleMessage(text(OWNER, "Me - CRM templates, visit Sharma ji, meet bank manager"));
  assert.match(wa.last(OWNER).body, /Assigned \(3\)/);
  clock.at(16, 14);
  await bot.handleMessage(text(OWNER, "templates ho gaye"));
  assert.match(wa.last(OWNER).body, /Today: 1 of 3 done/);
  clock.at(16, 18);
  await bot.runReview();
  const msg = wa.last(OWNER).body;
  assert.ok(msg.includes("1 of 3 done") && msg.includes("✓ #") && msg.includes("1. #") && msg.includes("2. #"));
  await bot.handleMessage(text(OWNER, "1 done"));
  assert.match(wa.last(OWNER).body, /Today: 2 of 3 done/);
  clock.at(17, 8, 30);
  await bot.runBrief();
  const brief = wa.last(OWNER).body;
  assert.ok(brief.includes("YOUR DAY YESTERDAY: 2 of 3 done") && brief.includes("Meet bank manager"), brief);
});

test("boards and safeguards: privacy, attention, tick, newlink, assign, duplicates, reopen, CSV", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  bot.s.baseUrl = "https://desk.example.com";
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Rajneesh", task: "Oct GSTR-2B reconciliation" },
    { owner: "Shalu", task: "Oct collections" },
    { owner: "me", task: "EPC GST templates" },
    { owner: "me", task: "Buy mediclaim" }] });
  await bot.handleMessage(text(OWNER, "four tasks"));
  await bot.handleMessage(text(OWNER, "boards"));
  const links = wa.last(OWNER).body;
  assert.ok(links.includes("Master (only you): https://desk.example.com/board/") && links.includes("Team → Himanshu"));

  const teamKey = await bot.boards.keyFor(TEAM);
  // The team board is the team's work only: nothing of Ankit's own reaches it.
  const allTeam = JSON.stringify(await bot.boards.teamBoard());
  assert.ok(allTeam.includes("Oct GSTR-2B reconciliation") && allTeam.includes("Oct collections"));
  assert.ok(!allTeam.includes("EPC GST templates") && !allTeam.includes("mediclaim"));

  // Age is what raises a flag now that nothing is ranked: a week open and still nothing.
  clock.at(17, 10);
  assert.equal((await bot.boards.teamBoard()).attention.length, 0);
  clock.at(24, 10);
  assert.equal((await bot.boards.teamBoard()).attention.length, 2);

  const master = await bot.boards.masterBoard("attention");
  assert.ok(JSON.stringify(master).includes("Buy mediclaim"));

  const tid = (await bot.store.findOne("tasks", { description: "Buy mediclaim" })).id;
  await bot.boards.act(tid, "done");
  assert.equal((await bot.getTask(tid)).status, "done");

  await bot.handleMessage(text(OWNER, "newlink team"));
  assert.equal(await bot.boards.scopeOf(teamKey), null);
  assert.match(wa.last(OWNER).body, /New link/);

  const sid = (await bot.store.findOne("tasks", { description: "Oct collections" })).id;
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
  assert.ok(csv.startsWith("id,owner,description,status") && csv.includes("Buy mediclaim"));
  assert.ok(!csv.includes("priority"));
});

test("message log, msgs command, remark history on master board only", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  bot.ai.parseOwner = async () => ({ tasks: [
    { owner: "Himanshu", task: "Galaxy Royal invoice" },
    { owner: "Himanshu", task: "Sector 76 site visit" }] });
  await bot.handleMessage(text(OWNER, "two tasks"));
  clock.at(16, 11, 59);
  await bot.runPending();
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

  await bot.handleMessage(text(OWNER, `Himanshu ${ids[1]} - ok, confirm by Wednesday`));
  const msgs = JSON.stringify(await bot.boards.masterBoard("messages", "Himanshu"));
  assert.ok(msgs.includes("call kar lena") && msgs.includes('"voice":true'));
  const open = await bot.boards.masterBoard("attention", "", "open");
  const card = open.sections.flatMap((s) => s.cards).find((c) => c.id === ids[1]);
  assert.equal(card.remarks.length, 2);
  assert.ok(JSON.stringify(card.remarks).includes("Client moved visit to Thursday") && JSON.stringify(card.remarks).includes("confirm by Wednesday"));
  const teamCards = JSON.stringify(await bot.boards.teamBoard());
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

  await bot.handleMessage(text(PULKIT, "Hi"));
  await bot.handleMessage(text(OWNER, "Pulkit - last 7 days Amazon ad spend report"));
  const nAfterAssign = wa.to(PULKIT).length;

  assert.equal((await GET(new Request("http://x/api/cron?token=wrong"))).status, 403);

  clock.at(16, 11, 58);
  assert.deepEqual((await hit()).ran, []); // 12:00 has not arrived
  assert.equal(wa.to(PULKIT).length, nAfterAssign);

  clock.at(16, 12, 4);                     // a cron 4 minutes late still catches the slot
  assert.deepEqual((await hit()).ran, ["pending@12:00"]);
  assert.match(wa.last(PULKIT).body, /Pending with you/);

  clock.at(16, 12, 20);                    // a retry must not send the same round twice
  assert.deepEqual((await hit()).ran, []);

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

test("a failed WhatsApp send never loses the task: the next pending round retries it", async () => {
  const clock = makeClock(); clock.at(16, 10);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, PULKIT]) await bot.handleMessage(text(p, "Hi"));
  wa.sent.length = 0;

  // Sent the moment it is assigned, but WhatsApp rejects it. Ankit must be told, and the task
  // must stay queued rather than looking delivered.
  clock.at(16, 11);
  wa.failing = [HIMANSHU];
  await bot.handleMessage(voice(OWNER, "v1"));
  assert.match(wa.last(OWNER).body, /NOT delivered/);
  const a = (await bot.openTasks("Himanshu"))[0];
  assert.equal(a.notified, 0);

  wa.failing = [HIMANSHU, PULKIT];
  await bot.handleMessage(text(OWNER, "Pulkit - last 7 days Amazon ad spend report"));
  const b = (await bot.openTasks("Pulkit"))[0];
  clock.at(16, 11, 59);
  const first = await bot.runPending();
  assert.equal(first.sent.length, 0);
  assert.equal(first.failed.length, 2, JSON.stringify(first));
  assert.equal((await bot.getTask(a.id)).notified, 0);
  assert.equal((await bot.getTask(b.id)).notified, 0);

  // WhatsApp recovers: the 4 PM round delivers both and only then marks them.
  wa.failing = [];
  clock.at(16, 16);
  const second = await bot.runPending();
  assert.deepEqual(second.failed, []);
  assert.match(wa.last(HIMANSHU).body, /Galaxy Royal/);
  assert.match(wa.last(PULKIT).body, /Amazon/);
  assert.equal((await bot.getTask(a.id)).notified, 1);
  assert.equal((await bot.getTask(b.id)).notified, 1);

  // And a broken number for one person must not stop the rest of the team.
  wa.failing = [HIMANSHU];
  clock.at(16, 17);
  const third = await bot.runPending();
  assert.deepEqual(third.sent, ["Pulkit:1"]);
  assert.equal(third.failed.length, 1);
});

test("a task with a time: on the calendar, pinged 5 minutes before, once", async () => {
  const clock = makeClock(); clock.at(17, 14);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(OWNER, "set a reminder for me to call Mr Rahul at 9pm today"));

  // Assigned to Ankit himself, carrying the time, and on the day's calendar.
  const t = await bot.store.findOne("tasks", { owner: "Ankit" });
  assert.equal(t.description, "Call Mr Rahul");
  assert.equal(t.due_at, "2026-11-17T21:00:00+05:30");
  assert.match(wa.last(OWNER).body, /Assigned/);
  assert.match(wa.last(OWNER).body, /09:00 PM/);

  // Nothing before 8:55, the ping at 8:55, and nothing again after.
  clock.at(17, 20, 50);
  assert.deepEqual((await bot.runDue()).sent, []);
  clock.at(17, 20, 55);
  assert.deepEqual((await bot.runDue()).sent, [`Ankit:#${t.id}`]);
  assert.match(wa.last(OWNER).body, /Reminder/);
  assert.match(wa.last(OWNER).body, /Rahul/);
  const n = wa.to(OWNER).length;
  clock.at(17, 21);
  assert.deepEqual((await bot.runDue()).sent, []);
  assert.equal(wa.to(OWNER).length, n);

  // A timed task for someone else is the same path, and it reaches them, not Ankit.
  await bot.handleMessage(text(PULKIT, "Hi"));
  await bot.handleMessage(text(OWNER, "Pulkit ko bolo 9 baje courier ko call kare"));
  const pt = await bot.store.findOne("tasks", { owner: "Pulkit" });
  await bot.runDue();
  assert.match(wa.last(PULKIT).body, /Reminder/);
  assert.equal((await bot.getTask(pt.id)).due_notified, 1);

  // A closed task never pings.
  clock.at(18, 14);
  await bot.handleMessage(text(OWNER, "set a reminder for me to call Mr Rahul at 9pm today"));
  const late = (await bot.openTasks("Ankit")).find((x) => x.due_at && !x.due_notified);
  await bot.setTask(late.id, { status: "done", done_at: bot.nowIso() });
  clock.at(18, 21);
  assert.deepEqual((await bot.runDue()).sent, []);
});

test("the team list: add, edit, remove from WhatsApp, with the rules that keep it usable", async () => {
  const clock = makeClock(); clock.at(16, 9);
  const { bot, wa } = setup(clock);
  const say = async (t) => { await bot.handleMessage(text(OWNER, t)); return wa.last(OWNER).body; };

  // people.yaml is the seed; from then on the store is the list.
  assert.match(await say("people"), /Team \(4\)/);
  assert.match(wa.last(OWNER).body, /Himanshu/);

  // Add, and he is a known sender from the next message on - no restart, no redeploy.
  const added = await say("add Rahul 919812345678");
  assert.match(added, /Rahul\* added/);
  assert.match(added, /919812345678/);
  assert.equal(bot.d.byName("Rahul").phone, "919812345678");
  assert.equal(bot.d.byPhone("919812345678").name, "Rahul");
  await bot.handleMessage(text("919812345678", "Hi"));
  assert.match(wa.last("919812345678").body, /connected to Ankit Desk/);

  // And a task reaches him like anyone else.
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Rahul", task: "Send the Ryan fee register" }] });
  await bot.handleMessage(text(OWNER, "Rahul fee register"));
  assert.match(wa.last("919812345678").body, /fee register/);

  // A ten-digit number borrows the owner's country code; a wrong one is refused, not stored.
  assert.match(await say("add Vikas 9812345679"), /Vikas\* added/);
  assert.equal(bot.d.byName("Vikas").phone, "919812345679");
  assert.match(await say("add Nikhil 12345"), /5 digits/);
  assert.match(await say("add Nikhil 919812345678"), /already Rahul's number/);
  assert.match(await say("add Rahul 919812345670"), /already on the list/);
  // A name that is already a command would eat it.
  assert.match(await say("add Status 919812345670"), /command/);
  assert.equal(bot.d.people.length, 6);

  // Edit each part. A rename carries to everything that points at the name.
  assert.match(await say("edit Rahul alias CA Rahul, Rahul ji"), /also answers to: CA Rahul, Rahul ji/);
  assert.equal(bot.d.byName("ca rahul").name, "Rahul");
  assert.match(await say("edit Rahul name Rahul Verma"), /is now \*Rahul Verma\*/);
  assert.equal((await bot.store.findOne("tasks", { description: "Send the Ryan fee register" })).owner, "Rahul Verma");
  assert.match(await say("edit Rahul Verma phone 919812345611"), /now 919812345611/);
  assert.equal(bot.d.byPhone("919812345611").name, "Rahul Verma");
  assert.equal(bot.d.byPhone("919812345678"), null); // the old number is a stranger again

  // Removing somebody who still has work open would leave that work with nobody on it.
  const open = await bot.openTasks("Rahul Verma");
  assert.match(await say("remove Rahul Verma"), /still has 1 open task/);
  await bot.setTask(open[0].id, { status: "done", done_at: bot.nowIso() });
  assert.match(await say("remove Rahul Verma"), /removed/);
  assert.equal(bot.d.byName("Rahul Verma"), null);
  assert.equal(bot.d.byPhone("919812345611"), null);
  // The history stays, and nothing new reaches them.
  assert.equal((await bot.store.findOne("tasks", { description: "Send the Ryan fee register" })).owner, "Rahul Verma");
  clock.at(16, 11, 59);
  const round = await bot.runPending();
  assert.ok(!round.sent.some((x) => x.startsWith("Rahul")));

  // The board's form sends every field at once and goes through the same rules. Only what
  // actually changed is written, and one bad field saves nothing before it.
  const saved = await bot.team.save("Vikas", { name: "Vikas", phone: "919812345679", alias: "Vikas ji" });
  assert.match(saved.ok, /Saved other names for \*Vikas\*/);
  assert.equal(bot.d.byName("vikas ji").name, "Vikas");
  assert.match((await bot.team.save("Vikas", { phone: "919812345679" })).ok, /Nothing to change/);
  const refused = await bot.team.save("Vikas", { alias: "Vikas bhai", phone: "123" });
  assert.match(refused.error, /3 digits/);
  // Whole or nothing: the good field beside the bad one is not written either.
  assert.equal(bot.d.byName("vikas bhai"), null);
  assert.equal(bot.d.byName("Vikas").phone, "919812345679");

  // "remove the old banner" is a task, not a command.
  bot.ai.parseOwner = async () => ({ tasks: [{ owner: "Vikas", task: "Remove the old banner" }] });
  assert.match(await say("Vikas remove the old banner from the site"), /Assigned/);
});

// Nothing fires if no cron entry covers a slot: that is how the 12:00/16:00/18:00/19:00 reports
// went missing. Vercel's jitter is lateness only (0-59 min past the scheduled minute), and
// /api/cron claims a slot up to 59 min late, so an entry covers a slot when the slot falls in
// [entry, entry+59] in UTC. Change a time in config.js and this fails until vercel.json matches.
test("every scheduled slot has a vercel.json cron entry that covers it", async () => {
  const fs = await import("node:fs");
  const { loadSettings } = await import("../lib/config.js");
  const s = loadSettings({});
  const crons = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;

  const IST_OFFSET = 330; // Asia/Kolkata has no DST, so a fixed offset is the whole of it
  assert.equal(s.timezone, "Asia/Kolkata", "offset below assumes IST");

  const utc = crons.map((c) => {
    assert.equal(c.path, "/api/cron");
    const [m, h] = c.schedule.split(" ");
    assert.match(`${m} ${h}`, /^\d+ \d+$/, `Hobby allows one run a day per entry: ${c.schedule}`);
    return +h * 60 + +m;
  });

  const slots = [...s.pendingTimes.split(",").map((t) => t.trim()), s.reviewTime, s.nudgeTime, s.briefTime];
  for (const hhmm of new Set(slots)) {
    const [h, m] = hhmm.split(":").map(Number);
    const wantUtc = (h * 60 + m - IST_OFFSET + 1440) % 1440;
    assert.ok(utc.some((u) => wantUtc - u >= 0 && wantUtc - u <= 59),
      `${hhmm} IST (${wantUtc} min UTC) has no cron entry within 59 min before it`);
  }
});

test("a meeting: both sides invited, answered, and reminded 5 minutes before — once", async () => {
  const clock = makeClock(); clock.at(17, 9);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, SHALU]) await bot.handleMessage(text(p, "Hi"));

  await bot.handleMessage(text(OWNER, "meeting with Himanshu and Shalu at 4"));
  const m = await bot.store.findOne("meetings", {});
  assert.deepEqual(m.with, ["Himanshu", "Shalu"]);
  assert.equal(m.at, "2026-11-17T16:00:00+05:30");
  assert.equal(m.status, "called");

  // Both attendees were invited, with the time, who else is coming, and meeting buttons —
  // not the task buttons: there is nothing to mark "Done" on a meeting.
  for (const p of [HIMANSHU, SHALU]) {
    const inv = wa.last(p);
    assert.equal(inv.kind, "buttons");
    assert.match(inv.body, /Meeting called by Ankit/);
    assert.match(inv.body, /04:00 PM/);
    assert.deepEqual(inv.buttons.map((b) => b.id), [`mt:${m.id}:yes`, `mt:${m.id}:no`, `mt:${m.id}:move`]);
  }
  assert.match(wa.last(OWNER).body, /Meeting set/);
  assert.match(wa.last(OWNER).body, /told Himanshu, Shalu/);

  // One answers by tapping, the other in words. Both reach Ankit.
  await bot.handleMessage(btn(HIMANSHU, `mt:${m.id}:yes`));
  assert.match(wa.last(HIMANSHU).body, /you are down for the meeting/);
  assert.match(wa.last(OWNER).body, /\*Himanshu\* coming/);
  await bot.handleMessage(text(SHALU, "haan 4 baje theek hai"));
  assert.match(wa.last(OWNER).body, /\*Shalu\* coming/);
  assert.deepEqual((await bot.getMeeting(m.id)).responses, { Himanshu: "yes", Shalu: "yes" });

  // Nothing at 3:50. At 3:55 everyone expected is reminded — Ankit included, which is what
  // a task reminder never does.
  clock.at(17, 15, 50);
  assert.deepEqual((await bot.runDue()).sent, []);
  clock.at(17, 15, 55);
  assert.deepEqual((await bot.runDue()).sent, [`M${m.id}`]);
  for (const p of [OWNER, HIMANSHU, SHALU]) assert.match(wa.last(p).body, /Meeting in 5 minutes/);

  // At-most-once, exactly like a timed task.
  const counts = [OWNER, HIMANSHU, SHALU].map((p) => wa.to(p).length);
  clock.at(17, 15, 57);
  assert.deepEqual((await bot.runDue()).sent, []);
  assert.deepEqual([OWNER, HIMANSHU, SHALU].map((p) => wa.to(p).length), counts);
});

test("judgement calls wait for Ankit: a routed task and a reply that approves a rate", async () => {
  const clock = makeClock(); clock.at(17, 10);
  const { bot, wa } = setup(clock);
  for (const p of [HIMANSHU, PULKIT]) await bot.handleMessage(text(p, "Hi"));

  // He named nobody. The bot worked out Pulkit from what Pulkit handles, so it asks first
  // and sends nothing.
  await bot.handleMessage(text(OWNER, "file the GST refund"));
  assert.equal(await bot.store.count("tasks", {}), 0);
  // The confirm carries the buttons; the plain line after it is only the summary.
  const ask = wa.to(OWNER).filter((x) => x.kind === "buttons").pop();
  assert.match(ask.body, /I'd send this to \*Pulkit\* — handles GST refunds/);
  assert.deepEqual(ask.buttons.map((b) => b.title), ["✅ Send", "👤 Someone else", "✖️ Cancel"]);
  const act = await bot.store.findOne("pending_actions", {});

  // Someone else: the next name he sends is the answer to that question, not a new task.
  await bot.handleMessage(btn(OWNER, `cf:${act.id}:who`));
  assert.match(wa.last(OWNER).body, /Who should get it/);
  await bot.handleMessage(text(OWNER, "Himanshu"));
  const t = await bot.store.findOne("tasks", {});
  assert.equal(t.owner, "Himanshu");
  assert.match(wa.last(HIMANSHU).body, /GST refund/);

  // Cancel sends nothing at all.
  await bot.handleMessage(text(OWNER, "file the GST refund"));
  const act2 = await bot.store.findOne("pending_actions", { status: "open" });
  await bot.handleMessage(btn(OWNER, `cf:${act2.id}:no`));
  assert.match(wa.last(OWNER).body, /Dropped/);
  assert.equal(await bot.store.count("tasks", {}), 1);

  // A reply that commits to a rate is held the same way, and goes out on Send.
  const task = await bot.store.insert("tasks", { owner: "Himanshu", description: "Galaxy Royal AMC quotation",
    status: "stuck", stuck_on: "ankit", created_at: bot.nowIso(), updated_at: bot.nowIso(), notified: 1 });
  const before = wa.to(HIMANSHU).length;
  await bot.handleMessage(text(OWNER, "Himanshu rate approved at 4500"));
  assert.equal(wa.to(HIMANSHU).length, before, "nothing reached Himanshu before Ankit confirmed");
  const act3 = await bot.store.findOne("pending_actions", { status: "open" });
  assert.match(wa.to(OWNER).filter((x) => x.kind === "buttons").pop().body, /approves a rate of 4,500/);
  await bot.handleMessage(btn(OWNER, `cf:${act3.id}:ok`));
  assert.match(wa.last(HIMANSHU).body, /Rate approved at 4,500/);

  // A tap on something already dealt with says so rather than sending it twice.
  await bot.handleMessage(btn(OWNER, `cf:${act3.id}:ok`));
  assert.match(wa.last(OWNER).body, /already dealt with/);
});

test("an invite to someone outside the 24-hour window: its own template, and a fallback while that one is in review", async () => {
  const clock = makeClock(); clock.at(17, 9);
  const { bot, wa } = setup(clock);
  // Neither has ever messaged the bot, so the window is shut and only a template may go.
  await bot.handleMessage(text(OWNER, "meeting with Himanshu and Shalu at 4"));

  // The meeting template, not the task one — and carrying the meeting's own facts.
  const inv = wa.to(HIMANSHU).find((m) => m.kind === "template");
  assert.equal(inv.name, "meeting_invite");
  assert.deepEqual(inv.params, ["Himanshu", "17 Nov 04:00 PM", "Tally data review"]);
  assert.equal(wa.to(HIMANSHU).filter((m) => m.kind !== "template").length, 0, "nothing else can go out yet");
  assert.match(wa.last(OWNER).body, /have not messaged in 24h/);

  // That template says a meeting was called; it is not the invitation. So when they reply,
  // the whole invite still arrives, with its buttons.
  await bot.handleMessage(text(HIMANSHU, "Hi"));
  const full = wa.to(HIMANSHU).filter((m) => m.kind === "buttons").pop();
  assert.match(full.body, /Meeting called by Ankit/);
  assert.match(full.body, /With: Ankit, Shalu/);
  const m = await bot.store.findOne("meetings", {});
  assert.deepEqual(full.buttons.map((b) => b.id), [`mt:${m.id}:yes`, `mt:${m.id}:no`, `mt:${m.id}:move`]);

  // While Meta still has meeting_invite in review it is rejected, and the older task
  // template carries the invite instead. Nobody is left unheard because of a pending review.
  const b2 = setup(clock);
  b2.wa.failingTemplates = ["meeting_invite"];
  await b2.bot.handleMessage(text(OWNER, "meeting with Himanshu and Shalu at 4"));
  const fb = b2.wa.to(HIMANSHU).find((x) => x.kind === "template");
  assert.equal(fb.name, "task_reminder");
  assert.match(fb.params[1], /Meeting called by Ankit/);
  assert.match(b2.wa.last(OWNER).body, /told Himanshu, Shalu/);
});

test("the bot learns what someone handles from the tasks it is given, and never writes it unasked", async () => {
  const clock = makeClock(); clock.at(17, 9);
  const { bot, wa } = setup(clock);
  await bot.handleMessage(text(PULKIT, "Hi"));
  await bot.team.edit("Pulkit", "does", ""); // a person nobody has described yet
  const give = async (n) => {
    for (let i = 0; i < n; i++) await bot.handleMessage(text(OWNER, `Pulkit – share the 7-day Amazon ad spend report ${i}`));
  };

  // Four tasks is not a pattern: nothing is proposed.
  await give(4);
  assert.equal(await bot.proposeBeat(), null);
  assert.equal(await bot.store.count("pending_actions", {}), 0);

  // The fifth makes it worth asking. It asks — and writes nothing yet.
  await give(1);
  assert.equal(await bot.proposeBeat(), "Pulkit");
  const ask = wa.to(OWNER).filter((m) => m.kind === "buttons").pop();
  assert.match(ask.body, /What does Pulkit handle/);
  assert.match(ask.body, /From the 5 tasks/);
  assert.match(ask.body, /Amazon ads, ad spend reports/);
  const act = await bot.store.findOne("pending_actions", { kind: "beat" });
  assert.deepEqual(ask.buttons.map((b) => b.title), ["✅ Yes, save it", "✍️ I'll write it", "✖️ Not now"]);
  assert.equal((await bot.team.find("Pulkit")).does || "", "", "nothing written before he taps");

  // Asked once, then left alone for a week rather than every evening.
  assert.equal(await bot.proposeBeat(), null);

  // His own words win over the draft.
  await bot.handleMessage(btn(OWNER, `cf:${act.id}:who`));
  assert.match(wa.last(OWNER).body, /What does \*Pulkit\* handle/);
  await bot.handleMessage(text(OWNER, "Amazon ads, Diamond Royal, monthly ad billing"));
  assert.equal((await bot.team.find("Pulkit")).does, "Amazon ads, Diamond Royal, monthly ad billing");

  // Someone whose tasks show no pattern is never given an invented one.
  const b2 = setup(clock);
  await b2.bot.handleMessage(text(RAJNEESH, "Hi"));
  for (let i = 0; i < 6; i++) {
    await b2.bot.store.insert("tasks", { owner: "Rajneesh", description: `Thing ${i}`, status: "new",
      created_at: b2.bot.nowIso(), updated_at: b2.bot.nowIso(), notified: 1 });
  }
  assert.equal(await b2.bot.proposeBeat(), null, "no pattern, so no proposal");
  assert.equal(await b2.bot.store.count("pending_actions", { kind: "beat" }), 0);
  assert.equal((await b2.bot.team.find("Rajneesh")).does || "", "");

  // "Not now" leaves it blank and stops the asking.
  const b3 = setup(clock);
  await b3.bot.handleMessage(text(PULKIT, "Hi"));
  await b3.bot.team.edit("Pulkit", "does", "");
  for (let i = 0; i < 5; i++) await b3.bot.handleMessage(text(OWNER, `Pulkit – Amazon ad spend ${i}`));
  await b3.bot.proposeBeat();
  const a3 = await b3.bot.store.findOne("pending_actions", { kind: "beat" });
  await b3.bot.handleMessage(btn(OWNER, `cf:${a3.id}:no`));
  assert.match(b3.wa.last(OWNER).body, /never be guessed onto Pulkit/);
  assert.equal((await b3.bot.team.find("Pulkit")).does || "", "");
  clock.at(24, 9); // a week later
  assert.equal(await b3.bot.proposeBeat(), null, "declined, so not asked again for two months");
});
