import { cleanParam, PARAM_MAX, BODY_MAX } from "./whatsapp.js";
import { Settings, parseWhen } from "./settings.js";
import { Team } from "./people.js";
import { Boards, MASTER, TEAM } from "./boards.js";
import { isoLocal, localDate, addDays, daysBetween, weekdayOf, fmtWeekday, fmtDayMon, fmtStamp, fmtTime } from "./time.js";
import { L as Love, loveSystem, NAME } from "./love.js";

export const HELP = [
  `*I'm ${NAME} 💛*`,
  "I keep your desk: your tasks, your team's tasks, your meetings and the things you ask me to hold on to. Just talk to me — you don't have to use any of this.",
  "",
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
  'A meeting: "meeting with Manish at 10" – everyone invited is asked if they can make it, it goes on the calendar, and all of you are reminded 5 minutes before.',
  "• *move M1 to 5 pm* – a new time; everyone is asked again (*kal 11*, *25 nov 4 pm* work too)",
  "• *cancel M1* – call it off; everyone invited is told at once",
  "",
  "You don't have to name the person. Say what the work is and the bot picks whoever handles it, then asks you before it sends. It only ever asks first when it worked the person out itself, or when your reply approves a rate, a price or a date.",
  "• *edit Rahul does GST, TDS, filings* – teach it what someone handles",
  "",
  "Commands:",
  "• *brief* – summary now",
  "• *schedule* – your meetings and timed tasks, soonest first",
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
  "What I remember:",
  '• *"remember I don\'t take calls after 9"* – I keep it and work around it from then on',
  '• *"remind me to drink water"* – I set it up and ping you every day',
  "• *memory* – everything I'm holding, numbered",
  "• *forget 4* – drop one of them",
  "",
  "Fixing mistakes:",
  "• *reopen 12* – undo a task closed by mistake",
  "• *assign 12 Narendra* – give a task to someone else",
  "",
  "Your team:",
  "• *people* – who is on the list, with their numbers",
  "• *add Rahul 919812345678* – add someone (name, number)",
  "• *edit Rahul phone 919...* / *name Rahul Verma* / *alias CA Rahul*",
  "• *remove Rahul* – stop everything reaching them (their history stays)",
  "",
  "Boards and messages:",
  "• *boards* – get all board links",
  "• *msgs Himanshu* – his last messages word for word (*msgs* = whole team)",
  "• *newlink team* / *newlink master* – replace a leaked link",
  "",
  "Someone new, or quiet for a day:",
  "• *start Narendra* – send the approved template so the 24-hour window can open (*start all* for everyone)",
  "• Not needed before a task: the bot sends that template itself and releases the task the moment they reply",
].join("\n");

export const STATUS_LABEL = { new: "not started", working: "working", stuck: "stuck", done: "done", cancelled: "cancelled" };

const REPLY_RE = /^\s*(?:([A-Za-z]+)\s+)?#?(\d{1,5})\s*[-–—:]\s*([\s\S]+)$/;
const GREETINGS = new Set(["hi", "hello", "hey", "ok", "okay", "thanks", "thank you", "ji", "hii", "namaste", "noted", "👍", "ok sir", "yes sir"]);
// Ankit just talking to her. These never go to the parser: a model asked "who is this task
// for" about "hii" will answer "unclear", and he gets a warning instead of a hello.
const OWNER_SMALLTALK = /^(hi+|hey+|hello+|helo|namaste|good (morning|afternoon|evening|night)|gm|gn|who are you|what can you do|what do you do|how are you|thanks?|thank you|thank u|ty|ok(ay)?|k|cool|nice|great|👍|🙏|❤️|💛)$/i;
// How long an instruction she could not place waits for his clarification ("it's for me").
const FOLLOWUP_MS = 10 * 60000;
// "delete all my meetings", "saari meeting delete krdo", "clear my calendar", "calendar clean karo".
// Caught before the parser, so emptying his calendar never depends on how a model reads it.
const CLEAR_WHAT = /\b(meetings?|meatings?|meetin|calendar|calender|schedule)\b/i;
const CLEAR_VERB = /\b(delete|del|cancel|clear|remove|hata\w*|khali|clean|wipe|mita\w*)\b/i;
const CLEAR_ALL = /\b(all|saari|sari|saare|sare|sab|sabhi|every|clean|clear|khali|empty)\b/i;
// "schedule a meeting to clean all the files" is a new meeting, not a request to empty the calendar.
const MAKES_MEETING = /\b(schedule|set ?up|book|arrange|fix|add|create|new|lagao|rakho)\s+(a\s+|ek\s+)?(meeting|call)/i;
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

// The buttons under a message answer the message. A task asks "where is it up to", so it
// offers Done / Working / Remark; a meeting asks "will you be there", so Done makes no sense
// on it and it offers the three answers a meeting actually has.
const MTG_BTN = [["yes", "✅ I'll be there"], ["no", "✖️ Can't make it"], ["move", "🕒 Another time"]];
const MTG_RE = /^mt:(\d{1,5}):(yes|no|move)$/;
const meetingButtons = (id) => MTG_BTN.map(([k, title]) => ({ id: `mt:${id}:${k}`, title }));
const MTG_REPLY = { yes: "coming", no: "cannot come", move: "wants another time" };

// Ankit's own confirm buttons, on anything the bot will not send by itself.
const CF_RE = /^cf:(\d{1,6}):(ok|who|no)$/;
// The middle button is the same idea in each case — "not that, this instead" — so it keeps
// one payload and changes only its words.
const CF_LABELS = {
  task: [["ok", "✅ Send"], ["who", "👤 Someone else"], ["no", "✖️ Cancel"]],
  beat: [["ok", "✅ Yes, save it"], ["who", "✍️ I'll write it"], ["no", "✖️ Not now"]],
  reply: [["ok", "✅ Send"], ["no", "✖️ Cancel"]],
  clear: [["ok", "🗑 Yes, delete"], ["no", "✖️ Keep them"]],
};
const confirmButtons = (id, kind) =>
  (CF_LABELS[kind] || CF_LABELS.reply).map(([k, title]) => ({ id: `cf:${id}:${k}`, title }));

