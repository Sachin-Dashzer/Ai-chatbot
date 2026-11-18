
import { cleanParam, BODY_MAX } from "./whatsapp.js";
import { Settings } from "./settings.js";
import { Team } from "./people.js";
import { Boards, MASTER } from "./boards.js";
import { isoLocal, localDate, addDays, daysBetween, fmtWeekday, fmtStamp, fmtTime } from "./time.js";

export const HELP = [
  "*How to use*",
  "Send a voice note or text with the task:",
  '"Himanshu – send Galaxy Royal invoice"',
  "Several tasks in one voice note are fine. Every task reaches the person the moment you send it, with Done / Working / Remark buttons under it.",
  "Everyone gets ONE list of what is pending on them at 12 noon and 4 PM, and replies to it once. You get the day's overview at 6 PM.",
  "",
  'For yourself: "Me – review Goodbite reply"',
  'With a time: "remind me to call Mr Rahul at 9 pm today" – it sits on the calendar and pings you 5 minutes before.',
  'Answer a stuck task: "Himanshu 16 – rate 4,500 approved"',
  'Your own tasks: "1 done, 2 done" or just say "CRM templates ho gaye"',
  "",
  "Commands:",
  "• *brief* – summary now",
  "• *today* – everything you assigned today and its status",
  "• *list* – all open tasks",
  "• *done 12* (or *done 12 15*) – close tasks",
  "• *cancel 12* – cancel a task",
  "",
  "Per-person settings:",
  "• *reminder off Narendra* / *reminder on Narendra*",
  "• *checkin Narendra mon thu* / *checkin Narendra daily* / *checkin Narendra off*",
  "• *pause Narendra today* / *pause Narendra 20 nov* / *pause Narendra till 25 nov* / *resume Narendra*",
  "• *settings* – see everyone's settings",
  "",
  "Fixing mistakes:",
  "• *reopen 12* – undo a task closed by mistake",
  "• *move 12 EPC* – change a task's business",
  "• *assign 12 Narendra* – give a task to someone else",
  "",
  "Your team:",
  "• *people* – who is on the list, with their numbers",
  "• *add Rahul 919812345678 Ryan* – add someone (name, number, business)",
  "• *edit Rahul phone 919...* / *group EPC* / *name Rahul Verma* / *alias CA Rahul*",
  "• *remove Rahul* – stop everything reaching them (their history stays)",
  "",
  "Boards and messages:",
  "• *boards* – get all board links",
  "• *msgs Himanshu* – his last messages word for word (*msgs* = whole team)",
  "• *newlink EPC* / *newlink master* – replace a leaked link",
  "",
  "Someone new, or quiet for a day:",
  "• *start Narendra* – send the approved template so the 24-hour window can open (*start all* for everyone)",
  "• Not needed before a task: the bot sends that template itself and releases the task the moment they reply",
].join("\n");

export const STATUS_LABEL = { new: "not started", working: "working", stuck: "stuck", done: "done", cancelled: "cancelled" };

const REPLY_RE = /^\s*(?:([A-Za-z]+)\s+)?#?(\d{1,5})\s*[-–—:]\s*([\s\S]+)$/;
const GREETINGS = new Set(["hi", "hello", "hey", "ok", "okay", "thanks", "thank you", "ji", "hii", "namaste", "noted", "👍", "ok sir", "yes sir"]);
const WINDOW_MS = (23 * 60 + 30) * 60000;
const TEMPLATE_GAP_MS = 3 * 3600000;
// A task that carries a time is announced this long before it is due: "call Rahul at 9 PM" pings at 8:55.
const DUE_LEAD_MS = 5 * 60000;
const STATUS_WORDS = { done: "done", "ho gaya": "done", hogaya: "done", "ho gya": "done", complete: "done",
  completed: "done", finished: "done", working: "working", pending: "working" };
const OPEN = { $nin: ["done", "cancelled"] };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// The three taps under every task. Meta allows three reply buttons and no more, so these are
// the three that close the loop: it is finished, it is in hand, or it needs words. "Noted" is
// what Working already says, and anything longer than a status goes in the remark.
const BTN = [["done", "✅ Done"], ["working", "⏳ Working"], ["remark", "✍️ Remark"]];
const BTN_RE = /^st:(\d{1,5}):(done|working|remark)$/;
const taskButtons = (id) => BTN.map(([k, title]) => ({ id: `st:${id}:${k}`, title }));
const STATUS_MARK = { new: "⬜", working: "⏳", stuck: "🚧", done: "✅", cancelled: "✖️" };

export class Bot {
  constructor({ settings, store, wa, ai, directory, now }) {
    this.s = settings;
    this.store = store;
    this.ai = ai;
    this.d = directory;
    this._now = now;
    this.cfg = new Settings(store, directory);
    this.boards = new Boards(this);
    this.team = new Team(this);
    this.wa = this._loggingWa(wa);
  }

  // Everything the bot sends is recorded, so the boards can show both sides of
  // each conversation. One wrapper rather than 32 call sites; it writes to its
  // own collection, so `messages` stays the inbound log it has always been.
  // Only a message to the team is kept: Ankit's own briefs and command replies
  // are his half of a conversation with himself.
  _loggingWa(wa) {
    const out = Object.create(wa);
    const log = async (phone, text, auto) => {
      try {
        const person = this.d.byPhone(String(phone));
        if (!person || person.phone === this.d.owner.phone) return;
        await this.store.insert("messages_out", {
          person: person.name, text, auto: auto ? 1 : 0, created_at: this.nowIso(),
        });
      } catch (e) {
        // A log that fails must never cost a delivered message.
        console.error("[ankit-desk] could not record an outgoing message", e);
      }
    };
    out.sendText = async (to, body) => {
      const r = await wa.sendText(to, body);
      await log(to, body, !this._manualSend);
      return r;
    };
    out.sendButtons = async (to, body, buttons) => {
      const r = await wa.sendButtons(to, body, buttons);
      // The buttons are part of what the person saw, so the board shows them as the row of
      // taps they are rather than a message that mysteriously ends early.
      await log(to, `${body}\n[ ${buttons.map((b) => b.title).join(" ] [ ")} ]`, !this._manualSend);
      return r;
    };
    out.sendTemplate = async (to, name, bodyParams = [], buttonPayloads = []) => {
      const r = await wa.sendTemplate(to, name, bodyParams, buttonPayloads);
      await log(to, `Template “${name}” sent: ${bodyParams.join(" · ")}`, true);
      return r;
    };
    return out;
  }

