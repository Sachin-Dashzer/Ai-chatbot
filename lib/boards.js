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
  needsAttention(t) {
    if (t.status === "stuck") return true;
    const d = daysBetween(t.created_at.slice(0, 10), this.bot.today());
    return (t.priority === "urgent" && d >= 1) || d >= RED_DAYS;
  }

  async card(t, withRemarks) {
    const days = daysBetween(t.created_at.slice(0, 10), this.bot.today());
    const c = {
      id: t.id, description: t.description, owner: t.owner, business: t.business, days,
      p1: t.priority === "urgent", status: t.status, stuckOn: t.stuck_on, note: t.note,
      ageText: days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`,
      ageLevel: days >= RED_DAYS ? "red" : days >= AMBER_DAYS ? "amber" : "",
      doneOn: t.done_at ? fmtDayMon(t.done_at) : null,
      attention: t.status !== "done" && this.needsAttention(t),
      isMine: t.owner === this.d.owner.name,
      remarks: [],
    };
    if (withRemarks) {
      c.remarks = (await this.store.find("task_notes", { task_id: t.id }, { sort: { id: -1 }, limit: 20 }))
        .map((n) => ({ when: fmtStamp(n.created_at), person: n.person, status: n.status, text: n.text }));
    }
    return c;
  }

  async cards(tasks, withRemarks = false) {
    const out = [];
    for (const t of tasks) out.push(await this.card(t, withRemarks));
    return out;
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
      p1: open.filter((t) => t.priority === "urgent").length,
      doneWeek: done.length,
    };
  }

  updated() {
    const iso = this.bot.nowIso();
    return `${fmtDayMon(iso)}, ${fmtTime(iso)}`;
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

  async masterBoard(tab = "attention", who = "") {
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
      const people = this.d.people.map((p) => p.name);
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

      // Who still owes today's status: the check-in rows the 6 PM job wrote,
      // with no row at all meaning no check-in has gone out yet.
      const sent = await this.store.find("checkins", { date: this.bot.today() });
      const chats = this.d.people
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
        checkinSent: sent.length > 0, checkinTime: this.bot.s.checkinTime };
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
    else if (action === "p1" || action === "p2") await this.bot.setTask(id, { priority: action === "p1" ? "urgent" : "normal" });
  }

  async exportCsv() {
    const cols = ["id", "business", "owner", "description", "priority", "status", "stuck_on", "note", "created_at", "done_at"];
    const q = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = await this.store.find("tasks", {}, { sort: { id: 1 } });
    return [cols.join(","), ...rows.map((r) => cols.map((c) => q(c === "priority" ? (r[c] === "urgent" ? "P1" : "P2") : r[c])).join(","))].join("\n") + "\n";
  }
}

export { OPEN };
