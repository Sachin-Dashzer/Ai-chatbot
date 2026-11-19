import crypto from "node:crypto";
import { daysBetween, fmtDayMon, fmtStamp, fmtWeekday, fmtTime, isoLocal } from "./time.js";

export const MASTER = "__master__";
// The one board the team sees: everything open with the team on it, and nothing of Ankit's.
export const TEAM = "__team__";
const AMBER_DAYS = 3, RED_DAYS = 7;
// How many finished tasks the Completed view draws. Everything older is in the CSV.
const CLOSED_LIMIT = 200;
const OPEN = { $nin: ["done", "cancelled"] };

export class Boards {
  constructor(bot) {
    this.bot = bot;
    this.store = bot.store;
    this.d = bot.d;
  }

  // ---------- keys ----------
  async keyFor(scope) {
    const row = await this.store.findOne("board_keys", { scope });
    if (row) return row.key;
    const key = crypto.randomBytes(12).toString("base64url");
    await this.store.insert("board_keys", { scope, key });
    return key;
  }

  async regenerate(scope) {
    await this.store.remove("board_keys", { scope });
    return this.keyFor(scope);
  }

  async scopeOf(key) {
    const row = await this.store.findOne("board_keys", { key });
    // Only these two boards exist. A key left over from the old per-business boards reads as
    // not valid rather than quietly opening the team board.
    return row && (row.scope === MASTER || row.scope === TEAM) ? row.scope : null;
  }

  async linksText(baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    const people = this.d.people.map((p) => p.name).join(", ") || "—";
    return ["*Board links* (private – share each only with the people it is for)", "",
      `Master (only you): ${base}/board/${await this.keyFor(MASTER)}`, "",
      `Team → ${people}\n${base}/board/${await this.keyFor(TEAM)}`, "",
      "If a link reaches the wrong person: send *newlink team* (or *newlink master*) – the old link stops working.",
    ].join("\n");
  }

  // ---------- data ----------
  // Nothing is ranked any more, so being stuck and having sat too long are the whole of it.
  needsAttention(t) {
    if (t.status === "stuck") return true;
    return daysBetween(t.created_at.slice(0, 10), this.bot.today()) >= RED_DAYS;
  }