// Teaching the bot what someone handles, from the work they are actually given.
const BEAT_MIN_TASKS = 5;      // below this there is no pattern worth proposing
const BEAT_RETRY_DAYS = 7;     // asked and ignored: leave it a week
const BEAT_DECLINE_DAYS = 60;  // told "not now": leave it two months
const MEETING_OPEN = { $nin: ["cancelled", "done"] };

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

  // ---------- what Love remembers ----------
  // One collection, two kinds, numbered by their own row id — so "forget 7" means the same
  // thing next month as it does today, with no index table to drift out of step.
  //
  //   fact     something lasting about Ankit. It rides in every prompt from then on, so the
  //            next instruction is read in the light of it.
  //   reminder a habit he asked for. It carries its own clock and fires itself.
  memories(kind) {
    return this.store.find("memory", kind ? { kind } : {}, { sort: { id: 1 } });
  }

  // What goes into a prompt: the facts only. A habit is something Love does, not something
  // she knows about him.
  async memoryLines() {
    return (await this.memories("fact")).map((r) => `- ${r.text}`).join("\n");
  }

  async remember(text) {
    const t = String(text || "").trim().slice(0, 300);
    if (!t) return null;
    const have = await this.memories("fact");
    // The same thing said twice is one memory, not two.
    if (have.some((r) => r.text.toLowerCase() === t.toLowerCase())) return null;
    return this.store.insert("memory", { kind: "fact", text: t, created_at: this.nowIso() });
  }

  // A habit. Times are normalised and sorted here rather than trusted from the model, because
  // runHabits compares them as plain strings against the clock.
  async rememberHabit(h) {
    const label = String(h.label || "").trim().slice(0, 60);
    const times = [...new Set((h.times || [])
      .map((t) => String(t).match(/^(\d{1,2}):(\d{2})/))
      .filter((m) => m && +m[1] < 24 && +m[2] < 60)
      .map((m) => `${String(+m[1]).padStart(2, "0")}:${m[2]}`))].sort();
    if (!label || !times.length) return null;
    const raw = String(h.days || "daily").toLowerCase().trim();
    const days = /^(daily|(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*)$/.test(raw) ? raw : "daily";
    const text = String(h.text || "").trim().slice(0, 300) || `Time to ${label} 💛`;
    // Asking for the same habit again changes its clock instead of adding a second one that
    // would ping him twice for the same thing.
    const dup = (await this.memories("reminder")).find((r) => (r.label || "").toLowerCase() === label.toLowerCase());
    if (dup) {
      await this.store.update("memory", { id: dup.id }, { times, days, text, active: 1 });
      return { ...dup, times, days, text };
    }
    return this.store.insert("memory", {
      kind: "reminder", label, text, times, days, active: 1, created_at: this.nowIso(),
      // Starts from now, not from midnight: he asks for water reminders at half past two and
      // the two o'clock slot is behind him already. Tomorrow it fires like any other day.
      last: `${this.today()}T${this.nowIso().slice(11, 16)}`,
    });
  }

  async memoryText() {
    const rows = await this.memories();
    if (!rows.length) return `Nothing yet 💛 Tell me anything you want me to hold on to — "remember I don't take calls after 9", "remind me to drink water".`;
    const L2 = [`💛 *What I'm holding for you*`];
    const facts = rows.filter((r) => r.kind === "fact");
    const habits = rows.filter((r) => r.kind === "reminder" && r.active);
    if (facts.length) {
      L2.push("", "*I know*");
      for (const r of facts) L2.push(`${r.id}. ${r.text}`);
    }
    if (habits.length) {
      L2.push("", "*I remind you*");
      for (const r of habits) L2.push(`${r.id}. ${r.label} — ${r.times.join(", ")}${r.days === "daily" ? "" : ` (${r.days})`}`);
    }
    L2.push("", "_*forget 4* and I'll drop that one._");
    return L2.join("\n");
  }

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

  // `meta` travels with a held message and says what kind of thing is waiting, so that if the
  // window has to be opened with a template, the template can describe it correctly.
  async deliver(person, text, buttons, meta = null) {
    const held = { phone: person.phone, text, buttons: buttons || null, meta, created_at: this.nowIso() };
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
  // Try each template in turn and stop at the first that Meta accepts. A template that is
  // still in review, or has been deleted or rejected, is a 400 — so the list always ends with
  // firstTemplate, which has been approved the longest. Nobody is ever left unheard because a
  // better-worded template is not ready yet, and nothing has to be switched on the day it is.
  // Each attempt is [name, bodyParams, buttonPayloads]. The payloads matter: task_reminder
  // and meeting_invite have no buttons, and sending a button component for a template that
  // declares none is rejected by Meta — so only the two "View tasks" templates carry one.
  async _openWith(person, attempts) {
    for (const [name, params, payloads = []] of attempts) {
      if (!name) continue;
      try {
        await this.wa.sendTemplate(person.phone, name, params, payloads);
        return name;
      } catch (e) {
        console.error(`[ankit-desk] template ${name} unavailable, falling back`, e.message.slice(0, 120));
      }
    }
    throw new Error(`no usable template for ${person.name}`);
  }

  async openWindow(person) {
    const held = await this.store.find("pending_msgs", { phone: person.phone }, { sort: { id: 1 } });
    const task = held.map((r) => r.text).join(" · ") || "a task update";
    const metas = held.map((r) => r.meta).filter(Boolean);
    const s = this.s;

    // Outside the 24-hour window only a template may go, and the four approved ones are two
    // different shapes: task_reminder and meeting_invite carry the actual content in their
    // body, while task_update and daily_task_update say "you have something" and carry a
    // View tasks button that opens the window when tapped. Which is better depends entirely
    // on whether the content survives being flattened into a template parameter — Meta allows
    // no newlines there, so cleanParam strips the headings, the line breaks and the task
    // numbers, and caps it at 900 characters.
    //
    // Flattening costs the headings and the line breaks, but the words survive and stay
    // readable, so carrying the work in the body still beats making someone tap to find out
    // what it is. The exception is when the text is long enough to be CUT at 900 characters:
    // a truncated instruction is worse than no instruction, because it looks complete.
    //
    //   a meeting            → meeting_invite, which states the time in the body
    //   the twice-daily list → daily_task_update / task_update. A numbered list of five tasks
    //                          run together on one line is not a list any more.
    //   cut by the 900 cap   → task_update: one tap, then the whole thing
    //   anything else        → task_reminder, the work in the body, nothing to tap
    const meeting = metas.filter((m) => m.kind === "meeting")
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))[0];
    const pending = metas.some((m) => m.kind === "pending");
    // Whether "Good morning" is true is a fact about now, not about when the list was queued:
    // a list queued at noon is often still waiting at four, and a flag set at queue time
    // would still be claiming it is the morning.
    const rounds = s.pendingTimes.split(",").map((x) => x.trim()).filter(Boolean).sort();
    const morning = rounds.length < 2 || this.nowIso().slice(11, 16) < rounds[1];
    const flat = task.split(/\s+/).filter(Boolean).join(" ");
    const cut = flat.length > PARAM_MAX;
    const view = ["view_tasks"];
    const carry = [s.firstTemplate, [person.name, task, "today"]];

    let used;
    if (meeting) {
      used = await this._openWith(person, [
        [s.meetingTemplate, [person.name, meeting.when, meeting.title || "a meeting"]],
        carry,
      ]);
    } else if (pending) {
      // "Good morning" only reads right on the first round of the day; the later one gets the
      // undated wording rather than greeting the team with the wrong half of the day.
      used = await this._openWith(person, [
        morning
          ? [s.dailyTemplate, [person.name, fmtDayMon(this.nowIso())], view]
          : [s.taskTemplate, [person.name], view],
        [s.taskTemplate, [person.name], view],
        carry,
      ]);
    } else if (cut) {
      used = await this._openWith(person, [[s.taskTemplate, [person.name], view], carry]);
    } else {
      used = await this._openWith(person, [carry, [s.taskTemplate, [person.name], view]]);
    }
    const intact = cleanParam(task) === task;
    // What the template delivered WORD FOR WORD must not arrive a second time when the reply
    // flushes the queue — but nothing else may be marked, and only one of the four templates
    // ever delivers the content at all. meeting_invite states that a meeting was called,
    // task_update and daily_task_update say only that something is waiting; all three leave
    // the message itself still to be sent. So a row is marked read only when firstTemplate
    // went AND the body survived flattening intact.
    if (used === s.firstTemplate && intact) {
      for (const r of held) await this.store.update("pending_msgs", { id: r.id }, { in_template: 1 });
    }
    await this.store.upsert("template_log", { phone: person.phone }, { last_at: this.nowIso() });
  }

  // Every task message is written here and nowhere else, so each one reads the same way: what
  // to do first and in full, the task's own number under it, and the three taps below that.
  // The description itself was spelled and punctuated by the parser before it was ever
  // stored, so this is the whole of the "check it before it goes" rule in one place.
  taskBody(t) {
    const foot = [`#${t.id}`];
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
      const flushed = await this.flushPending(phone);
      const st = BTN_RE.exec(id);
      if (st) return this.tapStatus(person, Number(st[1]), st[2]);
      const mt = MTG_RE.exec(id);
      if (mt) return this.respondMeeting(person, Number(mt[1]), mt[2]);
      const cf = CF_RE.exec(id);
      if (cf && this.d.isOwner(phone)) return this.tapConfirm(Number(cf[1]), cf[2]);
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
    // A name he sent after tapping "Someone else" is an answer to that question, not a new
    // instruction. It only wins if it really is a name on the list.
    if (await this.answerPending(text)) return;
    if (await this.ownerCommand(text)) return;
    // A greeting or "who are you" is a conversation, answered by Love, never parsed as work.
    if (OWNER_SMALLTALK.test(text.trim().replace(/[.!?,\s]+$/g, ""))) return this.loveReply(text);
    if (CLEAR_WHAT.test(text) && CLEAR_VERB.test(text) && CLEAR_ALL.test(text) && !MAKES_MEETING.test(text) && text.length < 160) {
      const mtgs = await this.upcomingMeetings();
      const timed = (await this.openTasks(this.d.owner.name)).filter((t) => t.due_at);
      return this.askCancel(mtgs.map((m) => m.id), timed.map((t) => t.id));
    }
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
    // Something he sent a few minutes ago that she could not place is still waiting: this
    // message is most likely the answer to it ("it's for me", "Manish ko"), so both are read
    // together. The parser is told to ignore the earlier one if this stands on its own.
    const prev = await this.store.findOne("followup", { key: "owner" });
    const fresh = prev && this.now() - Date.parse(prev.at) < FOLLOWUP_MS;
    const source = fresh ? `${prev.text} / ${text}` : text;
    const input = fresh ? `EARLIER (not understood): ${prev.text}\nNOW: ${text}` : text;
    if (prev) await this.store.remove("followup", { key: "owner" });

    let parsed;
    try {
      parsed = await this.ai.parseOwner(input, await this.openTasks(),
        `${fmtWeekday(this.nowIso())}, ${fmtTime(this.nowIso())} (${this.nowIso()})`,
        await this.memoryLines(),
        (await this.upcomingMeetings()).map((m) => ({ id: m.id, when: this.meetingWhen(m.at), title: m.title, with: m.with })));
    } catch (e) {
      console.error("Parsing failed", e);
      return this.wa.sendText(phone, "I couldn't read that one just now 💛 Send it again in a minute?");
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
    // Deleting is shown to him first, with exactly what goes, and done only on his tap.
    const cm = [], ct = [];
    for (const c of parsed.cancels || []) {
      const id = Number(c && c.id) || 0;
      if (c.kind === "meeting" && !cm.includes(id)) cm.push(id);
      else if (c.kind === "task" && !ct.includes(id)) ct.push(id);
    }
    if (cm.length || ct.length) {
      if (await this.askCancel(cm, ct, { quiet: true })) out.push("⏸ Waiting on you: tap *Yes, delete* to clear them");
    }
    for (const r of parsed.replies || []) {
      const task = await this.getOpenTask(Number(r.task_id) || 0);
      if (!task || task.owner === this.d.owner.name || !r.message) continue;
      // An approval, a rate or a promise to a client is shown to him before it leaves.
      if (r.needs_confirm) {
        await this.askConfirm("reply", { task_id: task.id, message: r.message },
          [`✍️ *Reply to ${task.owner} on #${task.id}*`, `_${task.description}_`, "",
            r.message, "", `This ${r.why || "commits to something"}. Send it?`].join("\n"));
        out.push(`⏸ Waiting on you: the reply to ${task.owner} on #${task.id}`);
        continue;
      }
      await this.replyToTask(task, r.message, false);
      out.push(`↪ Sent to ${task.owner} on #${task.id}: ${r.message}`);
    }
    const dups = [];
    for (const d of parsed.duplicates || []) {
      const row = await this.getOpenTask(Number(d.task_id) || 0);
      if (row) dups.push(`#${row.id} ${row.owner}: ${row.description}`);
    }
    if (dups.length) out.push("Already open (not added again):\n" + dups.join("\n"));

    // A task he put a name on goes straight out. A task the bot worked out from what people
    // handle is shown to him first, with the reason, so a wrong guess never reaches anyone.
    const sure = [], asked = [];
    for (const t of parsed.tasks || []) {
      const person = this.d.byName(t.owner);
      if (person && t.person_sure === false && person !== this.d.owner) asked.push(t);
      else sure.push(t);
    }
    const created = await this.createTasks({ ...parsed, tasks: sure }, source);
    if (created.length) out.push((created.length === 1 ? "Assigned" : `Assigned (${created.length})`) + "\n" + created.join("\n"));
    for (const t of asked) {
      await this.askConfirm("task", { ...t, source },
        [`📋 *New task*`, "", t.task, "",
          `I'd send this to *${t.owner}*${t.why ? ` — ${t.why}` : ""}. Send it?`].join("\n"),
        { withWho: true });
      out.push(`⏸ Waiting on you: who gets "${String(t.task).slice(0, 48)}…"`);
    }

    const meetings = await this.createMeetings(parsed, source);
    if (meetings.length) out.push((meetings.length === 1 ? "Meeting set" : `Meetings set (${meetings.length})`) + "\n" + meetings.join("\n"));
    // Specific problems createMeetings found (an attendee not on the team, no time given),
    // said plainly instead of the generic "who is this for".
    for (const n of parsed.notices || []) out.push(n);
    // Anything lasting he told her about himself, and any habit he asked for. Both are
    // confirmed in the same breath as the tasks: he should never have to wonder whether it
    // stuck, and the number in the line is how he undoes it.
    for (const m of parsed.memories || []) {
      const row = await this.remember(m && m.text);
      if (row) out.push(Love.remembered(row.text));
    }
    for (const h of parsed.habits || []) {
      const row = await this.rememberHabit(h);
      if (row) out.push(Love.habitSet(row.label, row.times.join(", "), row.id));
    }

    const unclear = (parsed.unclear || []).filter(Boolean);
    // The parser said this was conversation and nothing else came out of it: Love answers,
    // whatever ended up in "unclear" alongside it.
    if (!out.length && parsed.chat) return this.loveReply(text);
    if (unclear.length) {
      out.push("⚠️ I couldn't tell who this is for – just tell me (\"it's for me\", \"Manish\"):\n" + unclear.map((u) => `• ${u}`).join("\n"));
      // Kept for 10 minutes so his next message is read as the answer to this one.
      await this.store.upsert("followup", { key: "owner" }, { text: source.slice(0, 1000), at: this.nowIso() });
    }
    // Nothing in it was work, a command or a status. Then it was him talking to her, and she
    // answers as herself rather than reciting the command list at him.
    if (!out.length) return this.loveReply(text);
    const head = out.some((l) => !l.startsWith("⚠️")) ? Love.ok(this.d.owner.name) : Love.hmm(this.d.owner.name);
    await this.wa.sendText(phone, [head, "", out.join("\n\n")].join("\n"));
  }

  // ---------- Love, talking ----------
  // Her own words, and the only place in the bot where a model writes a message instead of
  // filling one in. Every fact she is allowed to use is handed to her in the prompt — what
  // she remembers about him, where his work stands, and the last few lines between them —
  // so "kal kya hai" is answered from the database and not from imagination.
  async loveReply(text) {
    const owner = this.d.owner;
    const history = (await this.store.find("chat", {}, { sort: { id: -1 }, limit: 8 }))
      .reverse().map((r) => `${r.who}: ${r.text}`).join("\n");
    const reply = (await this.ai.chat(loveSystem({
      owner: owner.name,
      now: `${fmtWeekday(this.nowIso())}, ${fmtTime(this.nowIso())}`,
      memory: await this.memoryLines(),
      context: await this.buildContext(),
      history,
    }), text)) || Love.lost(owner.name);
    await this.store.insert("chat", { who: owner.name, text: text.slice(0, 500), created_at: this.nowIso() });
    await this.store.insert("chat", { who: NAME, text: reply.slice(0, 500), created_at: this.nowIso() });
    await this.wa.sendText(owner.phone, reply);
  }

  // The facts behind a conversation. Enough that "what's left today?" is answered from the
  // database; short enough that it rides in a prompt twenty times a day.
  async buildContext() {
    const owner = this.d.owner.name;
    const mine = await this.openTasks(owner);
    const team = (await this.openTasks()).filter((t) => t.owner !== owner);
    const mtgs = await this.upcomingMeetings();
    const out = [
      mine.length
        ? `His own open tasks:\n${mine.map((t, i) => `${i + 1}. #${t.id} ${t.description}${t.due_at ? ` (due ${this.dueLabel(t.due_at)})` : ""}`).join("\n")}`
        : "His own open tasks: none",
      team.length
        ? `Open on the team:\n${team.slice(0, 20).map((t) => `- ${t.owner}: #${t.id} ${t.description} (${STATUS_LABEL[t.status]})`).join("\n")}`
        : "Open on the team: nothing",
      mtgs.length
        ? `Meetings ahead:\n${mtgs.map((m) => `- ${this.meetingWhen(m.at)}: ${m.title || "meeting"} with ${(m.with || []).join(", ")}`).join("\n")}`
        : "Meetings ahead: none",
    ];
    const score = await this.dayScoreLine();
    if (score) out.push(score);
    return out.join("\n");
  }

  // Everything with a clock on it, soonest first: the meetings he called and his own timed
  // tasks. A meeting carries who has answered and who has not — "what is pending" about a
  // meeting is usually the people, not the hour.
  async buildSchedule() {
    const now = this.nowIso();
    const mtgs = await this.upcomingMeetings();
    const timed = (await this.openTasks(this.d.owner.name)).filter((t) => t.due_at && t.due_at >= now);
    if (!mtgs.length && !timed.length) return "Nothing on the clock ahead of you 💛 No meetings, no timed tasks.";
    const rows = [...mtgs.map((m) => ({ at: m.at, m })), ...timed.map((t) => ({ at: t.due_at, t }))]
      .sort((a, b) => a.at.localeCompare(b.at));
    const tomorrow = addDays(this.today(), 1);
    const dayOf = (iso) => {
      const d = iso.slice(0, 10);
      return d === this.today() ? "Today" : d === tomorrow ? `Tomorrow · ${fmtWeekday(iso)}` : fmtWeekday(iso);
    };
    const out = ["💛 *What's ahead*"];
    let day = null;
    for (const r of rows) {
      if (dayOf(r.at) !== day) { day = dayOf(r.at); out.push("", `*${day}*`); }
      if (r.t) { out.push(`⏰ ${fmtTime(r.at)} · #${r.t.id} ${r.t.description}`); continue; }
      const resp = r.m.responses || {}, names = r.m.with || [];
      const who = [
        names.filter((n) => resp[n] === "yes").join(", ") && `${names.filter((n) => resp[n] === "yes").join(", ")} coming`,
        names.filter((n) => resp[n] === "no").join(", ") && `${names.filter((n) => resp[n] === "no").join(", ")} can't make it`,
        names.filter((n) => !resp[n]).join(", ") && `still waiting on ${names.filter((n) => !resp[n]).join(", ")}`,
      ].filter(Boolean).join(" · ");
      out.push(`📅 ${fmtTime(r.at)} · M${r.m.id} ${r.m.title || "meeting"}`, `   _${who || "nobody invited"}_`);
    }
    return out.join("\n");
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
      const scope = w[1] === "master" ? MASTER : w[1] === "team" ? TEAM : null;
      if (!scope) await this.wa.sendText(phone, "Say newlink team or newlink master");
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
    if (w.length === 3 && w[0] === "assign" && /^#?\d+$/.test(w[1])) {
      const id = Number(w[1].replace("#", ""));
      const row = await this.getTask(id);
      if (!row) { await this.wa.sendText(phone, `No task #${id}.`); return true; }
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
      return true;
    }
    if (["help", "?"].includes(t)) { await this.wa.sendText(phone, HELP); return true; }
    // The exact words get the exact answer. Asked any other way ("kal kya hai", "what have I
    // got on Friday") it goes through Love instead, which is given the same schedule as
    // context — so the question is answered either way, by the same facts.
    if (["schedule", "meetings", "meeting", "calendar", "upcoming", "agenda", "my schedule"].includes(t)) {
      await this.wa.sendText(phone, await this.buildSchedule());
      return true;
    }
    if (["memory", "memories", "remember", "reminders"].includes(t)) {
      await this.wa.sendText(phone, await this.memoryText());
      return true;
    }
    if (w[0] === "forget" && w.length === 2 && /^#?\d+$/.test(w[1])) {
      const id = Number(w[1].replace("#", ""));
      const row = await this.store.findOne("memory", { id });
      if (!row) await this.wa.sendText(phone, `I'm not holding anything numbered ${id}. Say *memory* to see the list.`);
      else {
        await this.store.remove("memory", { id });
        await this.wa.sendText(phone, row.kind === "reminder"
          ? `💛 Done — I won't remind you to ${row.label} any more.`
          : `💛 Forgotten: ${row.text}`);
      }
      return true;
    }
    if (["brief", "summary", "pending"].includes(t)) { await this.wa.sendText(phone, await this.buildBrief()); return true; }
    if (["today", "overview", "status"].includes(t)) { await this.wa.sendText(phone, await this.buildTodayOverview()); return true; }
    if (["list", "open", "tasks"].includes(t)) { await this.wa.sendText(phone, await this.buildList()); return true; }
    // "cancel M1" and "move M1 to 5 pm". A meeting is M-numbered everywhere the bot writes
    // one, and that m is the whole of what keeps "cancel 12" (a task) and "cancel M12" (a
    // meeting) apart. Anything else after the number is not a match at all, so a typo asks
    // again instead of calling off the wrong thing.
    const mtg = t.match(/^(cancel|call off|move|reschedule|shift) +m ?#?([0-9]{1,5})(?![0-9])( .*)?$/);
    if (mtg) {
      const id = Number(mtg[2]);
      await this.wa.sendText(phone, /^(cancel|call off)$/.test(mtg[1])
        ? await this.cancelMeeting(id)
        : await this.moveMeeting(id, mtg[3] || ""));
      return true;
    }
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
      await this.wa.sendText(this.d.owner.phone, Love.sentTo(person.name) + back);
    }
  }

  async createTasks(parsed, source) {
    const lines = [];
    for (const t of parsed.tasks || []) {
      const person = this.d.byName(t.owner);
      const desc = (t.task || "").trim();
      if (!person || !desc) { (parsed.unclear ||= []).push(desc || JSON.stringify(t)); continue; }
      const mine = person === this.d.owner;
      const held = !mine && (await this.paused(person)); // on leave: held until they are back
      const now = this.nowIso();
      const dueAt = this.dueIso(t.due_at);
      const task = await this.store.insert("tasks", {
        owner: person.name, description: desc, status: "new",
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
      lines.push(`#${task.id} ${mine ? "You" : person.name}${when}\n   ${desc}`);
    }
    return lines;
  }

  // ---------- meetings ----------
  // A meeting is not a task. A task is work handed to one person and it is finished or it is
  // not; a meeting is a moment two or more people have to be at, so it has no owner, it has
  // attendees, each of them answers for themselves, and the reminder goes to all of them —
  // Ankit included, which is the one thing a task reminder never does.
  getMeeting(id) { return this.store.findOne("meetings", { id }); }
  setMeeting(id, set) { return this.store.update("meetings", { id }, { ...set, updated_at: this.nowIso() }); }

  // Everything still ahead of us and not called off. Small enough to filter in memory, and
  // filtering here keeps the two stores from having to agree about querying inside an array.
  async upcomingMeetings() {
    const now = this.nowIso();
    return (await this.store.find("meetings", { status: MEETING_OPEN }, { sort: { at: 1 } }))
      .filter((m) => m.at >= now.slice(0, 16));
  }

  async meetingsFor(name) {
    return (await this.upcomingMeetings()).filter((m) => (m.with || []).includes(name));
  }

  meetingWhen(at) {
    return at.slice(0, 10) === this.today() ? `today ${fmtTime(at)}` : fmtStamp(at);
  }

  // What an attendee is sent. It names who called it, when, what about, and who else is in
  // the room — a meeting invitation that does not say who else is coming is half an invitation.
  meetingBody(m, forName, movedFrom = null) {
    const others = (m.with || []).filter((n) => n !== forName);
    const whoElse = others.length ? `With: Ankit, ${others.join(", ")}` : "With: Ankit";
    const L = [movedFrom ? `📅 *Meeting moved*` : `📅 *Meeting called by Ankit*`, "", `🕒 *${this.meetingWhen(m.at)}*`];
    if (movedFrom) L.push(`_was ${this.meetingWhen(movedFrom)}_`);
    if (m.title) L.push(m.title);
    L.push(whoElse);
    if (m.note) L.push("", m.note);
    L.push("", `_M${m.id} · you get a reminder 5 minutes before_`);
    return L.join("\n");
  }

  // Create what the parser found, invite everyone, and tell Ankit who was told.
  async createMeetings(parsed, source) {
    const lines = [];
    for (const raw of parsed.meetings || []) {
      const at = this.dueIso(raw.at);
      const names = [], outside = [];
      for (const n of raw.with || []) {
        const p = this.d.byName(n);
        if (p && p !== this.d.owner) { if (!names.includes(p.name)) names.push(p.name); }
        else if (!p && String(n).trim() && !outside.includes(String(n).trim())) outside.push(String(n).trim());
      }
      const who = [...names, ...outside].join(", ") || "someone";
      if (!at) {
        (parsed.notices ||= []).push(`⚠️ What time is the meeting with ${who}? Say it again with the time.`);
        await this.store.upsert("followup", { key: "owner" }, { text: String(source).slice(0, 1000), at: this.nowIso() });
        continue;
      }
      // Nobody on the team is invited (a client, an outsider): there is no one the bot can
      // message, so it goes on Ankit's own calendar as a timed task and pings him 5 minutes
      // before — and he is told how to add them if he wants them invited next time.
      if (!names.length) {
        const title = `Meeting with ${who}${raw.title ? ` — ${String(raw.title).trim()}` : ""}${raw.note ? ` (${String(raw.note).trim()})` : ""}`;
        const made = await this.createTasks({ tasks: [{ owner: this.d.owner.name, task: title, due_at: raw.at }] }, source);
        for (const l of made) lines.push(`${l}\n   ${who} ${outside.length === 1 ? "is" : "are"} not on your team list, so I put it on your calendar and will remind you 5 minutes before. To invite them on WhatsApp: *add ${outside[0] || "Name"} 91XXXXXXXXXX*`);
        continue;
      }
      const now = this.nowIso();
      const m = await this.store.insert("meetings", {
        title: (raw.title || "").trim() || null,
        with: names, at, status: "called", note: (raw.note || "").trim() || null,
        responses: {}, reminded: 0, source_text: source, created_at: now, updated_at: now,
      });

      const told = [], missed = [], closed = [];
      for (const name of names) {
        const person = this.d.byName(name);
        if (!person) continue;
        // Outside the 24-hour window Meta allows only an approved template, and the one this
        // bot has is worded as a task reminder. The invite still reaches them — it rides the
        // template and the full text follows the moment they reply — but Ankit is told, so
        // he can ring the ones who will read "a reminder regarding" instead of an invitation.
        const open = await this.inWindow(person.phone);
        try {
          await this.deliver(person, this.meetingBody(m, name), meetingButtons(m.id),
            { kind: "meeting", id: m.id, at, when: fmtStamp(at), title: m.title });
          told.push(name);
          if (!open) closed.push(name);
        } catch (e) {
          console.error("[ankit-desk] meeting invite failed", m.id, name, e);
          missed.push(name);
        }
      }
      let line = `M${m.id} · ${this.meetingWhen(at)}${m.title ? ` · ${m.title}` : ""}\n   told ${told.join(", ") || "nobody"}`;
      if (closed.length) line += `\n   ⚠️ ${closed.join(", ")} ${closed.length === 1 ? "has" : "have"} not messaged in 24h, so it goes as the approved template first`;
      if (missed.length) line += `\n   ⚠️ NOT delivered to ${missed.join(", ")}`;
      if (outside.length) line += `\n   ⚠️ ${outside.join(", ")} not on your team list, so not invited`;
      lines.push(line);
    }
    return lines;
  }

  // Called off. Everyone invited is told at once — a meeting people turn up to after it was
  // cancelled is the one thing worse than a meeting nobody can make. The 5-minute reminder
  // needs nothing switched off: it reads MEETING_OPEN, which a cancelled meeting is not.
  async cancelMeeting(id) {
    const m = await this.getMeeting(id);
    if (!m) return `There is no meeting M${id}. Say *schedule* and I'll show you what is ahead.`;
    if (m.status === "cancelled") return `M${id} was already cancelled — nobody is expecting it.`;
    await this.setMeeting(id, { status: "cancelled" });
    const told = [], missed = [];
    for (const name of m.with || []) {
      const person = this.d.byName(name);
      if (!person) continue;
      try {
        // No meeting meta on purpose. Outside the 24-hour window that template announces a
        // meeting, and announcing one that has just been called off is worse than the plain
        // template carrying these words.
        await this.deliver(person, [`✖️ *Meeting cancelled*`, "", `🕒 ${this.meetingWhen(m.at)}`,
          m.title, "", "Ankit has called it off — nothing else needed from you."].filter((x) => x !== null && x !== undefined).join("\n"));
        told.push(name);
      } catch (e) {
        console.error("[ankit-desk] cancel notice failed", id, name, e);
        missed.push(name);
      }
    }
    let out = `✖️ M${id} cancelled — ${this.meetingWhen(m.at)}${m.title ? ` · ${m.title}` : ""}\n   told ${told.join(", ") || "nobody"}`;
    if (missed.length) out += `\n   ⚠️ NOT delivered to ${missed.join(", ")}`;
    return `${Love.ok(this.d.owner.name)}\n\n${out}`;
  }

  // A new time. Everyone is invited again rather than merely informed: they answered about a
  // different hour, so the old answers are cleared and each of them gets the three buttons
  // back. The reminder flag goes back to 0 too, or a meeting moved later in the day would
  // never be reminded at all.
  async moveMeeting(id, when) {
    const m = await this.getMeeting(id);
    if (!m) return `There is no meeting M${id}. Say *schedule* and I'll show you what is ahead.`;
    if (m.status === "cancelled") return `M${id} is cancelled. Call it again and I'll invite everyone fresh.`;
    const iso = this.dueIso(parseWhen(when, this.today(), this.nowIso().slice(11, 16)));
    if (!iso) {
      return `When shall I move M${id} to? Tell me like *move M${id} to 5 pm*, *move M${id} to kal 11* or *move M${id} to 25 nov 4 pm*.`;
    }
    const from = m.at;
    if (iso === from) return `M${id} is already at ${this.meetingWhen(from)}.`;
    await this.setMeeting(id, { at: iso, responses: {}, reminded: 0 });
    const next = { ...m, at: iso, responses: {} };
    const told = [], missed = [];
    for (const name of m.with || []) {
      const person = this.d.byName(name);
      if (!person) continue;
      try {
        await this.deliver(person, this.meetingBody(next, name, from), meetingButtons(id),
          { kind: "meeting", id, at: iso, when: fmtStamp(iso), title: m.title });
        told.push(name);
      } catch (e) {
        console.error("[ankit-desk] move notice failed", id, name, e);
        missed.push(name);
      }
    }
    let out = `🕒 M${id} moved to ${this.meetingWhen(iso)}${m.title ? ` · ${m.title}` : ""}\n   _was ${this.meetingWhen(from)}_\n   asked ${told.join(", ") || "nobody"} again`;
    if (missed.length) out += `\n   ⚠️ NOT delivered to ${missed.join(", ")}`;
    return `${Love.ok(this.d.owner.name)}\n\n${out}`;
  }

  // An attendee answering, by tap or in words. Their answer is kept against their own name,
  // and Ankit hears it at once: a meeting nobody can make is only useful to know before it.
  async respondMeeting(person, id, choice, note = "") {
    const m = await this.getMeeting(id);
    if (!m || m.status === "cancelled") {
      return this.wa.sendText(person.phone, `M${id} is not a meeting on your list any more.`);
    }
    if (!(m.with || []).includes(person.name)) {
      return this.wa.sendText(person.phone, `M${id} is not your meeting.`);
    }
    const responses = { ...(m.responses || {}), [person.name]: choice };
    await this.setMeeting(id, { responses });
    const when = this.meetingWhen(m.at);
    await this.wa.sendText(person.phone,
      choice === "yes" ? `✅ Noted — you are down for the meeting ${when}.`
        : choice === "no" ? `✖️ Noted — Ankit has been told you cannot make it ${when}.`
          : `🕒 Noted — Ankit has been asked for another time.`);
    const extra = note ? `\n_${note}_` : "";
    await this.wa.sendText(this.d.owner.phone,
      `📅 *${person.name}* ${MTG_REPLY[choice]} — M${id}, ${when}${m.title ? ` (${m.title})` : ""}${extra}`);
  }

  // Five minutes before, to everyone who is expected — Ankit as well as the team.
  async runDueMeetings() {
    const cutoff = isoLocal(new Date(this.now().getTime() + DUE_LEAD_MS), this.s.timezone);
    const rows = (await this.store.find("meetings", { status: MEETING_OPEN, reminded: 0 }, { sort: { at: 1 } }))
      .filter((m) => m.at <= cutoff);
    const sent = [], failed = [];
    for (const m of rows) {
      const names = (m.with || []).filter((n) => (m.responses || {})[n] !== "no");
      const body = [`⏰ *Meeting in 5 minutes* — ${fmtTime(m.at)}`,
        m.title || null,
        `With: ${["Ankit", ...(m.with || [])].join(", ")}`,
        m.note || null].filter(Boolean).join("\n");
      let ok = true;
      for (const name of [...names, this.d.owner.name]) {
        const person = this.d.byName(name);
        if (!person) continue;
        try {
          // Straight out, not through deliver(): a reminder that arrives after the meeting
          // has started is worse than none, so it is never queued behind a closed window.
          if (await this.inWindow(person.phone)) await this.wa.sendText(person.phone, body);
          else if (person === this.d.owner) await this.wa.sendText(person.phone, body);
        } catch (e) {
          console.error("[ankit-desk] meeting reminder failed", m.id, name, e);
          failed.push(`M${m.id}:${name}`);
          ok = false;
        }
      }
      if (ok) {
        await this.setMeeting(m.id, { reminded: 1 });
        sent.push(`M${m.id}`);
      }
    }
    return { sent, failed };
  }

  // ---------- things Ankit is asked about before they go ----------
  // The bot acts on its own when the step is mechanical and asks first when the step is a
  // judgement: a task it routed by reasoning rather than by a name he said, and a reply that
  // carries an approval, a rate or a promise. A wrong task can be reassigned; a wrong
  // approval sitting in someone's WhatsApp cannot be taken back.
  async askConfirm(kind, payload, body) {
    const row = await this.store.insert("pending_actions", {
      kind, payload: JSON.stringify(payload), status: "open", created_at: this.nowIso(),
    });
    await this._out(this.d.owner.phone, body, confirmButtons(row.id, kind));
    return row;
  }

  async tapConfirm(id, choice) {
    const phone = this.d.owner.phone;
    const row = await this.store.findOne("pending_actions", { id });
    if (!row || row.status !== "open") return this.wa.sendText(phone, "That one is already dealt with.");
    const payload = JSON.parse(row.payload);

    if (choice === "no") {
      await this.store.update("pending_actions", { id }, { status: "cancelled" });
      if (row.kind === "beat") {
        // Not a refusal of the idea, just of this draft: remember so it is not asked again
        // next week, and say what the silence will mean.
        const p = await this.team.find(payload.name);
        if (p) await this.store.update("people", { id: p.id }, { beat_declined: this.nowIso() });
        return this.wa.sendText(phone,
          `Left blank. Tasks with nobody named on them will never be guessed onto ${payload.name}.\nYou can set it any time: *edit ${payload.name} does ...*`);
      }
      return this.wa.sendText(phone, Love.dropped);
    }
    if (choice === "who") {
      await this.store.upsert("awaiting_input", { person: this.d.owner.name },
        { action_id: id, kind: row.kind, at: this.nowIso() });
      return this.wa.sendText(phone, row.kind === "beat"
        ? `What does *${payload.name}* handle?\n\nReply with a few words — accounts, clients, systems.`
        : `Who should get it?\n_${payload.task}_\n\nReply with the name.`);
    }
    await this.store.update("pending_actions", { id }, { status: "sent" });
    return this.applyConfirmed(row.kind, payload);
  }

  async applyConfirmed(kind, payload) {
    const phone = this.d.owner.phone;
    if (kind === "task") {
      const lines = await this.createTasks({ tasks: [payload] }, payload.source || "");
      return this.wa.sendText(phone, lines.length ? `Assigned\n${lines.join("\n")}` : "Could not assign that.");
    }
    if (kind === "reply") {
      const task = await this.getOpenTask(payload.task_id);
      if (!task) return this.wa.sendText(phone, `#${payload.task_id} is not open any more. Nothing sent.`);
      return this.replyToTask(task, payload.message);
    }
    if (kind === "beat") {
      const r = await this.team.edit(payload.name, "does", payload.does);
      return this.wa.sendText(phone, r.ok || `⚠️ ${r.error}`);
    }
    if (kind === "clear") {
      const lines = [];
      for (const id of payload.meetings || []) {
        const m = await this.getMeeting(id);
        if (!m || m.status === "cancelled") continue;
        // cancelMeeting tells everyone invited; only its summary line is kept here.
        lines.push((await this.cancelMeeting(id)).split("\n\n").slice(1).join("\n\n"));
      }
      for (const id of payload.tasks || []) {
        const t = await this.getOpenTask(id);
        if (!t) continue;
        await this.setTask(id, { status: "cancelled" });
        lines.push(`✖️ #${id} cancelled — ${t.description}`);
      }
      return this.wa.sendText(phone, lines.length
        ? `${Love.ok(this.d.owner.name)}\n\n${lines.join("\n")}\n\nYour calendar is clear.`
        : "Nothing left to delete — your calendar is already clear 💛");
    }
  }

  // Meetings and his own timed tasks he asked to delete. Only real, still-open rows are kept,
  // and only his own tasks: a team member's task is never cancelled from a bulk request.
  // Returns true when a confirmation went out.
  async askCancel(meetingIds, taskIds, { quiet = false } = {}) {
    const mtgs = [], tasks = [];
    for (const id of meetingIds) {
      const m = await this.getMeeting(id);
      if (m && !["cancelled", "done"].includes(m.status)) mtgs.push(m);
    }
    for (const id of taskIds) {
      const t = await this.getOpenTask(id);
      if (t && t.owner === this.d.owner.name) tasks.push(t);
    }
    if (!mtgs.length && !tasks.length) {
      if (!quiet) await this.wa.sendText(this.d.owner.phone, "Your calendar is already clear 💛 Nothing to delete.");
      return false;
    }
    const body = ["🗑 *Delete these?*", ""];
    for (const m of mtgs) body.push(`M${m.id} · ${this.meetingWhen(m.at)}${m.title ? ` · ${m.title}` : ""}${(m.with || []).length ? ` (with ${m.with.join(", ")})` : ""}`);
    for (const t of tasks) body.push(`#${t.id} · ${t.description}${t.due_at ? ` · ⏰ ${this.dueLabel(t.due_at)}` : ""}`);
    if (mtgs.some((m) => (m.with || []).length)) body.push("", "Everyone invited will be told it is called off.");
    await this.askConfirm("clear", { meetings: mtgs.map((m) => m.id), tasks: tasks.map((t) => t.id) }, body.join("\n"));
    return true;
  }

  // What he sent after tapping the middle button: a name, or the words of a beat.
  async answerPending(text) {
    const owner = this.d.owner.name;
    const waiting = await this.store.findOne("awaiting_input", { person: owner });
    if (!waiting) return false;

    let payload;
    if (waiting.kind === "beat") {
      payload = { does: text.trim().slice(0, 300) };
    } else {
      const person = this.d.byName(text.trim());
      // Not a name: leave the question standing and let this be read as a new instruction
      // instead of swallowing it.
      if (!person) return false;
      payload = { owner: person.name };
    }

    await this.store.remove("awaiting_input", { person: owner });
    const row = await this.store.findOne("pending_actions", { id: waiting.action_id });
    if (!row || row.status !== "open") {
      await this.wa.sendText(this.d.owner.phone, "That one is already dealt with.");
      return true;
    }
    const merged = { ...JSON.parse(row.payload), ...payload };
    await this.store.update("pending_actions", { id: row.id }, { status: "sent", payload: JSON.stringify(merged) });
    await this.applyConfirmed(row.kind, merged);
    return true;
  }

  // ---------- learning what people handle ----------
  // The bot cannot route a task to someone whose `does` is empty, and for a new team that is
  // everyone. Rather than leaving Ankit to write nine lines up front, it watches the tasks he
  // assigns BY NAME and, once a person has enough of them to show a pattern, drafts their line
  // from those tasks and offers it to him with a tap.
  //
  // At most one person per run, and only from the brief, so it is one quiet question a day at
  // the moment he is already reading. Nothing is ever written without him approving it: a
  // wrong beat silently misroutes real work, which is worse than no beat at all.
  async proposeBeat() {
    const today = this.today();
    const stale = (iso, days) => !iso || daysBetween(iso.slice(0, 10), today) >= days;
    const candidates = [];
    for (const r of await this.team.rows()) {
      if ((r.does || "").trim()) continue;
      if (!stale(r.beat_declined, BEAT_DECLINE_DAYS)) continue;
      if (!stale(r.beat_asked, BEAT_RETRY_DAYS)) continue;
      const tasks = await this.store.find("tasks", { owner: r.name }, { sort: { id: -1 } });
      if (tasks.length < BEAT_MIN_TASKS) continue;
      candidates.push({ row: r, tasks });
    }
    if (!candidates.length) return null;
    // Whoever has the most to go on.
    candidates.sort((a, b) => b.tasks.length - a.tasks.length);
    const { row, tasks } = candidates[0];

    let does = null;
    try {
      does = await this.ai.draftBeat(row.name, tasks.slice(0, 30).map((t) => t.description));
    } catch (e) {
      console.error("[ankit-desk] beat draft failed", row.name, e);
      return null;
    }
    // Marked whether or not a draft came back, so a person whose tasks show no pattern is not
    // re-drafted every single evening.
    await this.store.update("people", { id: row.id }, { beat_asked: this.nowIso() });
    if (!does) return null;

    await this.askConfirm("beat", { name: row.name, does }, [
      `✍️ *What does ${row.name} handle?*`, "",
      `From the ${tasks.length} tasks you have given ${row.name}, this looks right:`, "",
      `_${does}_`, "",
      "Save it and a task with nobody named on it can reach them by itself.",
    ].join("\n"));
    return row.name;
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
    // He asked to hear every tap as it happens, not at six o'clock: a task going green is
    // the one thing he was waiting on, and the evening overview still counts it.
    if (person !== this.d.owner) {
      await this.wa.sendText(this.d.owner.phone, Love.teamMoved(person.name,
        `${choice === "done" ? "✅" : "⏳"} ${label} — #${id} ${t.description}`));
    }
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
      if (!items.length) await this.wa.sendText(person.phone, `Hi ${person.name} – you're connected to Ankit's desk. Tasks from Ankit will arrive here.`);
      return;
    }
    // Someone with no open tasks may still have a meeting to answer, so the meetings are
    // loaded before the "nothing to match this against" shortcut, not after it.
    const mtgs = await this.meetingsFor(person.name);
    if (!items.length && !mtgs.length) {
      await this.saveNote(person, text);
      return this.wa.sendText(person.phone, "Noted – this will go to Ankit in tomorrow's brief.");
    }
    let parsed;
    try {
      parsed = await this.ai.parseStatus(text, items,
        mtgs.map((m) => ({ id: m.id, when: this.meetingWhen(m.at), title: m.title || "meeting with Ankit" })));
    } catch (e) {
      console.error("Status parse failed", e);
      return this.wa.sendText(person.phone, "Couldn't read that right now. Please send it again in a minute.");
    }
    const mine = new Map(items.map(([, t]) => [t.id, t]));
    const now = this.nowIso(), today = this.today(), lines = [], forAnkit = [];
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
      // What he sees has to carry the work itself: "#14 Done" on its own is a number he has
      // to go and look up.
      forAnkit.push(`${STATUS_MARK[st] || "•"} ${label} — #${id} ${mine.get(id).description}` + (note ? `\n   _${note}_` : ""));
    }
    // An answer about a meeting, given in words rather than by tapping a button.
    const mineM = new Set(mtgs.map((m) => m.id));
    let answered = 0;
    for (const u of parsed.meeting_updates || []) {
      const id = Number(u.meeting_id);
      if (!mineM.has(id) || !["yes", "no", "move"].includes(u.reply)) continue;
      await this.respondMeeting(person, id, u.reply, u.note || "");
      answered++;
    }
    if (parsed.other) await this.saveNote(person, parsed.other);
    if (lines.length) {
      await this.store.upsert("checkins", { date: today, owner: person.name }, { replied: 1 });
      await this.wa.sendText(person.phone, "Updated\n" + lines.join("\n"));
      // Their words, the moment they send them — same rule as a tap.
      await this.wa.sendText(this.d.owner.phone, Love.teamMoved(person.name, forAnkit.join("\n")));
    } else if (answered) {
      // respondMeeting has already answered them; saying "couldn't match that" after it would
      // be a second, contradicting reply.
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
      const body = (person === this.d.owner ? "💛 " : "") +
        `⏰ *Reminder – ${this.dueLabel(t.due_at)}*\n#${t.id} ${t.description}` +
        (person === this.d.owner ? "" : "\n(from Ankit)");
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
    // Meetings ride the same minute-by-minute job: they are due at a clock time on any day,
    // exactly like a task that carries one, and they are at-most-once by their own flag.
    try {
      const m = await this.runDueMeetings();
      sent.push(...m.sent);
      failed.push(...m.failed);
    } catch (e) {
      console.error("[ankit-desk] meeting reminders failed", e);
      failed.push(`meetings:${e.message}`);
    }
    // And the habits, for the same reason: they belong to a clock time on a day, not to one
    // of the fixed slots, so they ride the job that runs every minute.
    try {
      const h = await this.runHabits();
      sent.push(...h.sent);
      failed.push(...h.failed);
    } catch (e) {
      console.error("[ankit-desk] habit reminders failed", e);
      failed.push(`habits:${e.message}`);
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
        // An announcement, so no buttons: taps belong on a task Ankit just handed out, not on
        // a twice-daily list of everything already open.
        await this.deliver(person, this.pendingBody(tasks), null, { kind: "pending" });
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
    // His own list, at the same two times. The team's round reminds them what is on them;
    // this is the same courtesy for him — and its numbering is the one "1 done" answers to,
    // so it is rewritten here exactly as it is for everyone else.
    const owner = this.d.owner;
    try {
      const mine = await this.openTasks(owner.name);
      if (mine.length) {
        await this.wa.sendText(owner.phone, [Love.mine(this.nowIso()), "", this.pendingBody(mine)].join("\n"));
        await this.store.remove("checkin_items", { owner: owner.name });
        for (const [i, t] of mine.entries()) {
          await this.store.insert("checkin_items", { owner: owner.name, idx: i + 1, task_id: t.id });
        }
        sent.push(`${owner.name}:${mine.length}`);
      }
    } catch (e) {
      console.error("[ankit-desk] own pending list failed", e);
      failed.push(`${owner.name}:${e.message}`);
    }
    return { sent, failed };
  }

  // The habits he asked Love to hold: "remind me to drink water" and she pings him at the
  // times she set, every day, until he says forget.
  //
  // At most once per slot per day, and the mark is written whether it was sent or skipped —
  // so a server that was asleep all afternoon pings him for the slot it has just missed, not
  // for all four at once, and never twice for the same one.
  async runHabits() {
    const now = this.nowIso(), today = this.today(), hhmm = now.slice(11, 16);
    const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
    const sent = [], failed = [];
    for (const r of await this.store.find("memory", { kind: "reminder", active: 1 }, { sort: { id: 1 } })) {
      if (r.days && r.days !== "daily" && !r.days.split(",").includes(weekdayOf(today))) continue;
      const due = (r.times || []).filter((t) => t <= hhmm).sort().pop();
      if (!due) continue;
      const slot = `${today}T${due}`;
      if ((r.last || "") >= slot) continue;
      await this.store.update("memory", { id: r.id }, { last: slot });
      // More than an hour late is not a reminder any more, it is a surprise.
      if (mins(hhmm) - mins(due) > 59) continue;
      try {
        await this.wa.sendText(this.d.owner.phone, Love.nudge(r.text));
        sent.push(`habit${r.id}@${due}`);
      } catch (e) {
        console.error("[ankit-desk] habit reminder failed", r.id, e);
        failed.push(`habit${r.id}:${e.message}`);
      }
    }
    return { sent, failed };
  }

  // What is pending and nothing else: the work's own name and its deadline if it has one. No
  // status, no age, no id and no reply prompt - this is an announcement, and WhatsApp already
  // stamps it with the time it arrived. The numbering is still the one checkin_items records,
  // so a volunteered "1 done" keeps working.
  pendingBody(tasks) {
    const L = [`📌 *Pending with you (${tasks.length})*`, ""];
    for (const [i, t] of tasks.entries()) {
      L.push(`*${i + 1}.* ${t.description}` + (t.due_at ? `\n   _⏰ ${this.dueLabel(t.due_at)}_` : ""));
    }
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
    const L = [Love.dayHead(this.nowIso(), this.d.owner.name), "",
      `*Your day – ${fmtWeekday(this.nowIso())}: ${done.length} of ${done.length + open.length} done*`];
    L.push(...done.map((t) => `✓ #${t.id} ${t.description}`));
    if (openLines.length) L.push("", "Still open:", ...openLines, "", 'Reply e.g. "1 done" or "1 done, 2 done"');
    else if (done.length) L.push("", "All done 👏");
    else L.push("", "Nothing of your own today.");
    return [...L, "", "━━━━━━━━━━━━━━", "", await this.buildTodayOverview()].join("\n");
  }

  // The 6 PM picture, and the *today* command: everything handed to the team today, whose it
  // is and where it stands right now. Ankit's own tasks are the day above it, so they are not
  // counted twice.
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
      L.push("", `*${name}* · ${plural(theirs.length, "task")}`);
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
    // One quiet question a day, after the brief he is already reading.
    try { await this.proposeBeat(); } catch (e) { console.error("[ankit-desk] beat proposal failed", e); }
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
    const L = [Love.briefHead(this.nowIso(), this.d.owner.name), "",
      `*DAILY BRIEF – ${fmtWeekday(this.nowIso())}*`, ""];

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
      L.push(`• ${t.owner} #${t.id}: ${t.description} – ${this.age(t)}, ${STATUS_LABEL[t.status]}` + (t.note ? ` – ${t.note}` : ""));
    }

    L.push("", "*BY PERSON*");
    const since = isoLocal(new Date(this.now().getTime() - 86400000), this.s.timezone);
    for (const p of this.d.people) {
      const done = await this.store.count("tasks", { owner: p.name, status: "done", done_at: { $gte: since } });
      const c = { working: 0, stuck: 0, new: 0 };
      for (const t of all) if (t.owner === p.name) c[t.status]++;
      if (done || c.working || c.stuck || c.new) {
        const parts = [`${done} done`, `${c.working} working`, `${c.stuck} stuck`];
        if (c.new) parts.push(`${c.new} not started`);
        L.push(`${p.name}: ` + parts.join(" | "));
      }
    }

    const missed = (await this.store.find("checkins", { date: yday, replied: 0 })).map((r) => r.owner);
    // Tomorrow, the night before: a meeting he called at 10 AM is no use to him at 9:55,
    // and this is the one message of the day he reads with time to move something.
    const tmw = addDays(today, 1);
    const tMtgs = (await this.upcomingMeetings()).filter((m) => m.at.slice(0, 10) === tmw);
    const tTasks = (await this.openTasks(owner)).filter((t) => (t.due_at || "").slice(0, 10) === tmw);
    if (tMtgs.length || tTasks.length) {
      L.push("", `*TOMORROW – ${fmtWeekday(tmw + "T09:00")}*`);
      for (const m of tMtgs) {
        const r = m.responses || {}, names = m.with || [];
        const quiet = names.filter((n) => !r[n]);
        L.push(`📅 ${fmtTime(m.at)} · M${m.id} ${m.title || "meeting"} · with ${names.join(", ")}` +
          (quiet.length ? ` – no answer yet from ${quiet.join(", ")}` : ""));
      }
      for (const t of tTasks) L.push(`⏰ ${fmtTime(t.due_at)} · #${t.id} ${t.description}`);
    }

    if (missed.length) L.push("", "*NO UPDATE YESTERDAY:* " + missed.join(", "));
    const notes = await this.store.find("notes", { reported: 0 }, { sort: { id: 1 } });
    if (notes.length) L.push("", "*NOTES FROM TEAM*", ...notes.map((n) => `• ${n.owner}: ${n.text}`));
    L.push("", Love.briefClose);
    return L.join("\n");
  }

  async buildList() {
    const tasks = await this.openTasks();
    if (!tasks.length) return "No open tasks.";
    const out = ["*OPEN TASKS*"];
    let current = null;
    for (const t of [...tasks].sort((a, b) => a.owner.localeCompare(b.owner) || a.id - b.id)) {
      if (t.owner !== current) { current = t.owner; out.push(`\n_${current}_`); }
      out.push(`#${t.id} ${t.description} – ${STATUS_LABEL[t.status]}, ${this.age(t)}` +
        (t.due_at ? ` · ⏰ ${this.dueLabel(t.due_at)}` : ""));
    }
    return out.join("\n");
  }
}