  // ---------- time ----------
  now() { return this._now ? this._now() : new Date(); }
  nowIso() { return isoLocal(this.now(), this.s.timezone); }
  today() { return localDate(this.now(), this.s.timezone); }
  age(t) {
    const d = daysBetween(t.created_at.slice(0, 10), this.today());
    return d === 0 ? "today" : plural(d, "day");
  }
  // The AI gives a due moment as "2026-11-17T21:00" (local, no offset). Stored carrying the
  // same offset as every other time here, so plain string compare still orders it.
  dueIso(raw) {
    const m = String(raw || "").match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
    return m ? `${m[1]}T${String(+m[2]).padStart(2, "0")}:${m[3]}:00${this.nowIso().slice(19)}` : null;
  }
  dueLabel(iso) {
    return iso.slice(0, 10) === this.today() ? fmtTime(iso) : fmtStamp(iso);
  }
  async paused(person) {
    return person !== this.d.owner && this.cfg.paused(person.name, this.today());
  }

  // ---------- tasks ----------
  async openTasks(owner) {
    return this.store.find("tasks", owner ? { status: OPEN, owner } : { status: OPEN }, { sort: { id: 1 } });
  }
  getTask(id) { return this.store.findOne("tasks", { id }); }
  getOpenTask(id) { return this.store.findOne("tasks", { id, status: OPEN }); }
  setTask(id, set) { return this.store.update("tasks", { id }, { ...set, updated_at: this.nowIso() }); }

  // ---------- delivery with the 24h rule ----------
  async inWindow(phone) {
    const r = await this.store.findOne("inbound", { phone });
    return !!r && this.now() - Date.parse(r.last_at) < WINDOW_MS;
  }

  // One exit for everything the team is sent, so buttons and long bodies behave the same way
  // wherever the message came from. Interactive bodies are capped well below a text message's,
  // and cutting the work to make room for the buttons is exactly the gap this had: so a long
  // body goes out whole as text first, and the buttons follow on a short line of their own.
  async _out(phone, text, buttons) {
    if (!buttons || !buttons.length) return this.wa.sendText(phone, text);
    if (text.length <= BODY_MAX) return this.wa.sendButtons(phone, text, buttons);
    await this.wa.sendText(phone, text);
    return this.wa.sendButtons(phone, "Tap your status for the task above 👆", buttons);
  }

  async deliver(person, text, buttons) {
    const held = { phone: person.phone, text, buttons: buttons || null, created_at: this.nowIso() };
    if (await this.paused(person)) {
      await this.store.insert("pending_msgs", held);
      return;
    }
    if (await this.inWindow(person.phone)) return this._out(person.phone, text, buttons);
    await this.store.insert("pending_msgs", held);
    await this.notify(person);
  }

  async notify(person) {
    const last = await this.store.findOne("template_log", { phone: person.phone });
    if (last && this.now() - Date.parse(last.last_at) < TEMPLATE_GAP_MS) return; // one is already waiting for a reply
    await this.openWindow(person);
  }

  // Send the approved template and note when, so the throttle above holds.
  // The task rides in the template's own body: outside the 24-hour window Meta lets
  // nothing else through, and nobody should have to tap or reply to find out what the
  // work is. task_reminder takes three params — the person, the work, the due date —
  // and carries no button, so there is nothing to click.
  async openWindow(person) {
    const held = await this.store.find("pending_msgs", { phone: person.phone }, { sort: { id: 1 } });
    const task = held.map((r) => r.text).join(" · ") || "a task update";
    await this.wa.sendTemplate(person.phone, this.s.firstTemplate, [person.name, task, "today"]);
    // What the template delivered WORD FOR WORD must not arrive a second time when the reply
    // flushes the queue - but nothing else may be marked. A template parameter cannot carry a
    // newline, so cleanParam flattens the body to fit, and a flattened task message is not the
    // message: the headings, the lines and the task numbers are gone. Comparing against
    // cleanParam's own output is the only honest test of "they already read all of it", and it
    // is why a formatted task now always arrives in full as text once the window opens.
    if (cleanParam(task) === task) {
      for (const r of held) await this.store.update("pending_msgs", { id: r.id }, { in_template: 1 });
    }
    await this.store.upsert("template_log", { phone: person.phone }, { last_at: this.nowIso() });
  }

  // Every task message is written here and nowhere else, so each one reads the same way: what
  // to do first and in full, the task's own number and business under it, and the three taps
  // below that. The description itself was spelled and punctuated by the parser before it was
  // ever stored, so this is the whole of the "check it before it goes" rule in one place.
  taskBody(t) {
    const foot = [`#${t.id}`, t.business];
    if (t.due_at) foot.push(`⏰ ${this.dueLabel(t.due_at)}`);
    return [`📋 *New task from Ankit*`, "", t.description, "", `_${foot.join(" · ")}_`].join("\n");
  }

  sendTask(person, t) {
    return this.deliver(person, this.taskBody(t), taskButtons(t.id));
  }

  async releaseHeld(person) {
    const n = await this.store.count("pending_msgs", { phone: person.phone });
    if (!n) return;
    if (await this.inWindow(person.phone)) await this.flushPending(person.phone);
    else await this.notify(person);
  }