  card(t, remarks = []) {
    const days = daysBetween(t.created_at.slice(0, 10), this.bot.today());
    const c = {
      id: t.id, description: t.description, owner: t.owner, days,
      status: t.status, stuckOn: t.stuck_on, note: t.note,
      ageText: days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`,
      ageLevel: days >= RED_DAYS ? "red" : days >= AMBER_DAYS ? "amber" : "",
      doneOn: t.done_at ? fmtDayMon(t.done_at) : null,
      // How long a finished task took, so a closed row says more than its date.
      took: t.done_at ? daysBetween(t.created_at.slice(0, 10), t.done_at.slice(0, 10)) : null,
      // A due time reads as a clock if it is today, as a date and time otherwise.
      due: t.due_at ? (t.due_at.slice(0, 10) === this.bot.today() ? fmtTime(t.due_at) : fmtStamp(t.due_at)) : null,
      attention: t.status !== "done" && this.needsAttention(t),
      isMine: t.owner === this.d.owner.name,
      remarks,
    };
    return c;
  }

  // One query for every card's remarks instead of one per card: a board draws
  // dozens of cards and each round trip to the store costs more than the work.
  async cards(tasks, withRemarks = false) {
    if (!withRemarks || !tasks.length) return tasks.map((t) => this.card(t));
    const notes = await this.store.find("task_notes", { task_id: { $in: tasks.map((t) => t.id) } }, { sort: { id: -1 } });
    const by = new Map();
    for (const n of notes) {
      const list = by.get(n.task_id) || [];
      if (list.length < 20) list.push({ when: fmtStamp(n.created_at), person: n.person, status: n.status, text: n.text });
      by.set(n.task_id, list);
    }
    return tasks.map((t) => this.card(t, by.get(t.id) || []));
  }

  async doneWeek({ includeOwner = true } = {}) {
    const since = isoLocal(new Date(this.bot.now().getTime() - 7 * 86400000), this.bot.s.timezone);
    return (await this.store.find("tasks", { status: "done", done_at: { $gte: since } }, { sort: { done_at: -1 } }))
      .filter((t) => includeOwner || t.owner !== this.d.owner.name);
  }

  stats(open, done) {
    return {
      open: open.length,
      attention: open.filter((t) => this.needsAttention(t)).length,
      stuck: open.filter((t) => t.status === "stuck").length,
      doneWeek: done.length,
    };
  }

  updated() {
    const iso = this.bot.nowIso();
    return `${fmtDayMon(iso)}, ${fmtTime(iso)}`;
  }

  // The five moments the bot acts, in clock order. Today's page and the
  // calendar both list them from here, so `what` is written as a whole sentence
  // a first-time reader understands, and `kind` is what code matches on.
  slots() {
    const s = this.bot.s;
    const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    return [
      { time: s.briefTime, kind: "brief",
        what: "You get your brief: yesterday's score, anything open a week or more, and who didn't reply" },
      // The later rounds say so, rather than repeating the first one's sentence.
      ...s.pendingTimes.split(",").map((t) => t.trim()).filter(Boolean).sort((a, b) => toMin(a) - toMin(b))
        .map((t, i) => ({ time: t, kind: "pending", what: i === 0
          ? "Everyone gets one list of what is still pending on them, and is asked where each one stands"
          : "The same list goes out again, to anyone who still has something open" })),
      { time: s.reviewTime, kind: "review",
        what: "You get today's overview: everything you assigned today, person by person" },
      { time: s.nudgeTime, kind: "nudge",
        what: "A reminder goes to anyone who owes an update today and hasn't given one" },
    ].map((x) => ({ ...x, min: toMin(x.time) })).sort((a, b) => a.min - b.min);
  }

  // The owner's navigation, the same on every screen he works in. `active` is
  // the row to mark — a tab name, "today" or "calendar".
  async nav(key, active) {
    const open = await this.bot.openTasks();
    const owner = this.d.owner.name;
    const att = (list) => list.filter((t) => this.needsAttention(t)).length;
    const tab = (t) => `/board/${key}?tab=${t}`;
    return [
      { items: [
        { href: "/", label: "Today", icon: "home", active: active === "today" },
        { href: "/calendar", label: "Calendar", icon: "calendar", active: active === "calendar" },
        { href: tab("attention"), label: "Needs attention", icon: "flag", active: active === "attention",
          count: att(open), countTitle: "tasks stuck or overdue" },
        { href: tab("mine"), label: "Mine", icon: "user", active: active === "mine",
          count: open.filter((t) => t.owner === owner).length, countTitle: "of your own tasks are open" },
        { href: tab("messages"), label: "Messages", icon: "inbox", active: active === "messages" },
        { href: tab("people"), label: "People", icon: "user", active: active === "people" },
      ] },
    ];
  }

  // The People screen. Everything on it answers one question — can I reach this person, and is
  // the bot asking them the right things — so each row carries the number, what the bot does
  // for them, how much is on them, and whether their WhatsApp window has ever opened.
  // `who` is the person whose edit panel is open.
  async peopleBoard(who = "") {
    const rows = await this.bot.team.rows();
    const inbound = new Map((await this.store.find("inbound", {})).map((r) => [r.phone, r.last_at]));
    const open = await this.bot.openTasks();
    const today = this.bot.today();
    const people = [];
    for (const r of rows) {
      const days = await this.bot.cfg.checkinDays(r.name);
      const paused = await this.bot.cfg.paused(r.name, today);
      people.push({
        name: r.name,
        phone: r.phone,
        aliases: (r.aliases || []).join(", "),
        reports: paused ? "paused" : days.length === 7 ? "every day" : !days.length
          ? "never" : days.map((d) => d[0].toUpperCase() + d.slice(1)).join(" "),
        paused,
        reminder: await this.bot.cfg.reminderOn(r.name),
        open: open.filter((t) => t.owner === r.name).length,
        lastIn: inbound.has(r.phone) ? fmtStamp(inbound.get(r.phone)) : null,
      });
    }
    const selected = people.find((p) => p.name === who) || null;
    return {
      kind: "master", tab: "people", title: "People", updated: this.updated(),
      people, selected,
      owner: { name: this.d.owner.name, phone: this.d.owner.phone },
      silent: people.filter((p) => !p.lastIn).length,
    };
  }

  async teamBoard() {
    const open = (await this.bot.openTasks()).filter((t) => t.owner !== this.d.owner.name);
    const done = await this.doneWeek({ includeOwner: false });
    const att = open.filter((t) => this.needsAttention(t));
    const attIds = new Set(att.map((t) => t.id));
    const byPerson = [];
    for (const name of [...new Set(open.map((t) => t.owner))].sort()) {
      const theirs = open.filter((t) => t.owner === name && !attIds.has(t.id));
      if (theirs.length) byPerson.push({ name, cards: await this.cards(theirs) });
    }
    return {
      kind: "team", title: "Team tasks", updated: this.updated(), stats: this.stats(open, done),
      attention: await this.cards(att), byPerson, done: await this.cards(done.slice(0, 20)),
    };
  }

  async masterBoard(tab = "attention", who = "", view = "") {
    const tabs = [["attention", "Needs attention"], ["mine", "Mine"], ["messages", "Messages"],
      ["people", "People"]];
    if (!tabs.some(([k]) => k === tab)) tab = "attention";
    const base = { kind: "master", tab, tabs, updated: this.updated() };
    const all = await this.bot.openTasks();
    const owner = this.d.owner.name;

    // This tab is also where every task lives: the same screen switches between
    // what needs chasing, everything still open, and everything finished.
    // `view` is the switch; it travels in the URL and back through the tick form.
    if (tab === "attention") {
      const onMe = [...all.filter((t) => t.status === "stuck" && t.stuck_on === "ankit"), ...all.filter((t) => t.owner === owner)];
      const onIds = new Set(onMe.map((t) => t.id));
      const att = all.filter((t) => this.needsAttention(t) && !onIds.has(t.id) && t.owner !== owner);
      const closedTotal = await this.store.count("tasks", { status: "done" });
      const counts = { attention: onMe.length + att.length, open: all.length, closed: closedTotal };
      const views = [["attention", "Needs attention"], ["open", "All open tasks"], ["closed", "Completed"]]
        .map(([k, label]) => [k, label, counts[k]]);
      if (!views.some(([k]) => k === view)) view = "attention";
      const head = { ...base, view, views, closedTotal, stats: this.stats(all, await this.doneWeek()) };

      if (view === "open") {
        return { ...head, title: "All open tasks",
          sections: [{ title: "Every open task, oldest first", empty: "Nothing is open.",
            cards: await this.cards(all, true) }] };
      }
      if (view === "closed") {
        // Newest first, and capped: the CSV export is the place for the whole history.
        const rows = await this.store.find("tasks", { status: "done" }, { sort: { done_at: -1 }, limit: CLOSED_LIMIT });
        return { ...head, title: "Completed tasks", more: Math.max(0, closedTotal - rows.length),
          sections: [{ title: "Every completed task, newest first", empty: "Nothing has been closed yet.",
            cards: await this.cards(rows, true) }] };
      }
      return { ...head, title: "Needs attention",
        sections: [
          { title: "Pending on you", empty: "Nothing.", cards: await this.cards(onMe, true) },
          { title: "Stuck or overdue – team", empty: "All moving.", cards: await this.cards(att, true) },
        ] };
    }
    if (tab === "mine") {
      const mine = all.filter((t) => t.owner === owner);
      const done = (await this.doneWeek()).filter((t) => t.owner === owner);
      const day = await this.bot.day(this.bot.today());
      return { ...base, title: "Your tasks", score: `Today: ${day.done.length} of ${day.done.length + day.open.length} done`,
        sections: [
          { title: "Open", empty: "All clear.", cards: await this.cards(mine, true) },
          { title: "Done in the last 7 days", empty: "Nothing yet.", cards: await this.cards(done.slice(0, 30), true) },
        ] };
    }
    if (tab === "people") return { ...base, ...(await this.peopleBoard(who)) };
    if (tab === "messages") {
      // Both halves of the conversation: `messages` is what the team sent,
      // `messages_out` is what the bot sent them. `~all` is the merged thread,
      // chosen explicitly, so that an empty `who` can mean "show me the list".
      const roster = this.d.people;
      const people = roster.map((x) => x.name);
      const everyone = who === "~all";
      if (!everyone && !people.includes(who)) who = "";
      const sel = everyone ? "" : who;
      const grab = (coll, q) => this.store.find(coll, q, { sort: { id: -1 }, limit: 150 });

      const recentIn = await grab("messages", {});
      const recentOut = await grab("messages_out", {});
      const latest = new Map();
      for (const r of [...recentIn.map((m) => ({ ...m, out: false })), ...recentOut.map((m) => ({ ...m, out: true }))]) {
        const cur = latest.get(r.person);
        if (!cur || r.created_at > cur.created_at) latest.set(r.person, r);
      }

      // Who still owes today's status: the rows the pending rounds wrote, with no row at all
      // meaning no list has gone out yet today.
      const sent = await this.store.find("checkins", { date: this.bot.today() });
      const chats = roster
        .map((p) => {
          const row = sent.find((x) => x.owner === p.name);
          const last = latest.get(p.name);
          return {
            name: p.name,
            state: !row ? "none" : row.replied ? "replied" : "waiting",
            at: last ? last.created_at : "",
            last: last
              ? { text: last.text, time: fmtTime(last.created_at), out: last.out, voice: last.kind === "voice" }
              : null,
          };
        })
        .sort((a, b) => (b.at || "").localeCompare(a.at || ""));

      // Asking the store for the chosen person's rows, rather than filtering the last 150 of
      // the whole team, or a busy week elsewhere would leave this thread looking empty.
      const inRows = sel ? await grab("messages", { person: sel }) : recentIn;
      const outRows = sel ? await grab("messages_out", { person: sel }) : recentOut;
      const merged = [
        ...inRows.map((m) => ({ at: m.created_at, person: m.person, text: m.text, voice: m.kind === "voice", out: false })),
        ...outRows.map((m) => ({ at: m.created_at, person: m.person, text: m.text, auto: Boolean(m.auto), out: true })),
      ].sort((a, b) => a.at.localeCompare(b.at));

      // Oldest first, newest at the foot, the way a chat reads.
      const thread = [];
      for (const m of merged) {
        const day = fmtWeekday(m.at);
        if (!thread.length || thread[thread.length - 1].day !== day) thread.push({ day, items: [] });
        thread[thread.length - 1].items.push({ ...m, time: fmtTime(m.at) });
      }

      // When the outgoing log begins. Anything older is one-sided because the
      // bot did not keep what it sent, and the thread says so rather than
      // looking broken.
      const firstOut = (await this.store.find("messages_out", {}, { sort: { id: 1 }, limit: 1 }))[0];
      const outFrom = firstOut ? fmtWeekday(firstOut.created_at) : null;
      const oldestShown = merged[0]?.at;
      const partial = !firstOut || (oldestShown && oldestShown < firstOut.created_at);

      return { ...base, title: sel || "Messages", people, who, selected: sel,
        hasSelection: everyone || Boolean(sel), chats, thread, outFrom, partial,
        checkinSent: sent.length > 0, listTime: this.bot.s.pendingTimes.split(",")[0].trim() };
    }
  }

  async act(id, action) {
    const row = await this.store.findOne("tasks", { id });
    if (!row) return;
    if (action === "done") await this.bot.setTask(id, { status: "done", done_at: this.bot.nowIso() });
  }

  async exportCsv() {
    const cols = ["id", "owner", "description", "status", "stuck_on", "note", "created_at", "done_at"];
    const q = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = await this.store.find("tasks", {}, { sort: { id: 1 } });
    return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n") + "\n";
  }
}

export { OPEN };
