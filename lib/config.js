import fs from "node:fs";
import yaml from "js-yaml";

export function loadSettings(env = process.env) {
  return {
    waToken: env.WA_TOKEN || "",
    waPhoneNumberId: env.WA_PHONE_NUMBER_ID || "",
    waWabaId: env.WA_WABA_ID || "",
    waVerifyToken: env.WA_VERIFY_TOKEN || "change-me",
    waAppSecret: env.WA_APP_SECRET || "",
    graphVersion: env.GRAPH_VERSION || "v23.0",
    templateLang: env.TEMPLATE_LANG || "en",
    firstTemplate: env.FIRST_TEMPLATE || "task_reminder",
    openaiApiKey: env.OPENAI_API_KEY || "",
    transcribeModel: env.TRANSCRIBE_MODEL || "whisper-1",
    openaiModel: env.OPENAI_MODEL || "gpt-4o-mini",
    mongoUri: env.MONGODB_URI || "",
    mongoDb: env.MONGODB_DB || "ankit_desk",
    store: env.STORE || (env.MONGODB_URI ? "mongo" : "memory"),
    peopleFile: env.PEOPLE_FILE || "people.yaml",
    timezone: env.TIMEZONE || "Asia/Kolkata",
    // The two pending-list rounds. BATCH_TIMES is the old name for the same slots, still read
    // so an existing deployment's variables keep working.
    pendingTimes: env.PENDING_TIMES || env.BATCH_TIMES || "12:00,16:00",
    // Ankit's end-of-day review. CHECKIN_TIME is the old name for the same slot, when it was
    // also the team's status round; that round is now part of the pending list.
    reviewTime: env.REVIEW_TIME || env.CHECKIN_TIME || "18:00",
    nudgeTime: env.NUDGE_TIME || "18:00",
    briefTime: env.BRIEF_TIME || "19:00",
    workDays: env.WORK_DAYS || "mon-sat",
    baseUrl: env.BASE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + env.VERCEL_PROJECT_PRODUCTION_URL : ""),
  };
}

export class Directory {
  // data = parsed people.yaml: { owner: {name, phone, aliases}, businesses: [...], people: [...] }
  constructor(data) {
    const a = data.owner;
    this.owner = { name: a.name, phone: String(a.phone), business: "Personal", aliases: a.aliases || [] };
    // Unknown senders are ignored by design, so a placeholder here looks exactly like a dead bot.
    if (!/^[0-9]{10,15}$/.test(this.owner.phone)) {
      console.error("[ankit-desk] owner phone in people.yaml is not a plain number (\"" + this.owner.phone +
        "\") - every command Ankit sends will be ignored and he will get no brief.");
    }
    // The list of businesses is the file's to decide: board links, tabs and the navigation are
    // built from it. Who is in them is the store's, once Team has seeded it from here.
    this._fixed = data.businesses || null;
    this.seedPeople = (data.people || []).map((p) => ({
      name: p.name, phone: String(p.phone), business: p.business, aliases: p.aliases || [],
      reminder: p.reminder, checkin_days: p.checkin_days,
    }));
    this.setPeople(this.seedPeople);
  }

  // Replaces the team, in place, from people.yaml at boot and from the store on every entry
  // point after that. Everything downstream reads this.people / byName / byPhone, so a row
  // added in the browser is live for the next WhatsApp message without a restart.
  setPeople(rows) {
    this.people = rows.map((p) => ({
      name: p.name, phone: String(p.phone), business: p.business, aliases: p.aliases || [],
    }));
    this.businesses = this._fixed || [...new Set(this.people.map((p) => p.business))].sort();
    this.defaults = Object.fromEntries(rows.map((p) => [p.name, {
      ...(p.reminder !== undefined && p.reminder !== null ? { reminder: p.reminder } : {}),
      ...(p.checkin_days ? { checkin_days: p.checkin_days } : {}),
    }]));
  }

  static fromFile(path) {
    return new Directory(yaml.load(fs.readFileSync(path, "utf8")));
  }

  byPhone(phone) {
    phone = String(phone);
    if (phone === this.owner.phone) return this.owner;
    return this.people.find((p) => p.phone === phone) || null;
  }

  byName(name) {
    if (!name) return null;
    const n = String(name).trim().toLowerCase();
    const ownerNames = ["me", "ankit", "myself", "self", this.owner.name.toLowerCase(),
      ...this.owner.aliases.map((x) => x.toLowerCase())];
    if (ownerNames.includes(n)) return this.owner;
    return this.people.find((p) => p.name.toLowerCase() === n || p.aliases.map((x) => x.toLowerCase()).includes(n)) || null;
  }

  isOwner(phone) {
    return String(phone) === this.owner.phone;
  }
}