  // Reports whether anything was actually sent, not merely dequeued: a tap on a template
  // button must say "all caught up" when every held row was already read in a template.
  async flushPending(phone) {
    const rows = await this.store.find("pending_msgs", { phone }, { sort: { id: 1 } });
    let sent = 0;
    for (const r of rows) if (!r.in_template) { await this._out(phone, r.text, r.buttons); sent++; }
    if (rows.length) {
      await this.store.remove("pending_msgs", { phone });
      await this.store.remove("template_log", { phone });
    }
    return sent > 0;
  }

  // ---------- inbound ----------
  async handleMessage(msg) {
    // Before byPhone: somebody added a minute ago in the browser is a known sender now.
    await this.team.sync();
    if (msg.id) {
      if (await this.store.findOne("seen_messages", { mid: msg.id })) return;
      await this.store.insert("seen_messages", { mid: msg.id });
    }
    const phone = msg.from;
    const person = this.d.byPhone(phone);
    if (!person) return console.log("Ignoring message from unknown number", phone);
    await this.store.upsert("inbound", { phone }, { last_at: this.nowIso() });
    const type = msg.type;

    // A tap. Two kinds reach here: the status buttons under a task (interactive, carrying the
    // id we set) and a quick reply on an older template, which Meta reports by payload or by
    // the button's own text. The tap itself opens the 24-hour window, so anything held is
    // released first either way.
    if (type === "button" || type === "interactive") {
      const id = msg.interactive?.button_reply?.id || msg.button?.payload || "";
      const m = BTN_RE.exec(id);
      const flushed = await this.flushPending(phone);
      if (m) return this.tapStatus(person, Number(m[1]), m[2]);
      if (!flushed) await this.wa.sendText(phone, "You're all caught up.");
      return;
    }

    const flushed = await this.flushPending(phone); // person opened the window: release anything held first
    let text;
    if (type === "text") text = msg.text.body.trim();
    else if (type === "audio") {
      try {
        const { bytes, mime } = await this.wa.downloadMedia(msg.audio.id);
        text = await this.ai.transcribe(bytes, mime);
      } catch (e) {
        console.error("Transcription failed", e);
        return this.wa.sendText(phone, "Couldn't read that voice note. Please send it again or type it.");
      }
    } else {
      if (!flushed) await this.wa.sendText(phone, "Please send a text or voice note.");
      return;
    }

    if (this.d.isOwner(phone)) return this.ownerText(text);
    await this.store.insert("messages", { person: person.name, kind: type === "audio" ? "voice" : "text", text, created_at: this.nowIso() });
    return this.teamText(person, text);
  }

  // ---------- Ankit ----------
  async ownerText(text) {
    const phone = this.d.owner.phone;
    if (await this.ownerCommand(text)) return;
    if (await this.ownerQuickStatus(text)) return;
    const m = text.match(REPLY_RE);
    if (m) {
      const task = await this.getOpenTask(+m[2]);
      const named = m[1] ? this.d.byName(m[1]) : null;
      if (task && task.owner !== this.d.owner.name && (!m[1] || (named && named.name === task.owner))) {
        // His own words, typed on a phone, about to be forwarded verbatim: spelled and
        // punctuated first. Everything else the team receives was written by the parser,
        // which corrects as it reads, so this is the one path that needs its own pass.
        return this.replyToTask(task, await this.ai.polish(m[3].trim()));
      }
    }
    let parsed;
    try {
      parsed = await this.ai.parseOwner(text, await this.openTasks(),
        `${fmtWeekday(this.nowIso())}, ${fmtTime(this.nowIso())} (${this.nowIso()})`);
    } catch (e) {
      console.error("Parsing failed", e);
      return this.wa.sendText(phone, "Couldn't process that right now. Please resend in a minute.");
    }
    const out = [];
    const own = new Set((await this.openTasks(this.d.owner.name)).map((t) => t.id));
    const doneLines = [];
    for (const u of parsed.own_updates || []) {
      const id = Number(u.task_id);
      if (own.has(id) && ["done", "working"].includes(u.status)) {
        await this.setOwnStatus(id, u.status);
        doneLines.push(`#${id} ${u.status === "done" ? "✓ done" : "working"}`);
      }
    }
    if (doneLines.length) out.push(doneLines.join("\n") + "\n" + (await this.dayScoreLine()));
    for (const r of parsed.replies || []) {
      const task = await this.getOpenTask(Number(r.task_id) || 0);
      if (task && task.owner !== this.d.owner.name && r.message) {
        await this.replyToTask(task, r.message, false);
        out.push(`↪ Sent to ${task.owner} on #${task.id}: ${r.message}`);
      }
    }
    const dups = [];
    for (const d of parsed.duplicates || []) {
      const row = await this.getOpenTask(Number(d.task_id) || 0);
      if (row) dups.push(`#${row.id} ${row.owner}: ${row.description}`);
    }
    if (dups.length) out.push("Already open (not added again):\n" + dups.join("\n"));
    const created = await this.createTasks(parsed, text);
    if (created.length) out.push((created.length === 1 ? "Assigned" : `Assigned (${created.length})`) + "\n" + created.join("\n"));
    const unclear = (parsed.unclear || []).filter(Boolean);
    if (unclear.length) out.push("⚠️ Couldn't tell who should do this – resend with the person's name:\n" + unclear.map((u) => `• ${u}`).join("\n"));
    await this.wa.sendText(phone, out.length ? out.join("\n\n") : "Couldn't find a task in that. Type *help* for the format.");
  }

  async messagesText(args) {
    let n = Number(args.find((a) => /^\d+$/.test(a)) || 15);
    n = Math.max(1, Math.min(n, 50));
    const names = args.filter((a) => !/^\d+$/.test(a));
    const person = names.length ? this.d.byName(names.join(" ")) : null;
    if (names.length && !person) return `Don't know '${names.join(" ")}'.`;
    const rows = await this.store.find("messages", person ? { person: person.name } : {}, { sort: { id: -1 }, limit: n });
    const head = `*Last ${rows.length} messages – ${person ? person.name : "team"}*`;
    if (!rows.length) return head + "\nNo messages yet.";
    return [head, ...rows.reverse().map((r) =>
      `• ${fmtStamp(r.created_at)} ${r.kind === "voice" ? "🎤 " : ""}${person ? "" : `${r.person}: `}${r.text}`)].join("\n");
  }

