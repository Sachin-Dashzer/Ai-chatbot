import crypto from "node:crypto";
import { daysBetween, fmtDayMon, fmtStamp, fmtWeekday, fmtTime, isoLocal } from "./time.js";

export const MASTER = "__master__";
const AMBER_DAYS = 3, RED_DAYS = 7;
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
    return row ? row.scope : null;
  }

  teamBusinesses() {
    return this.d.businesses.filter((b) => b !== "Personal");
  }

  async linksText(baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    const lines = ["*Board links* (private – share each only with that team)", "",
      `Master (only you): ${base}/board/${await this.keyFor(MASTER)}`, ""];
    for (const b of this.teamBusinesses()) {
      const people = this.d.people.filter((p) => p.business === b).map((p) => p.name).join(", ") || "—";
      lines.push(`${b} → ${people}\n${base}/board/${await this.keyFor(b)}`);
    }
    lines.push("", "If a link reaches the wrong person: send *newlink EPC* (or *newlink master*) – the old link stops working.");
    return lines.join("\n");
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
      id: t.id, description: t.description, owner: t.owner, business: t.business, days,
      status: t.status, stuckOn: t.stuck_on, note: t.note,
      ageText: days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`,
      ageLevel: days >= RED_DAYS ? "red" : days >= AMBER_DAYS ? "amber" : "",
      doneOn: t.done_at ? fmtDayMon(t.done_at) : null,
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

  async doneWeek({ business, includeOwner = true } = {}) {
    const since = isoLocal(new Date(this.bot.now().getTime() - 7 * 86400000), this.bot.s.timezone);
    return (await this.store.find("tasks", { status: "done", done_at: { $gte: since } }, { sort: { done_at: -1 } }))
      .filter((t) => (!business || t.business === business) && (includeOwner || t.owner !== this.d.owner.name));
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

  // The five moments the bot acts, in clock order. Today's page draws them on
  // an axis, the calendar lists them per day; both read them from here.
  slots() {
    const s = this.bot.s;
    const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
    return [
      { time: s.briefTime, what: "your brief" },
      ...s.pendingTimes.split(",").map((t) => t.trim()).filter(Boolean).map((t) => ({ time: t, what: "pending lists go out" })),
      { time: s.reviewTime, what: "your overview" },
      { time: s.nudgeTime, what: "reminder" },
    ].map((x) => ({ ...x, min: toMin(x.time) })).sort((a, b) => a.min - b.min);
  }

  // The owner's navigation, the same on every screen he works in: the views,
  // then one row per business carrying the number of its tasks that need
  // attention. `active` is the row to mark — a tab name, "today" or "calendar".
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
      ] },
      { label: "Businesses", items: this.teamBusinesses().map((b) => ({
        href: tab(b.toLowerCase()), label: b, active: active === b.toLowerCase(),
        count: att(open.filter((t) => t.business === b)), countTitle: `tasks needing attention in ${b}` })) },
    ];
  }

  async teamBoard(business) {
    const open = (await this.bot.openTasks()).filter((t) => t.business === business && t.owner !== this.d.owner.name);
    const done = await this.doneWeek({ business, includeOwner: false });
    const att = open.filter((t) => this.needsAttention(t));
    const attIds = new Set(att.map((t) => t.id));
    const people = this.d.people.filter((p) => p.business === business).map((p) => p.name);
    const owners = [...new Set(open.map((t) => t.owner))].sort((a, b) => (people.includes(a) ? 0 : 1) - (people.includes(b) ? 0 : 1) || a.localeCompare(b));
    const groups = [];
    for (const name of owners) {
      const mine = open.filter((t) => t.owner === name && !attIds.has(t.id));
      if (mine.length) groups.push({ name, cards: await this.cards(mine) });
    }
    return {
      kind: "team", title: `${business} – tasks`, updated: this.updated(), stats: this.stats(open, done),
      attention: await this.cards(att), groups, done: await this.cards(done.slice(0, 20)),
    };
  }

  async masterBoard(tab = "attention", who = "", group = "") {
    const tabs = [["attention", "Needs attention"], ["mine", "Mine"], ["messages", "Messages"],
      ...this.teamBusinesses().map((b) => [b.toLowerCase(), b])];
    if (!tabs.some(([k]) => k === tab)) tab = "attention";
    const base = { kind: "master", tab, tabs, updated: this.updated() };
    const all = await this.bot.openTasks();
    const owner = this.d.owner.name;

    if (tab === "attention") {
      const onMe = [...all.filter((t) => t.status === "stuck" && t.stuck_on === "ankit"), ...all.filter((t) => t.owner === owner)];
      const onIds = new Set(onMe.map((t) => t.id));
      const att = all.filter((t) => this.needsAttention(t) && !onIds.has(t.id) && t.owner !== owner);
      return { ...base, title: "Needs attention", stats: this.stats(all, await this.doneWeek()),
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
    if (tab === "messages") {
      // Both halves of the conversation: `messages` is what the team sent,
      // `messages_out` is what the bot sent them. `~all` is the merged thread,
      // chosen explicitly, so that an empty `who` can mean "show me the list".
      //
      // `group` narrows the screen to one business: its people are the only chats listed,
      // and the merged thread holds only them. A person chosen in one group stays chosen
      // only while they belong to it, so switching group never leaves a foreign thread open.
      const groups = this.teamBusinesses().filter((b) => this.d.people.some((x) => x.business === b));
      if (!groups.includes(group)) group = "";
      const roster = group ? this.d.people.filter((x) => x.business === group) : this.d.people;
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
            business: p.business,
            state: !row ? "none" : row.replied ? "replied" : "waiting",
            at: last ? last.created_at : "",
            last: last
              ? { text: last.text, time: fmtTime(last.created_at), out: last.out, voice: last.kind === "voice" }
              : null,
          };
        })
        .sort((a, b) => (b.at || "").localeCompare(a.at || ""));

      // Asking the store for the group's people, rather than filtering the last 150 rows of
      // the whole team, or a busy week elsewhere would leave this thread looking empty.
      const q = sel ? { person: sel } : group ? { person: { $in: people } } : {};
      const inRows = sel || group ? await grab("messages", q) : recentIn;
      const outRows = sel || group ? await grab("messages_out", q) : recentOut;
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

      return { ...base, title: sel || (group ? `${group} – messages` : "Messages"), people, who, selected: sel,
        group, groups, hasSelection: everyone || Boolean(sel), chats, thread, outFrom, partial,
        checkinSent: sent.length > 0, listTime: this.bot.s.pendingTimes.split(",")[0].trim() };
    }
    const business = tabs.find(([k]) => k === tab)[1];
    const open = all.filter((t) => t.business === business);
    const done = await this.doneWeek({ business });
    const sections = [];
    for (const name of [...new Set(open.map((t) => t.owner))].sort()) {
      const mine = open.filter((t) => t.owner === name);
      sections.push({ title: name === owner ? "You" : name, empty: "", cards: await this.cards(mine, true) });
    }
    if (!open.length) sections.push({ title: "Open", empty: "No open tasks.", cards: [] });
    sections.push({ title: "Done in the last 7 days", empty: "Nothing yet.", cards: await this.cards(done.slice(0, 20), true) });
    return { ...base, title: business, stats: this.stats(open, done), sections };
  }

  async act(id, action) {
    const row = await this.store.findOne("tasks", { id });
    if (!row) return;
    if (action === "done") await this.bot.setTask(id, { status: "done", done_at: this.bot.nowIso() });
  }

  async exportCsv() {
    const cols = ["id", "business", "owner", "description", "status", "stuck_on", "note", "created_at", "done_at"];
    const q = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = await this.store.find("tasks", {}, { sort: { id: 1 } });
    return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n") + "\n";
  }
}

export { OPEN };
