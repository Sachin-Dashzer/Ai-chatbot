// Core behaviour.
//
// Day flow
// - Ankit sends tasks any time (text/voice). P1 -> sent to the person instantly. P2 -> held.
// - 12:00 and 16:00: each person gets ONE message with their held P2 tasks.
// - 18:00: each person gets ONE check-in listing all their open tasks.
// - They reply ONCE (text or voice): "1 done, 2 working, 3 stuck Ankit - need approval". AI updates every task.
// - 19:00: one reminder to anyone who hasn't replied.
// - 08:30: Ankit's brief.
// - Ankit answers a stuck task from his phone: "Himanshu 16 - rate approved" -> forwarded, task back to working.
//
// WhatsApp only allows free-form messages within 24h of the person's last message. Outside it - which includes
// the very first message the bot ever sends someone - only an approved template gets through, so the bot sends
// one carrying the task itself and releases the full text as soon as the person replies.
import { PARAM_MAX } from "./whatsapp.js";
import { Settings } from "./settings.js";
import { Boards, MASTER } from "./boards.js";
import { isoLocal, localDate, addDays, daysBetween, fmtWeekday, fmtStamp } from "./time.js";

export const HELP = [
  "*How to use*",
  "Send a voice note or text with the task:",
  '"Himanshu – send Galaxy Royal invoice – P1"',
  "Several tasks in one voice note are fine. Say P1 (or urgent) for anything that must go out now; everything else is sent to the person at 12 PM / 4 PM in one message.",
  "",
  'For yourself: "Me – review Goodbite reply – P1"',
  'Answer a stuck task: "Himanshu 16 – rate 4,500 approved"',
  'Your own tasks: "1 done, 2 done" or just say "CRM templates ho gaye"',
  "",
  "Commands:",
  "• *brief* – summary now",
  "• *list* – all open tasks",
  "• *done 12* (or *done 12 15*) – close tasks",
  "• *cancel 12* – cancel a task",
  "• *p1 12* / *p2 12* – change priority",
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
// The template that opens a 24-hour window is named in settings (FIRST_TEMPLATE,
// default "task_update") and takes one body param: the person's name. It is the
// only thing that reaches someone outside the window - including the very first
// message the bot ever sends them - and it carries no button, so whatever is
// being held goes out the moment they reply (see handleMessage). Saying little
// in the template costs nothing: the task itself follows within the window.
const REPLY_RE = /^\s*(?:([A-Za-z]+)\s+)?#?(\d{1,5})\s*[-–—:]\s*([\s\S]+)$/;
const GREETINGS = new Set(["hi", "hello", "hey", "ok", "okay", "thanks", "thank you", "ji", "hii", "namaste", "noted", "👍", "ok sir", "yes sir"]);
const WINDOW_MS = (23 * 60 + 30) * 60000;
const TEMPLATE_GAP_MS = 3 * 3600000;
const STATUS_WORDS = { done: "done", "ho gaya": "done", hogaya: "done", "ho gya": "done", complete: "done",
  completed: "done", finished: "done", working: "working", pending: "working" };
const OPEN = { $nin: ["done", "cancelled"] };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export class Bot {
  constructor({ settings, store, wa, ai, directory, now }) {
    this.s = settings;
    this.store = store;
    this.ai = ai;
    this.d = directory;
    this._now = now;
    this.cfg = new Settings(store, directory);
    this.boards = new Boards(this);
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
  async paused(person) {
    return person !== this.d.owner && this.cfg.paused(person.name, this.today());
  }

  // ---------- tasks ----------
  async openTasks(owner) {
    const rows = await this.store.find("tasks", owner ? { status: OPEN, owner } : { status: OPEN }, { sort: { id: 1 } });
    return rows.sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1) || a.id - b.id);
  }
  getTask(id) { return this.store.findOne("tasks", { id }); }
  getOpenTask(id) { return this.store.findOne("tasks", { id, status: OPEN }); }
  setTask(id, set) { return this.store.update("tasks", { id }, { ...set, updated_at: this.nowIso() }); }

  // ---------- delivery with the 24h rule ----------
  async inWindow(phone) {
    const r = await this.store.findOne("inbound", { phone });
    return !!r && this.now() - Date.parse(r.last_at) < WINDOW_MS;
  }

  async deliver(person, text) {
    if (await this.paused(person)) {
      await this.store.insert("pending_msgs", { phone: person.phone, text, created_at: this.nowIso() });
      return;
    }
    if (await this.inWindow(person.phone)) return this.wa.sendText(person.phone, text);
    await this.store.insert("pending_msgs", { phone: person.phone, text, created_at: this.nowIso() });
    await this.notify(person);
  }

  async notify(person) {
    const last = await this.store.findOne("template_log", { phone: person.phone });
    if (last && this.now() - Date.parse(last.last_at) < TEMPLATE_GAP_MS) return; // one is already waiting for a reply
    await this.openWindow(person);
  }

  // Send the approved template and note when, so the throttle above holds.
  // The task rides inside the template as its second parameter: outside the 24h
  // window Meta allows nothing else, and the window only opens when the person
  // replies, so a template that just says "reply to see it" leaves them with no
  // idea what the work is. The full formatted copy still arrives from
  // pending_msgs the moment they do reply.
  async openWindow(person) {
    const held = await this.store.find("pending_msgs", { phone: person.phone }, { sort: { id: 1 } });
    const task = held.map((r) => r.text).join(" · ") || "a task update";
    await this.wa.sendTemplate(person.phone, this.s.firstTemplate, [person.name, task]);
    // Whatever the template delivered in full must not be sent a second time when
    // the reply flushes the queue. The length test is on the raw join, and
    // cleanParam only ever shortens it, so a row is marked only when it truly
    // fit; anything the parameter had to cut still goes out as text.
    if (task.length <= PARAM_MAX) {
      for (const r of held) await this.store.update("pending_msgs", { id: r.id }, { in_template: 1 });
    }
    await this.store.upsert("template_log", { phone: person.phone }, { last_at: this.nowIso() });
  }

  // P1 ignores a pause by design. Outside the window the template cannot carry
  // the task any more, so the text is held and the window opened: the person's
  // reply flushes it, which is seconds later in practice.
  async sendUrgent(person, id, desc, business) {
    const body = `🔴 *P1 – urgent* from Ankit\n#${id} ${desc}\n(${business})`;
    if (await this.inWindow(person.phone)) return this.wa.sendText(person.phone, body);
    await this.store.insert("pending_msgs", { phone: person.phone, text: body, created_at: this.nowIso() });
    await this.openWindow(person);
  }

  async releaseHeld(person) {
    const n = await this.store.count("pending_msgs", { phone: person.phone });
    if (!n) return;
    if (await this.inWindow(person.phone)) await this.flushPending(person.phone);
    else await this.notify(person);
  }

  // Reports whether anything was actually sent, not merely dequeued: the "View"
  // button must say "all caught up" when every held row was already read in a
  // template.
  async flushPending(phone) {
    const rows = await this.store.find("pending_msgs", { phone }, { sort: { id: 1 } });
    let sent = 0;
    for (const r of rows) if (!r.in_template) { await this.wa.sendText(phone, r.text); sent++; }
    if (rows.length) {
      await this.store.remove("pending_msgs", { phone });
      await this.store.remove("template_log", { phone });
    }
    return sent > 0;
  }

  // ---------- inbound ----------
  async handleMessage(msg) {
    if (msg.id) {
      if (await this.store.findOne("seen_messages", { mid: msg.id })) return;
      await this.store.insert("seen_messages", { mid: msg.id });
    }
    const phone = msg.from;
    const person = this.d.byPhone(phone);
    if (!person) return console.log("Ignoring message from unknown number", phone);
    await this.store.upsert("inbound", { phone }, { last_at: this.nowIso() });
    const type = msg.type;

    if (type === "button" || type === "interactive") {
      const payload = type === "button" ? msg.button?.payload : msg.interactive?.button_reply?.id;
      if (payload === "view" && !(await this.flushPending(phone))) await this.wa.sendText(phone, "You're all caught up.");
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
        return this.replyToTask(task, m[3].trim());
      }
    }
    let parsed;
    try {
      parsed = await this.ai.parseOwner(text, await this.openTasks());
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
    const reply = await this.cfg.handle(text, this.today());
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
        let when = row.priority === "urgent" || isOwner ? "" : " (goes in the next batch)";
        if (row.priority === "urgent" && !isOwner && !(await this.paused(p))) {
          try {
            await this.sendUrgent(p, id, row.description, row.business);
            await this.setTask(id, { notified: 1 });
          } catch (e) {
            console.error("[ankit-desk] P1 send failed on reassign", id, e);
            when = ` ⚠️ NOT delivered (${e.message.slice(0, 80)}) – retrying at next batch`;
          }
        }
        await this.wa.sendText(phone, `#${id} reassigned to ${p.name}` + when);
      }
      return true;
    }
    if (["help", "?"].includes(t)) { await this.wa.sendText(phone, HELP); return true; }
    if (["brief", "summary", "pending"].includes(t)) { await this.wa.sendText(phone, await this.buildBrief()); return true; }
    if (["list", "open", "tasks"].includes(t)) { await this.wa.sendText(phone, await this.buildList()); return true; }
    let parts = t.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length) parts = [{ p1: "urgent", p2: "normal" }[parts[0]] || parts[0], ...parts.slice(1)];
    if (parts.length >= 2 && ["done", "cancel", "urgent", "normal", "reopen"].includes(parts[0]) &&
      parts.slice(1).every((p) => /^#?\d+$/.test(p))) {
      const lines = [];
      for (const p of parts.slice(1)) {
        const id = Number(p.replace("#", ""));
        const row = await this.getTask(id);
        if (!row) { lines.push(`No task #${id}`); continue; }
        if (parts[0] === "done") await this.setTask(id, { status: "done", done_at: this.nowIso() });
        else if (parts[0] === "reopen") await this.setTask(id, { status: "working", done_at: null });
        else if (parts[0] === "cancel") await this.setTask(id, { status: "cancelled" });
        else await this.setTask(id, { priority: parts[0] });
        const label = { urgent: "P1", normal: "P2" }[parts[0]] || parts[0];
        lines.push(`#${id} → ${label}: ${row.description}`);
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
      await this.deliver(person, `Ankit on #${task.id} (${task.description}):\n${message}`);
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
      const urgent = String(t.priority || "").toLowerCase() === "urgent";
      const mine = person === this.d.owner;
      const held = !mine && !urgent && (await this.paused(person)); // P1 always goes through, even during a pause
      const now = this.nowIso();
      const task = await this.store.insert("tasks", {
        business, owner: person.name, description: desc, priority: urgent ? "urgent" : "normal", status: "new",
        stuck_on: null, note: null, notified: mine ? 1 : 0, source_text: source,
        created_at: now, updated_at: now, last_update_date: null, done_at: null,
      });
      let when = held ? ` (held – ${person.name} is paused)` : mine ? "" : " (sent at next batch)";
      if (urgent && !mine) {
        // notified is set only once the P1 actually went out, so a failed send falls into the next
        // batch instead of vanishing — and Ankit is told now rather than assuming it arrived.
        try {
          await this.sendUrgent(person, task.id, desc, business);
          await this.store.update("tasks", { id: task.id }, { notified: 1 });
          when = "";
        } catch (e) {
          console.error("[ankit-desk] P1 send failed", task.id, e);
          when = ` ⚠️ NOT delivered (${e.message.slice(0, 80)}) – retrying at next batch`;
        }
      }
      lines.push(`#${task.id} ${mine ? "You" : person.name} · ${business} · ${urgent ? "🔴 P1" : "P2"}${when}\n   ${desc}`);
    }
    return lines;
  }

  // ---------- team ----------
  async teamText(person, text) {
    let items = [];
    for (const ci of await this.store.find("checkin_items", { owner: person.name }, { sort: { idx: 1 } })) {
      const t = await this.getOpenTask(ci.task_id);
      if (t) items.push([ci.idx, t]);
    }
    if (!items.length) items = (await this.openTasks(person.name)).map((t, i) => [i + 1, t]); // no check-in yet
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
  async runBatch() {
    const sent = [], failed = [];
    for (const person of this.d.people) {
      if (await this.paused(person)) continue;
      const held = await this.store.find("tasks", { owner: person.name, notified: 0, status: OPEN }, { sort: { id: 1 } });
      try {
        await this.releaseHeld(person);
        if (!held.length) continue;
        const n = held.length;
        const body = `*New task${n > 1 ? "s" : ""} from Ankit (${n})*\n` + held.map((t) => `#${t.id} ${t.description} (${t.business})`).join("\n");
        await this.deliver(person, body);
        // Only after the send succeeded: a task left at notified:0 is retried by the next batch.
        for (const t of held) await this.store.update("tasks", { id: t.id }, { notified: 1 });
        sent.push(`${person.name}:${n}`);
      } catch (e) {
        console.error("[ankit-desk] batch delivery failed for", person.name, e);
        failed.push(`${person.name}:${e.message}`);
      }
    }
    return { sent, failed };
  }

  async runCheckin() {
    const today = this.today();
    const failed = [];
    for (const person of [this.d.owner, ...this.d.people]) {
      try {
        const isOwner = person === this.d.owner;
        if (!isOwner && ((await this.paused(person)) || !(await this.cfg.checkinToday(person.name, today)))) continue;
        const tasks = await this.openTasks(person.name);
        if (isOwner && !tasks.length && (await this.day(today)).done.length) {
          await this.deliver(person, await this.ownerDayMessage([]));
          continue;
        }
        if (!tasks.length) continue;
        await this.store.remove("checkin_items", { owner: person.name });
        const lines = [];
        for (const [i, t] of tasks.entries()) {
          await this.store.insert("checkin_items", { owner: person.name, idx: i + 1, task_id: t.id });
          const tag = t.priority === "urgent" ? ["P1"] : [];
          tag.push(t.notified ? this.age(t) : "new");
          lines.push(`${i + 1}. #${t.id} ${t.description} (${tag.join(", ")})`);
        }
        if (isOwner) {
          await this.deliver(person, await this.ownerDayMessage(lines));
          await this.store.update("tasks", { owner: person.name, notified: 0 }, { notified: 1 });
          continue;
        }
        if (!(await this.store.findOne("checkins", { date: today, owner: person.name }))) {
          await this.store.insert("checkins", { date: today, owner: person.name, replied: 0 });
        }
        const body = `*Your open tasks – ${fmtWeekday(this.nowIso())}*\n` + lines.join("\n") +
          '\n\nReply in ONE message (text or voice), e.g.\n"1 done, 2 working, 3 stuck Ankit – need approval"';
        await this.deliver(person, body);
        // After the send, not before: a check-in that never arrived must not mark its tasks notified.
        await this.store.update("tasks", { owner: person.name, notified: 0 }, { notified: 1 });
      } catch (e) {
        console.error("[ankit-desk] check-in failed for", person.name, e);
        failed.push(`${person.name}:${e.message}`);
      }
    }
    return { failed };
  }

  async ownerDayMessage(openLines) {
    const { done, open } = await this.day(this.today());
    const L = [`*Your day – ${fmtWeekday(this.nowIso())}: ${done.length} of ${done.length + open.length} done*`];
    L.push(...done.map((t) => `✓ #${t.id} ${t.description}`));
    if (openLines.length) L.push("", "Still open:", ...openLines, "", 'Reply e.g. "1 done" or "1 done, 2 done"');
    else L.push("", "All done 👏");
    return L.join("\n");
  }

  async runNudge() {
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
      if (t.owner === owner) L.push(`• ${t.priority === "urgent" ? "🔴 P1 " : ""}Your task #${t.id}: ${t.description} (${this.age(t)})`);
      else L.push(`• ${t.owner} #${t.id}: ${t.description}` + (t.note ? ` – ${t.note}` : ""));
    }
    const ex = onMe.find((t) => t.owner !== owner);
    if (ex) L.push(`_Reply e.g. "${ex.owner} ${ex.id} – approved"_`);

    const all = await this.openTasks();
    const p1 = all.filter((t) => t.priority === "urgent" && t.owner !== owner && !(t.status === "stuck" && t.stuck_on === "ankit"));
    L.push("", `*P1 NOT DONE (${p1.length})*`);
    if (!p1.length) L.push("None");
    for (const t of p1) {
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
      out.push(`#${t.id} ${t.priority === "urgent" ? "🔴 P1 " : ""}${t.owner}: ${t.description} – ${STATUS_LABEL[t.status]}, ${this.age(t)}`);
    }
    return out.join("\n");
  }
}
