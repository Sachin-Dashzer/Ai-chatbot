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
      id: t.id, description: t.description, owner: t.owner, business: t.business,
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
      const people = this.d.people.map((p) => p.name);
      if (!people.includes(who)) who = "";
      const rows = await this.store.find("messages", who ? { person: who } : {}, { sort: { id: -1 }, limit: 150 });
      const days = [];
      for (const r of rows) {
        const day = fmtWeekday(r.created_at);
        if (!days.length || days[days.length - 1].day !== day) days.push({ day, items: [] });
        days[days.length - 1].items.push({ time: fmtTime(r.created_at), person: r.person, voice: r.kind === "voice", text: r.text });
      }
      return { ...base, title: "Messages" + (who ? ` – ${who}` : ""), people, who, messageDays: days };
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