  async ownerQuickStatus(text) {
    const t = text.toLowerCase().trim();
    const words = Object.keys(STATUS_WORDS).sort((a, b) => b.length - a.length).join("|");
    const re = new RegExp(`#?(\\d{1,5})\\s*(${words})`, "g");
    const pairs = [...t.matchAll(re)];
    if (!pairs.length || t.replace(re, "").replace(/[\s,.;&]|and/g, "") !== "") return false;
    const idx = Object.fromEntries((await this.store.find("checkin_items", { owner: this.d.owner.name })).map((r) => [r.idx, r.task_id]));
    const own = new Set((await this.openTasks(this.d.owner.name)).map((r) => r.id));
    const lines = [];
    for (const [, num, word] of pairs) {
      const n = Number(num);
      const id = own.has(idx[n]) ? idx[n] : own.has(n) ? n : null;
      if (id === null) { lines.push(`${n}: not one of your open tasks`); continue; }
      const st = STATUS_WORDS[word];
      await this.setOwnStatus(id, st);
      lines.push(`#${id} ${st === "done" ? "✓ done" : "working"}`);
    }
    await this.wa.sendText(this.d.owner.phone, lines.join("\n") + "\n" + (await this.dayScoreLine()));
    return true;
  }

  async setOwnStatus(id, st) {
    if (st === "done") await this.setTask(id, { status: "done", done_at: this.nowIso() });
    else await this.setTask(id, { status: "working" });
  }

  // Ankit's own tasks for a day: done that day, and still open (created on/before that day)
  async day(ymd) {
    const owner = this.d.owner.name;
    const done = (await this.store.find("tasks", { owner, status: "done" }, { sort: { id: 1 } }))
      .filter((t) => (t.done_at || "").slice(0, 10) === ymd);
    const open = (await this.openTasks(owner)).filter((t) => t.created_at.slice(0, 10) <= ymd);
    return { done, open };
  }

  async dayScoreLine(ymd) {
    const { done, open } = await this.day(ymd || this.today());
    const total = done.length + open.length;
    return total ? `Today: ${done.length} of ${total} done` : "";
  }

  async ownerCommand(text) {
    const t = text.toLowerCase().trim();
    const phone = this.d.owner.phone;
    const reply = (await this.team.handle(text)) || (await this.cfg.handle(text, this.today()));
    if (reply) { await this.wa.sendText(phone, reply); return true; }
    if (/^(msgs|messages)(\s|$)/.test(t)) {
      await this.wa.sendText(phone, await this.messagesText(t.split(/\s+/).slice(1)));
      return true;
    }
    if (["boards", "board", "links"].includes(t)) {
      await this.wa.sendText(phone, this.s.baseUrl ? await this.boards.linksText(this.s.baseUrl)
        : "Board links need BASE_URL set on the server (ask Sachin).");
      return true;
    }
    const w = t.replace(/,/g, " ").split(/\s+/);
    if (w.length === 2 && w[0] === "newlink") {
      const scope = w[1] === "master" ? MASTER : this.boards.teamBusinesses().find((b) => b.toLowerCase() === w[1]);
      if (!scope) await this.wa.sendText(phone, "Say e.g. newlink EPC or newlink master");
      else {
        const k = await this.boards.regenerate(scope);
        await this.wa.sendText(phone, `New link (old one no longer works):\n${(this.s.baseUrl || "").replace(/\/$/, "")}/board/${k}`);
      }
      return true;
    }
    // "start Narendra" / "start all": open the 24-hour window on purpose, before
    // there is any task to send. Nothing else needs it — a task opens the window
    // by itself — but after a quiet day it is the one thing Ankit can do from his
    // phone to make sure the next message lands as plain text.
    if (w[0] === "start" && w.length === 2) {
      const targets = w[1] === "all" ? this.d.people : [this.d.byName(w[1])].filter(Boolean);
      if (!targets.length) {
        await this.wa.sendText(phone, `Don't know '${w[1]}'. Say "start Narendra" or "start all".`);
        return true;
      }
      const lines = [];
      for (const p of targets) {
        if (p === this.d.owner) { lines.push("That is you – nothing to open."); continue; }
        if (await this.inWindow(p.phone)) { lines.push(`${p.name}: window already open, send the task straight away.`); continue; }
        try {
          await this.openWindow(p);
          lines.push(`${p.name}: ${this.s.firstTemplate} sent – the window opens the moment they reply.`);
        } catch (e) {
          lines.push(`${p.name}: ⚠️ NOT sent – ${e.message.slice(0, 90)}`);
        }
      }
      await this.wa.sendText(phone, lines.join("\n"));
      return true;
    }
    if (w.length === 3 && ["move", "assign"].includes(w[0]) && /^#?\d+$/.test(w[1])) {
      const id = Number(w[1].replace("#", ""));
      const row = await this.getTask(id);
      if (!row) { await this.wa.sendText(phone, `No task #${id}.`); return true; }
      if (w[0] === "move") {
        const b = this.d.businesses.find((x) => x.toLowerCase() === w[2]);
        if (!b) { await this.wa.sendText(phone, "Business not found. Use one of: " + this.d.businesses.join(", ")); return true; }
        await this.setTask(id, { business: b });
        await this.wa.sendText(phone, `#${id} moved to ${b}: ${row.description}`);
      } else {
        const p = this.d.byName(w[2]);
        if (!p) { await this.wa.sendText(phone, `Don't know '${w[2]}'.`); return true; }
        const isOwner = p === this.d.owner;
        await this.setTask(id, { owner: p.name, notified: isOwner ? 1 : 0, status: "new", stuck_on: null });
        let when = "";
        if (!isOwner && !(await this.paused(p))) {
          try {
            await this.sendTask(p, { ...row, owner: p.name });
            await this.setTask(id, { notified: 1 });
          } catch (e) {
            console.error("[ankit-desk] task send failed on reassign", id, e);
            when = ` ⚠️ NOT delivered (${e.message.slice(0, 80)}) – retrying at 12 noon`;
          }
        } else if (!isOwner) when = ` (held – ${p.name} is paused)`;
        await this.wa.sendText(phone, `#${id} reassigned to ${p.name}` + when);
      }
      return true;
    }
    if (["help", "?"].includes(t)) { await this.wa.sendText(phone, HELP); return true; }
    if (["brief", "summary", "pending"].includes(t)) { await this.wa.sendText(phone, await this.buildBrief()); return true; }
    if (["today", "overview", "status"].includes(t)) { await this.wa.sendText(phone, await this.buildTodayOverview()); return true; }
    if (["list", "open", "tasks"].includes(t)) { await this.wa.sendText(phone, await this.buildList()); return true; }
    const parts = t.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && ["done", "cancel", "reopen"].includes(parts[0]) &&
      parts.slice(1).every((p) => /^#?\d+$/.test(p))) {
      const lines = [];
      for (const p of parts.slice(1)) {
        const id = Number(p.replace("#", ""));
        const row = await this.getTask(id);
        if (!row) { lines.push(`No task #${id}`); continue; }
        if (parts[0] === "done") await this.setTask(id, { status: "done", done_at: this.nowIso() });
        else if (parts[0] === "reopen") await this.setTask(id, { status: "working", done_at: null });
        else await this.setTask(id, { status: "cancelled" });
        lines.push(`#${id} → ${parts[0]}: ${row.description}`);
      }
      await this.wa.sendText(phone, lines.join("\n"));
      return true;
    }
    return false;
  }

