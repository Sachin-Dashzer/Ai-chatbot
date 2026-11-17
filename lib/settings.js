
import { addDays, weekdayOf } from "./time.js";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_ALIASES = { monday: "mon", tuesday: "tue", tues: "tue", wednesday: "wed", thursday: "thu",
  thur: "thu", thurs: "thu", friday: "fri", saturday: "sat", sunday: "sun" };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
const fmt = (ymd) => `${+ymd.slice(8, 10)} ${MONTHS[+ymd.slice(5, 7) - 1][0].toUpperCase()}${MONTHS[+ymd.slice(5, 7) - 1].slice(1)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class Settings {
  constructor(store, directory) {
    this.store = store;
    this.d = directory;
    this.defaults = directory.defaults || {};
  }

  async _row(name) {
    return this.store.findOne("person_settings", { name });
  }

  async reminderOn(name) {
    const r = await this._row(name);
    if (r && r.reminder != null) return !!r.reminder;
    return this.defaults[name]?.reminder ?? true;
  }

  async checkinDays(name) {
    const r = await this._row(name);
    if (r && r.checkin_days != null) return r.checkin_days;
    const d = this.defaults[name]?.checkin_days;
    return d ? d.map((x) => String(x).toLowerCase().slice(0, 3)) : [...DAYS];
  }

  async checkinToday(name, today) {
    return (await this.checkinDays(name)).includes(weekdayOf(today));
  }

  async paused(name, today) {
    const r = await this._row(name);
    if (!r || !r.pause_from) return false;
    return r.pause_from <= today && today <= r.pause_to;
  }

  async describe(name, today) {
    const days = await this.checkinDays(name);
    const dtxt = days.length === 7 ? "daily" : !days.length ? "off" : days.map((d) => d[0].toUpperCase() + d.slice(1)).join(" ");
    let txt = `${name}: check-in ${dtxt} · reminder ${(await this.reminderOn(name)) ? "on" : "off"}`;
    const r = await this._row(name);
    if (r && r.pause_to && r.pause_to >= today) {
      txt += ` · paused ${fmt(r.pause_from)}` + (r.pause_to !== r.pause_from ? `–${fmt(r.pause_to)}` : "");
    }
    return txt;
  }

  _findPerson(text) {
    const low = text.toLowerCase();
    for (const p of [...this.d.people].sort((a, b) => b.name.length - a.name.length)) {
      for (const n of [p.name, ...p.aliases]) {
        if (new RegExp(`\\b${esc(n.toLowerCase())}\\b`).test(low)) return p;
      }
    }
    return null;
  }

  // Returns a reply string if `text` is a settings command, else null.
  async handle(text, today) {
    const t = text.toLowerCase().trim();
    const words = t.match(/[a-z0-9]+/g) || [];
    if (!words.length) return null;
    if ((words[0] === "settings" || words[0] === "setting") && words.length === 1) {
      const lines = [];
      for (const p of this.d.people) lines.push(await this.describe(p.name, today));
      return "*Settings*\n" + lines.join("\n");
    }
    if (words[0] === "check" && (words.length < 2 || words[1] !== "in")) return null; // "check GST for EPC" is a task
    if ((words[0] === "reminder" || words[0] === "reminders") &&
      !((words.includes("on") || words.includes("off")) && words.length <= 5)) return null;
    if (!["reminder", "reminders", "checkin", "check", "pause", "resume"].includes(words[0]) || words.length > 8) return null;
    const person = this._findPerson(text);
    if (!person) return null; // no team member named -> it's a normal task message
    const name = person.name;
    const rest = words[0] === "check" ? words.slice(2) : words.slice(1);
    if (words[0].startsWith("reminder")) {
      if (rest.some((w) => ["off", "no", "stop"].includes(w))) await this.store.upsert("person_settings", { name }, { reminder: 0 });
      else if (rest.some((w) => ["on", "yes"].includes(w))) await this.store.upsert("person_settings", { name }, { reminder: 1 });
      else return 'Say "reminder off Narendra" or "reminder on Narendra".';
    } else if (words[0] === "checkin" || words[0] === "check") {
      let days;
      if (rest.some((w) => ["daily", "everyday", "all"].includes(w))) days = [...DAYS];
      else if (rest.some((w) => ["off", "none", "never"].includes(w))) days = [];
      else {
        const picked = rest.map((w) => (DAY_ALIASES[w] || w).slice(0, 3)).filter((w) => DAYS.includes(w));
        days = DAYS.filter((d) => picked.includes(d));
        if (!days.length) {
          return (await this.describe(name, today)) +
            '\nTo change: "checkin Narendra mon thu", "checkin Narendra daily" or "checkin Narendra off".';
        }
      }
      await this.store.upsert("person_settings", { name }, { checkin_days: days });
    } else if (words[0] === "resume") {
      await this.store.upsert("person_settings", { name }, { pause_from: null, pause_to: null });
    } else {
      const [a, b] = parseRange(t, today) || [today, today];
      await this.store.upsert("person_settings", { name }, { pause_from: a, pause_to: b });
    }
    return "✅ " + (await this.describe(name, today)) +
      (words[0] === "pause" ? "\nOnly P1 tasks will reach them while paused; everything else is held and goes out after." : "");
  }
}

export function parseDate(s, today) {
  s = s.trim();
  if (s === "today" || s === "aaj") return today;
  if (s === "tomorrow" || s === "kal") return addDays(today, 1);
  const wdNow = DAYS.indexOf(weekdayOf(today));
  for (const [wd, code] of [...Object.entries(DAY_ALIASES), ...DAYS.map((d) => [d, d])]) {
    if (s === wd) return addDays(today, (DAYS.indexOf(code) - wdNow + 7) % 7);
  }
  let m = s.match(/^(\d{1,2})\s*(?:st|nd|rd|th)?\s*([a-z]{3})/);
  if (m && MONTHS.includes(m[2])) {
    let y = +today.slice(0, 4);
    let d = `${y}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(+m[1])}`;
    if (d < addDays(today, -1)) d = `${y + 1}${d.slice(4)}`;
    return d;
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (m) {
    let y = m[3] ? +m[3] : +today.slice(0, 4);
    if (y < 100) y += 2000;
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  return null;
}

export function parseRange(t, today) {
  let m = t.match(/\b(?:till|until|upto|up to|tak)\b\s+(.+)$/);
  if (m) {
    const end = parseDate(m[1], today);
    return end && end >= today ? [today, end] : null;
  }
  const D = "(\\d{1,2}\\s*[a-z]{3}|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?)";
  m = t.match(new RegExp(`${D}\\s*(?:to|-|–)\\s*${D}`));
  if (m) {
    const a = parseDate(m[1], today), b = parseDate(m[2], today);
    return a && b && b >= a ? [a, b] : null;
  }
  const tokens = t.match(/today|aaj|tomorrow|kal|\d{1,2}\s*(?:st|nd|rd|th)?\s*[a-z]{3}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|monday|tuesday|wednesday|thursday|friday|saturday|sunday/g) || [];
  for (const tok of tokens) {
    const d = parseDate(tok, today);
    if (d) return [d, d];
  }
  return null;
}