  async replyToTask(task, message, confirm = true) {
    const person = this.d.byName(task.owner);
    // Ankit wrote this one himself, so it is not marked automated on the board.
    this._manualSend = true;
    try {
      const body = [`💬 *Ankit on #${task.id}*`, "", message, "", `_${task.description}_`].join("\n");
      await this.deliver(person, body, taskButtons(task.id));
    } finally {
      this._manualSend = false;
    }
    await this.store.insert("task_notes", { task_id: task.id, person: this.d.owner.name, status: null, text: message, created_at: this.nowIso() });
    if (task.status === "stuck" && task.stuck_on === "ankit") {
      await this.setTask(task.id, { status: "working", stuck_on: null, note: `Ankit: ${message}`.slice(0, 300) });
    }
    if (confirm) {
      const back = task.stuck_on === "ankit" ? ` #${task.id} moved back to working.` : "";
      await this.wa.sendText(this.d.owner.phone, `Sent to ${person.name}.${back}`);
    }
  }

  async createTasks(parsed, source) {
    const lines = [];
    for (const t of parsed.tasks || []) {
      const person = this.d.byName(t.owner);
      const desc = (t.task || "").trim();
      if (!person || !desc) { (parsed.unclear ||= []).push(desc || JSON.stringify(t)); continue; }
      let business = t.business || person.business;
      if (!this.d.businesses.includes(business)) business = person.business;
      const mine = person === this.d.owner;
      const held = !mine && (await this.paused(person)); // on leave: held until they are back
      const now = this.nowIso();
      const dueAt = this.dueIso(t.due_at);
      const task = await this.store.insert("tasks", {
        business, owner: person.name, description: desc, status: "new",
        stuck_on: null, note: null, notified: mine ? 1 : 0, source_text: source,
        created_at: now, updated_at: now, last_update_date: null, done_at: null,
        due_at: dueAt, due_notified: 0,
      });
      let when = held ? ` (held – ${person.name} is paused)` : "";
      if (dueAt) when += ` · ⏰ ${this.dueLabel(dueAt)}`;
      if (!mine && !held) {
        // Straight out, no queue and no clock. notified is set only once it actually went, so a
        // rejected send falls into the 12 noon / 4 PM pending round instead of vanishing — and
        // Ankit is told now rather than assuming it arrived.
        try {
          await this.sendTask(person, task);
          await this.store.update("tasks", { id: task.id }, { notified: 1 });
        } catch (e) {
          console.error("[ankit-desk] task send failed", task.id, e);
          when = ` ⚠️ NOT delivered (${e.message.slice(0, 80)}) – retrying at 12 noon`;
        }
      }
      lines.push(`#${task.id} ${mine ? "You" : person.name} · ${business}${when}\n   ${desc}`);
    }
    return lines;
  }

  // ---------- team ----------
  // A tap on Done or Working is a status update, exactly like typing "1 done" - same fields,
  // same remark row, same "they have answered today" mark, so the 6 PM reminder leaves them
  // alone and Ankit's brief counts it. Remark asks for words and remembers which task they
  // belong to, so the next message they send lands on it.
  async tapStatus(person, id, choice) {
    const t = await this.getOpenTask(id);
    if (!t || t.owner !== person.name) {
      return this.wa.sendText(person.phone, `#${id} is not one of your open tasks any more. Nothing changed.`);
    }
    if (choice === "remark") {
      await this.store.upsert("awaiting_remark", { person: person.name }, { task_id: id, at: this.nowIso() });
      return this.wa.sendText(person.phone,
        `✍️ *#${t.id}* – ${t.description}\n\nSend your remark now (text or voice). It goes to Ankit on this task.`);
    }
    const now = this.nowIso();
    const set = { status: choice, stuck_on: null, last_update_date: this.today(), notified: 1 };
    if (choice === "done") set.done_at = now;
    await this.setTask(id, set);
    const label = choice === "done" ? "Done" : "Working";
    await this.store.insert("task_notes", { task_id: id, person: person.name, status: label, text: "", created_at: now });
    await this.store.upsert("checkins", { date: this.today(), owner: person.name }, { replied: 1 });
    await this.wa.sendText(person.phone,
      `${choice === "done" ? "✅" : "⏳"} Noted – *#${id}* is ${label.toLowerCase()}.\n_${t.description}_`);
  }

  // The words that followed a Remark tap. Kept on the task, and sent to Ankit at once rather
  // than waiting for the brief: a remark is usually a question.
  async addRemark(person, t, text) {
    const now = this.nowIso();
    await this.setTask(t.id, { note: text.slice(0, 300), last_update_date: this.today(), notified: 1 });
    await this.store.insert("task_notes", { task_id: t.id, person: person.name, status: "Remark", text, created_at: now });
    await this.store.upsert("checkins", { date: this.today(), owner: person.name }, { replied: 1 });
    await this.wa.sendText(this.d.owner.phone, `✍️ *${person.name}* on #${t.id} (${t.description}):\n${text}`);
    await this.wa.sendText(person.phone, `✍️ Sent to Ankit on *#${t.id}*. Thank you.`);
  }

  async teamText(person, text) {
    // A Remark tap is waiting for these words, so they are a remark and not a status reply.
    // Only the same day's tap counts: a tap nobody followed up on must not turn next week's
    // "1 done" into a remark on a task they had forgotten about.
    const waiting = await this.store.findOne("awaiting_remark", { person: person.name });
    if (waiting) {
      await this.store.remove("awaiting_remark", { person: person.name });
      const t = waiting.at.slice(0, 10) === this.today() ? await this.getOpenTask(waiting.task_id) : null;
      if (t) return this.addRemark(person, t, text);
    }
    let items = [];
    for (const ci of await this.store.find("checkin_items", { owner: person.name }, { sort: { idx: 1 } })) {
      const t = await this.getOpenTask(ci.task_id);
      if (t) items.push([ci.idx, t]);
    }
    if (!items.length) items = (await this.openTasks(person.name)).map((t, i) => [i + 1, t]); // no list has gone out yet today
    if (GREETINGS.has(text.toLowerCase().replace(/^[ .!?]+|[ .!?]+$/g, ""))) {
      if (!items.length) await this.wa.sendText(person.phone, `Hi ${person.name} – you're connected to Ankit Desk. Tasks from Ankit will arrive here.`);
      return;
    }
    if (!items.length) {
      await this.saveNote(person, text);
      return this.wa.sendText(person.phone, "Noted – this will go to Ankit in tomorrow's brief.");
    }
    let parsed;
    try {
      parsed = await this.ai.parseStatus(text, items);
    } catch (e) {
      console.error("Status parse failed", e);
      return this.wa.sendText(person.phone, "Couldn't read that right now. Please send it again in a minute.");
    }
    const mine = new Map(items.map(([, t]) => [t.id, t]));
    const now = this.nowIso(), today = this.today(), lines = [];
    for (const u of parsed.updates || []) {
      const id = Number(u.task_id);
      if (!mine.has(id) || !["done", "working", "stuck"].includes(u.status)) continue;
      const st = u.status;
      let on = st === "stuck" && ["ankit", "others"].includes(u.stuck_on) ? u.stuck_on : null;
      if (st === "stuck" && !on) on = "others";
      const note = u.note || null;
      const set = { status: st, stuck_on: on, last_update_date: today, notified: 1 };
      if (note) set.note = note;
      if (st === "done") set.done_at = now;
      await this.setTask(id, set);
      const label = { done: "Done", working: "Working", stuck: `Stuck on ${on === "ankit" ? "Ankit" : "others"}` }[st];
      await this.store.insert("task_notes", { task_id: id, person: person.name, status: label, text: note || "", created_at: now });
      lines.push(`#${id} ${label}` + (note ? ` – ${note}` : ""));
    }
    if (parsed.other) await this.saveNote(person, parsed.other);
    if (lines.length) {
      await this.store.upsert("checkins", { date: today, owner: person.name }, { replied: 1 });
      await this.wa.sendText(person.phone, "Updated\n" + lines.join("\n"));
    } else if (parsed.other) {
      await this.wa.sendText(person.phone, "Noted – this will go to Ankit in tomorrow's brief.");
    } else {
      await this.wa.sendText(person.phone, "Couldn't match that to your tasks. Reply like:\n1 done, 2 working, 3 stuck Ankit – need approval");
    }
  }

  saveNote(person, text) {
    return this.store.insert("notes", { owner: person.name, text: text.trim(), created_at: this.nowIso(), reported: 0 });
  }

  // ---------- scheduled jobs ----------
  // Tasks that carry a time: one ping DUE_LEAD_MS before due_at, to whoever owns it —
  // usually Ankit himself. Runs every minute and on every /api/cron hit, on any day: a
  // reminder for 9 PM Sunday is still for 9 PM Sunday. due_notified is the whole of what
  // makes it at-most-once, so a coarse or late cron sends it late, never twice.
  async runDue() {
    await this.team.sync();
    const cutoff = isoLocal(new Date(this.now().getTime() + DUE_LEAD_MS), this.s.timezone);
    const rows = await this.store.find("tasks", { status: OPEN, due_notified: 0, due_at: { $lte: cutoff } }, { sort: { due_at: 1 } });
    const sent = [], failed = [];
    for (const t of rows) {
      const person = this.d.byName(t.owner);
      if (!person) continue;
      const body = `⏰ *Reminder – ${this.dueLabel(t.due_at)}*\n#${t.id} ${t.description}` +
        (person === this.d.owner ? "" : `\n(from Ankit · ${t.business})`);
      try {
        await this.deliver(person, body);
        // Marked only after the send: a ping that failed goes out on the next run.
        await this.store.update("tasks", { id: t.id }, { due_notified: 1 });
        sent.push(`${t.owner}:#${t.id}`);
      } catch (e) {
        console.error("[ankit-desk] due reminder failed", t.id, e);
        failed.push(`#${t.id}:${e.message}`);
      }
    }
    return { sent, failed };
  }

  // 12 noon and 4 PM: one message per person with everything still open on them, so nothing
  // is forgotten halfway through the day. It is also the retry path — a task whose instant
  // send was rejected is still notified:0, and this round carries it.
  async runPending() {
    await this.team.sync();
    const today = this.today();
    const sent = [], failed = [];
    for (const person of this.d.people) {
      if (await this.paused(person)) continue;
      try {
        await this.releaseHeld(person);
        const tasks = await this.openTasks(person.name);
        if (!tasks.length) continue;
        // With one task there is a single thing to answer for, so it keeps its buttons; with
        // several, a tap would be ambiguous and the reply is typed.
        await this.deliver(person, this.pendingBody(tasks), tasks.length === 1 ? taskButtons(tasks[0].id) : null);
        // Only after the send succeeded: a task left at notified:0 is retried by the next round.
        for (const t of tasks) if (!t.notified) await this.store.update("tasks", { id: t.id }, { notified: 1 });
        // "1 done" has to mean the 1 they are looking at, so the numbering belongs to the last
        // list they were sent.
        await this.store.remove("checkin_items", { owner: person.name });
        for (const [i, t] of tasks.entries()) {
          await this.store.insert("checkin_items", { owner: person.name, idx: i + 1, task_id: t.id });
        }
        // This round IS the day's check-in - there is no separate one - so it opens the row the
        // 6 PM reminder reads. Only on their own check-in days, though: the list is a reminder
        // of what is pending and goes out regardless, but an answer is only expected on the
        // days they are set to report, and only those days can count as "did not reply".
        if (await this.cfg.checkinToday(person.name, today)) {
          if (!(await this.store.findOne("checkins", { date: today, owner: person.name }))) {
            await this.store.insert("checkins", { date: today, owner: person.name, replied: 0 });
          }
        }
        sent.push(`${person.name}:${tasks.length}`);
      } catch (e) {
        console.error("[ankit-desk] pending list failed for", person.name, e);
        failed.push(`${person.name}:${e.message}`);
      }
    }
    return { sent, failed };
  }

  pendingBody(tasks) {
    const L = [`📌 *Pending with you (${tasks.length})*`, `_${fmtWeekday(this.nowIso())}, ${fmtTime(this.nowIso())}_`, ""];
    for (const [i, t] of tasks.entries()) {
      const tag = [STATUS_LABEL[t.status]];
      if (t.due_at) tag.push(`⏰ ${this.dueLabel(t.due_at)}`);
      tag.push(t.notified ? this.age(t) : "new");
      L.push(`${STATUS_MARK[t.status] || "•"} *${i + 1}. #${t.id}* ${t.description}`, `_${tag.join(" · ")} · ${t.business}_`, "");
    }
    L.push('Reply in ONE message (text or voice) with where each one stands, e.g.\n"1 done, 2 working, 3 stuck Ankit – need approval"');
    return L.join("\n");
  }

  // 6 PM, Ankit only: his own day, then everything he handed out today. The team is not
  // written to here — their list and their status round are the same message, sent by
  // runPending, so nobody gets the same tasks twice in an evening.
  async runReview() {
    await this.team.sync();
    const owner = this.d.owner;
    const tasks = await this.openTasks(owner.name);
    await this.store.remove("checkin_items", { owner: owner.name });
    const lines = [];
    for (const [i, t] of tasks.entries()) {
      await this.store.insert("checkin_items", { owner: owner.name, idx: i + 1, task_id: t.id });
      const tag = [];
      if (t.due_at) tag.push(this.dueLabel(t.due_at));
      tag.push(t.notified ? this.age(t) : "new");
      lines.push(`${i + 1}. #${t.id} ${t.description} (${tag.join(", ")})`);
    }
    try {
      await this.deliver(owner, await this.ownerDayMessage(lines));
      // After the send, not before: a review that never arrived must not mark its tasks notified.
      await this.store.update("tasks", { owner: owner.name, notified: 0 }, { notified: 1 });
      return { failed: [] };
    } catch (e) {
      console.error("[ankit-desk] review failed", e);
      return { failed: [`${owner.name}:${e.message}`] };
    }
  }

  async ownerDayMessage(openLines) {
    const { done, open } = await this.day(this.today());
    const L = [`*Your day – ${fmtWeekday(this.nowIso())}: ${done.length} of ${done.length + open.length} done*`];
    L.push(...done.map((t) => `✓ #${t.id} ${t.description}`));
    if (openLines.length) L.push("", "Still open:", ...openLines, "", 'Reply e.g. "1 done" or "1 done, 2 done"');
    else if (done.length) L.push("", "All done 👏");
    else L.push("", "Nothing of your own today.");
    return [...L, "", "━━━━━━━━━━━━━━", "", await this.buildTodayOverview()].join("\n");
  }

  // The 6 PM picture, and the *today* command: everything handed to the team today, whose it
  // is, which business it belongs to and where it stands right now. Ankit's own tasks are the
  // day above it, so they are not counted twice.
  async buildTodayOverview() {
    const today = this.today();
    const owner = this.d.owner.name;
    const rows = (await this.store.find("tasks", {}, { sort: { id: 1 } }))
      .filter((t) => t.created_at.slice(0, 10) === today && t.owner !== owner);
    if (!rows.length) return `*ASSIGNED TODAY (0)*\nNothing went to the team today.`;

    const tally = { done: 0, working: 0, stuck: 0, new: 0, cancelled: 0 };
    const L = [`*ASSIGNED TODAY (${rows.length})*`];
    for (const name of [...new Set(rows.map((t) => t.owner))]) {
      const theirs = rows.filter((t) => t.owner === name);
      const groups = [...new Set(theirs.map((t) => t.business))].join(", ");
      L.push("", `*${name}* · ${groups} · ${plural(theirs.length, "task")}`);
      for (const t of theirs) {
        tally[t.status]++;
        const bits = [STATUS_LABEL[t.status]];
        if (t.status === "stuck") bits.push(t.stuck_on === "ankit" ? "on YOU" : "on others");
        if (t.note) bits.push(t.note);
        if (!t.notified) bits.push("⚠️ not delivered yet");
        L.push(`${STATUS_MARK[t.status] || "•"} #${t.id} ${t.description}`, `   _${bits.join(" · ")}_`);
      }
    }
    L.push("", `*Score: ${tally.done} of ${rows.length} done* · ${tally.working} working · ${tally.stuck} stuck · ${tally.new} not started`);
    const silent = rows.filter((t) => t.status === "new");
    if (silent.length) L.push(`No word yet on: ${silent.map((t) => `#${t.id} ${t.owner}`).join(", ")}`);
    return L.join("\n");
  }

  async runNudge() {
    await this.team.sync();
    const failed = [];
    for (const row of await this.store.find("checkins", { date: this.today(), replied: 0 })) {
      const person = this.d.byName(row.owner);
      if (!person || (await this.paused(person)) || !(await this.cfg.reminderOn(person.name))) continue;
      const n = (await this.openTasks(person.name)).length;
      if (!n) continue;
      try {
        await this.deliver(person, `Reminder: ${n} task${n > 1 ? "s" : ""} still need today's status. Reply in one message, e.g. "1 done, 2 working".`);
      } catch (e) {
        console.error("[ankit-desk] reminder failed for", person.name, e);
        failed.push(`${person.name}:${e.message}`);
      }
    }
    return { failed };
  }

  async runBrief() {
    await this.team.sync();
    await this.deliver(this.d.owner, await this.buildBrief());
    await this.store.update("notes", { reported: 0 }, { reported: 1 });
  }

  // ---------- brief ----------
  async pendingOnMe() {
    const stuck = await this.store.find("tasks", { status: "stuck", stuck_on: "ankit" }, { sort: { id: 1 } });
    return [...stuck, ...(await this.openTasks(this.d.owner.name))];
  }

  async buildBrief() {
    const owner = this.d.owner.name;
    const today = this.today();
    const yday = addDays(today, -1);
    const L = [`*DAILY BRIEF – ${fmtWeekday(this.nowIso())}*`, ""];

    const ydone = (await this.store.find("tasks", { owner, status: "done" })).filter((t) => (t.done_at || "").slice(0, 10) === yday);
    const yopen = (await this.openTasks(owner)).filter((t) => t.created_at.slice(0, 10) <= yday);
    if (ydone.length || yopen.length) L.push(`*YOUR DAY YESTERDAY: ${ydone.length} of ${ydone.length + yopen.length} done*`, "");

    const onMe = await this.pendingOnMe();
    L.push(`*PENDING ON YOU (${onMe.length})*`);
    if (!onMe.length) L.push("Nothing");
    for (const t of onMe) {
      if (t.owner === owner) L.push(`• Your task #${t.id}: ${t.description} (${this.age(t)})`);
      else L.push(`• ${t.owner} #${t.id}: ${t.description}` + (t.note ? ` – ${t.note}` : ""));
    }
    const ex = onMe.find((t) => t.owner !== owner);
    if (ex) L.push(`_Reply e.g. "${ex.owner} ${ex.id} – approved"_`);

    const all = await this.openTasks();
    // Nothing is ranked any more, so what deserves naming is what has sat too long: open a
    // week or more, and nobody waiting on Ankit for it.
    const stale = all.filter((t) => t.owner !== owner && !(t.status === "stuck" && t.stuck_on === "ankit") &&
      daysBetween(t.created_at.slice(0, 10), today) >= 7);
    L.push("", `*OPEN A WEEK OR MORE (${stale.length})*`);
    if (!stale.length) L.push("None");
    for (const t of stale) {
      L.push(`• ${t.owner} (${t.business}) #${t.id}: ${t.description} – ${this.age(t)}, ${STATUS_LABEL[t.status]}` + (t.note ? ` – ${t.note}` : ""));
    }

    L.push("", "*BY BUSINESS*");
    const since = isoLocal(new Date(this.now().getTime() - 86400000), this.s.timezone);
    for (const b of this.d.businesses) {
      const done = await this.store.count("tasks", { business: b, owner: { $ne: owner }, status: "done", done_at: { $gte: since } });
      const c = { working: 0, stuck: 0, new: 0 };
      for (const t of all) if (t.business === b && t.owner !== owner) c[t.status]++;
      if (done || c.working || c.stuck || c.new) {
        const parts = [`${done} done`, `${c.working} working`, `${c.stuck} stuck`];
        if (c.new) parts.push(`${c.new} not started`);
        L.push(`${b}: ` + parts.join(" | "));
      }
    }

    const missed = (await this.store.find("checkins", { date: yday, replied: 0 })).map((r) => r.owner);
    if (missed.length) L.push("", "*NO UPDATE YESTERDAY:* " + missed.join(", "));
    const notes = await this.store.find("notes", { reported: 0 }, { sort: { id: 1 } });
    if (notes.length) L.push("", "*NOTES FROM TEAM*", ...notes.map((n) => `• ${n.owner}: ${n.text}`));
    return L.join("\n");
  }

  async buildList() {
    const tasks = await this.openTasks();
    if (!tasks.length) return "No open tasks.";
    const out = ["*OPEN TASKS*"];
    let current = null;
    for (const t of [...tasks].sort((a, b) => a.business.localeCompare(b.business) || a.owner.localeCompare(b.owner) || a.id - b.id)) {
      if (t.business !== current) { current = t.business; out.push(`\n_${current}_`); }
      out.push(`#${t.id} ${t.owner}: ${t.description} – ${STATUS_LABEL[t.status]}, ${this.age(t)}` +
        (t.due_at ? ` · ⏰ ${this.dueLabel(t.due_at)}` : ""));
    }
    return out.join("\n");
  }
}
