// The team list, kept in the store instead of only in people.yaml, so Ankit can add someone
// from WhatsApp or from the board and reach them in the next minute instead of the next deploy.
//
// people.yaml is still the seed: the first time this runs against an empty database it copies
// the file in, and from then on the store is the truth. The file stays the record of the owner
// (his own number is never editable from a phone or a browser - locking himself out of his own
// bot is the one mistake there is no way back from).
//
// Removing someone is a soft remove: `active: 0`. Their messages, their closed tasks and the
// remarks they wrote stay exactly where they are, their name still reads correctly on every
// board, and nothing new reaches them.

const DIGITS = /\d+/g;
const MAX_NAME = 40;

// Words that are already something else in the chat. A person called "Status" or "All" would
// quietly eat a command, and `Settings._findPerson` matches a name anywhere in a sentence, so
// one called "Check" or "Pause" would eat half of them.
export const RESERVED = new Set([
  "add", "edit", "change", "remove", "delete", "people", "team", "all", "me", "my", "myself",
  "self", "mine", "help", "brief", "summary", "pending", "today", "overview", "status", "list",
  "open", "tasks", "task", "done", "cancel", "reopen", "move", "assign", "msgs", "messages",
  "boards", "board", "links", "newlink", "start", "settings", "setting", "reminder", "reminders",
  "checkin", "check", "in", "pause", "resume", "p1", "p2", "working", "stuck", "new", "yes", "no",
  "on", "off", "hi", "hello", "ok", "phone", "number", "name", "alias", "aliases",
]);

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const lower = (s) => clean(s).toLowerCase();
const splitAliases = (s) =>
  String(s ?? "").split(/[,/|]/).map(clean).filter(Boolean).slice(0, 5);

export class Team {
  constructor(bot) {
    this.bot = bot;
    this.store = bot.store;
    this.d = bot.d;
  }

  // ---------- the store side ----------
  // Read the list and hand it to the Directory. Called at every entry point (an inbound
  // message, each scheduled job, each page) rather than once at boot: on a serverless host
  // every request may be a fresh process, and on any host a change made in the browser has to
  // reach the one that answers WhatsApp. The TTL keeps a single page render, which touches the
  // directory dozens of times, down to one query.
  async sync(force = false) {
    const now = this.bot.now().getTime();
    if (!force && this._at && now - this._at < 5000) return this.d;
    const rows = await this.store.find("people", { active: { $ne: 0 } }, { sort: { id: 1 } });
    if (!rows.length && !(await this.store.findOne("meta", { key: "people_seeded" }))) {
      await this.seed();
      return this.sync(true);
    }
    if (!(await this.store.findOne("meta", { key: "does_backfilled" }))) {
      await this.backfillDoes(rows);
      return this.sync(true);
    }
    this._at = now;
    this.d.setPeople(rows);
    return this.d;
  }

  // `does` arrived after this database was seeded, so the rows in it have none and the
  // router would have nothing to reason from. Copy the seed's beats onto the rows that are
  // still blank, once. It never overwrites a beat already in the store: the store is the
  // truth, and whatever Ankit has edited in the browser or over WhatsApp wins.
  async backfillDoes(rows) {
    const seed = new Map(this.d.seedPeople.map((p) => [lower(p.name), p.does || ""]));
    let n = 0;
    for (const r of rows) {
      if ((r.does || "").trim()) continue;
      const from = seed.get(lower(r.name));
      if (!from) continue;
      await this.store.update("people", { id: r.id }, { does: from });
      n++;
    }
    await this.store.upsert("meta", { key: "does_backfilled" }, { at: this.bot.nowIso(), count: n });
    if (n) console.log(`[ankit-desk] filled in what ${n} ${n === 1 ? "person" : "people"} handle, from people.yaml`);
  }

  // people.yaml, copied in once. Marked in `meta` so that removing the last person is not read
  // as "the database is new" and undone by the next sync.
  async seed() {
    for (const p of this.d.seedPeople) {
      await this.store.insert("people", {
        name: p.name, phone: p.phone, aliases: p.aliases || [], does: p.does || "", active: 1,
        ...(this.d.defaults[p.name]?.checkin_days ? { checkin_days: this.d.defaults[p.name].checkin_days } : {}),
        ...(this.d.defaults[p.name]?.reminder !== undefined ? { reminder: this.d.defaults[p.name].reminder } : {}),
      });
    }
    await this.store.upsert("meta", { key: "people_seeded" }, { at: this.bot.nowIso() });
    console.log(`[ankit-desk] seeded ${this.d.seedPeople.length} people from people.yaml into the store`);
  }

  async rows() {
    await this.sync();
    return this.store.find("people", { active: { $ne: 0 } }, { sort: { id: 1 } });
  }

  // ---------- validation ----------
  // At a trust boundary: a bad number here is a message that silently never arrives, and a
  // name that collides with a command is a command that silently never runs.
  phone(input) {
    const digits = (String(input ?? "").match(DIGITS) || []).join("");
    if (!digits) return { error: "That is not a phone number. Digits only, with the country code, e.g. 919812345678." };
    const own = this.d.owner.phone;
    // A ten-digit number is the local way of writing it; borrow the owner's country code
    // rather than making him type his own every time.
    const cc = own.length > 10 ? own.slice(0, own.length - 10) : "";
    const full = digits.length === 10 && cc ? cc + digits : digits;
    if (full.length < 10 || full.length > 15) {
      return { error: `"${digits}" is ${digits.length} digits. A WhatsApp number is 10 to 15, with the country code, e.g. 919812345678.` };
    }
    if (full === own) return { error: "That is your own number. You are the owner, not a team member." };
    return { value: full };
  }

  async name(input, { allow } = {}) {
    const name = clean(input);
    if (!name) return { error: "Give the person's name." };
    if (name.length > MAX_NAME) return { error: `That name is ${name.length} characters. Keep it under ${MAX_NAME}.` };
    if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(name)) return { error: `"${name}" has characters a name does not. Letters, spaces, dots and hyphens only.` };
    if (/^\d+$/.test(name)) return { error: "A name cannot be a number." };
    const l = lower(name);
    if (RESERVED.has(l)) return { error: `"${name}" is a word the bot already uses as a command. Pick another, or add a surname.` };
    if (lower(this.d.owner.name) === l || this.d.owner.aliases.some((a) => lower(a) === l)) {
      return { error: `"${name}" is you.` };
    }
    for (const r of await this.store.find("people", {})) {
      if (allow && lower(r.name) === lower(allow)) continue;
      if (lower(r.name) === l || (r.aliases || []).some((a) => lower(a) === l)) {
        return { error: `"${name}" is already ${r.active === 0 ? "on the list (removed earlier)" : "on the list"} as ${r.name}.` };
      }
    }
    return { value: name };
  }

  async aliases(input, forName) {
    const list = splitAliases(input);
    for (const a of list) {
      const check = await this.name(a, { allow: forName });
      if (check.error) return { error: `Alias ${check.error}` };
    }
    return { value: list };
  }

  // ---------- the four operations ----------
  // Each returns { ok: "message" } or { error: "message" }, so the board route and the
  // WhatsApp command can share every rule between them and differ only in how they print it.
  async add({ name, phone, aliases = "", does = "" }) {
    await this.sync(true);
    const n = await this.name(name);
    if (n.error) return { error: n.error };
    const p = this.phone(phone);
    if (p.error) return { error: p.error };
    const a = await this.aliases(aliases, name);
    if (a.error) return { error: a.error };
    const clash = await this.store.findOne("people", { phone: p.value });
    if (clash) {
      return clash.active === 0
        ? { error: `${p.value} is ${clash.name}, who was removed. Add them back with: add ${clash.name} ${p.value}` }
        : { error: `${p.value} is already ${clash.name}'s number.` };
    }
    await this.store.insert("people", {
      name: n.value, phone: p.value, aliases: a.value, does: clean(does).slice(0, 300), active: 1,
    });
    await this.sync(true);
    return { ok: `✅ *${n.value}* added · ${p.value}\nThey get every task from now on. Send *start ${n.value}* to open their WhatsApp window before the first one, or just assign a task and the bot does it.` };
  }

  // A removed person who is added again keeps their id, and with it their history.
  async restore(row, { phone }) {
    const set = { active: 1 };
    if (phone) {
      const p = this.phone(phone);
      if (p.error) return { error: p.error };
      set.phone = p.value;
    }
    await this.store.update("people", { id: row.id }, set);
    await this.sync(true);
    return { ok: `✅ *${row.name}* is back on the list · ${set.phone || row.phone}` };
  }

  async edit(who, field, value) {
    await this.sync(true);
    const row = await this.find(who);
    if (!row) return { error: `Don't know '${clean(who)}'. Send *people* for the list.` };
    const f = lower(field);
    if (["phone", "number", "no", "mobile"].includes(f)) {
      const p = this.phone(value);
      if (p.error) return { error: p.error };
      const clash = await this.store.findOne("people", { phone: p.value });
      if (clash && clash.id !== row.id) return { error: `${p.value} is already ${clash.name}'s number.` };
      await this.store.update("people", { id: row.id }, { phone: p.value });
      // The window is per number, so a new number has never messaged the bot: anything held
      // for the old one would be sent to a stranger.
      await this.store.remove("pending_msgs", { phone: row.phone });
      await this.store.remove("template_log", { phone: row.phone });
      await this.sync(true);
      return { ok: `✅ *${row.name}* is now ${p.value}.\nThe new number has never messaged the bot, so send *start ${row.name}* to open its window.` };
    }
    if (["name"].includes(f)) {
      const n = await this.name(value, { allow: row.name });
      if (n.error) return { error: n.error };
      // Everything that points at a person points at their name, so the rename has to carry.
      for (const [coll, key] of [["tasks", "owner"], ["messages", "person"], ["messages_out", "person"],
        ["task_notes", "person"], ["notes", "owner"], ["checkins", "owner"], ["checkin_items", "owner"],
        ["person_settings", "name"], ["awaiting_remark", "person"]]) {
        await this.store.update(coll, { [key]: row.name }, { [key]: n.value });
      }
      await this.store.update("people", { id: row.id }, { name: n.value });
      await this.sync(true);
      return { ok: `✅ *${row.name}* is now *${n.value}* — on every task, message and remark too.` };
    }
    // What they handle. Blank is a real answer and means "never route a task here by
    // guess", so it is allowed and says so.
    if (["does", "handles", "work", "role", "beat"].includes(f)) {
      const v = clean(value).slice(0, 300);
      await this.store.update("people", { id: row.id }, { does: v });
      await this.sync(true);
      return { ok: v
        ? `✅ *${row.name}* handles: ${v}\nTasks about this reach them even when you don't name anyone.`
        : `✅ *${row.name}* has no work areas set. A task with no name on it will never be guessed onto them.` };
    }
    if (["alias", "aliases", "nickname", "nicknames"].includes(f)) {
      const a = await this.aliases(value, row.name);
      if (a.error) return { error: a.error };
      await this.store.update("people", { id: row.id }, { aliases: a.value });
      await this.sync(true);
      return { ok: a.value.length
        ? `✅ *${row.name}* also answers to: ${a.value.join(", ")}`
        : `✅ *${row.name}* has no other names now.` };
    }
    return { error: `Say what to change: *edit ${row.name} phone 919...* · *name Rahul* · *alias CA Rahul, Rahul ji*` };
  }

  // The board's edit form sends all four fields at once. It applies them through edit() one at a
  // time rather than writing the row itself, so the browser and the chat cannot drift apart on a
  // single rule. The rename goes last: the three before it find the person by their current name.
  async save(who, fields) {
    await this.sync(true);
    const row = await this.find(who);
    if (!row) return { error: `Don't know '${clean(who)}'.` };
    const current = {
      phone: row.phone, alias: (row.aliases || []).join(", "), does: row.does || "", name: row.name,
    };
    const want = ["phone", "alias", "does", "name"]
      .filter((f) => fields[f] != null && clean(fields[f]) !== clean(current[f]));
    if (!want.length) return { ok: `Nothing to change — ${row.name} is already as you have it.` };

    // Every field is checked before any of them is written. Otherwise a form whose last field is
    // wrong would still have saved the three before it, and the screen would show a person
    // half-changed with an error above them.
    for (const f of want) {
      const v = fields[f];
      const check = f === "phone" ? this.phone(v)
        : f === "alias" ? await this.aliases(v, row.name)
          : f === "does" ? { value: clean(v).slice(0, 300) }
            : await this.name(v, { allow: row.name });
      if (check.error) return { error: check.error };
      if (f === "phone") {
        const clash = await this.store.findOne("people", { phone: check.value });
        if (clash && clash.id !== row.id) return { error: `${check.value} is already ${clash.name}'s number.` };
      }
    }

    const changed = [];
    for (const f of want) {
      const r = await this.edit(row.name, f, fields[f]);
      if (r.error) return { error: r.error, done: changed };
      changed.push(f === "alias" ? "other names" : f === "does" ? "what they handle" : f);
    }
    const name = clean(fields.name) || row.name;
    return { ok: `✅ Saved ${changed.join(" and ")} for *${name}*.` };
  }

  async remove(who) {
    await this.sync(true);
    const row = await this.find(who);
    if (!row) return { error: `Don't know '${clean(who)}'. Send *people* for the list.` };
    const open = await this.store.find("tasks", { owner: row.name, status: { $nin: ["done", "cancelled"] } }, { sort: { id: 1 } });
    if (open.length) {
      // Refusing beats orphaning: a task with nobody on it is still on every board, and
      // nobody is ever asked about it again.
      return { error: `*${row.name}* still has ${open.length} open task${open.length === 1 ? "" : "s"}: ` +
        open.map((t) => `#${t.id}`).join(" ") +
        `\nClose them (*done ${open[0].id}*) or hand them over (*assign ${open[0].id} <name>*) first.` };
    }
    await this.store.update("people", { id: row.id }, { active: 0 });
    await this.store.remove("pending_msgs", { phone: row.phone });
    await this.store.remove("template_log", { phone: row.phone });
    await this.sync(true);
    return { ok: `✅ *${row.name}* removed. Nothing more will reach them.\nEverything they did stays on the boards. Add them back any time with: add ${row.name} ${row.phone}` };
  }

  // By name or by any alias, on the stored rows rather than the Directory, so a removed
  // person can still be found and put back.
  async find(who) {
    const l = lower(who);
    if (!l) return null;
    const rows = await this.store.find("people", {});
    return rows.find((r) => lower(r.name) === l) ||
      rows.find((r) => (r.aliases || []).some((a) => lower(a) === l)) || null;
  }

  // ---------- what Ankit sees ----------
  async listText() {
    const rows = await this.rows();
    if (!rows.length) return "*Team (0)*\nNobody on the list yet. Add one: *add Rahul 919812345678*";
    const inbound = new Set((await this.store.find("inbound", {})).map((r) => r.phone));
    const L = [`*Team (${rows.length})*`, ""];
    for (const r of rows) {
      const extra = [];
      if ((r.aliases || []).length) extra.push(`also: ${r.aliases.join(", ")}`);
      if (!inbound.has(r.phone)) extra.push(`⚠️ never messaged the bot – send *start ${r.name}*`);
      L.push(`• *${r.name}* · ${r.phone}` + (extra.length ? `\n   ${extra.join(" · ")}` : ""));
    }
    L.push("", "*add Rahul 919812345678* – add someone",
      "*edit Rahul phone 919...* / *name Rahul Verma* / *alias CA Rahul*",
      "*remove Rahul* – stop everything reaching them");
    return L.join("\n");
  }

  // Returns a reply string if `text` is a team command, else null — the same contract as
  // Settings.handle, so bot.ownerCommand treats them alike.
  async handle(text) {
    const words = clean(text).split(" ").filter(Boolean);
    if (!words.length) return null;
    const verb = lower(words[0]);
    const rest = words.slice(1);

    if (["people", "team", "staff"].includes(verb) && !rest.length) return this.listText();

    if (verb === "add") {
      // add <Name...> <phone> — the number is the anchor, so a two-word name works too.
      // Anything with digits and no letters is meant to be the number, including a bad one:
      // it earns a reason rather than the usage line again.
      const at = rest.findIndex((w) => /\d/.test(w) && !/[\p{L}]/u.test(w));
      if (at < 1) {
        return 'To add someone: *add Rahul 919812345678*\n(name, WhatsApp number with country code)';
      }
      const r = await this.add({ name: rest.slice(0, at).join(" "), phone: rest[at] });
      return r.ok || `⚠️ ${r.error}`;
    }

    if (["edit", "change", "update"].includes(verb)) {
      // "change the Manish meeting time to 3 pm" is not a contact edit. "change"/"update" only
      // count here when a contact field is named; otherwise it goes on to be read as work.
      if (verb !== "edit" && !rest.some((w) => ["phone", "number", "mobile", "name", "alias", "aliases", "nickname", "nicknames", "does", "handles", "role", "beat"].includes(lower(w)))) return null;
      if (verb !== "edit" && /\b(meeting|meetings|call|task|tasks|time|reminder)\b/i.test(text)) return null;
      if (rest.length < 3) return 'To change someone: *edit Rahul phone 919812345678* · *edit Rahul name Rahul Verma* · *edit Rahul alias CA Rahul*';
      // The field word splits the two halves: everything before it is the person, after it the
      // value. A two-word name on either side is fine that way.
      const FIELDS = ["phone", "number", "no", "mobile", "name", "alias", "aliases", "nickname",
        "nicknames", "does", "handles", "work", "role", "beat"];
      const at = rest.findIndex((w) => FIELDS.includes(lower(w)));
      if (at < 1) {
        const row = await this.find(rest.join(" "));
        return row
          ? `*${row.name}* · ${row.phone}${(row.aliases || []).length ? ` · also: ${row.aliases.join(", ")}` : ""}\nChange it with: *edit ${row.name} phone 919...* · *name ...* · *alias ...*`
          : 'Say which part: *edit Rahul phone 919812345678* · *edit Rahul name Rahul Verma*';
      }
      const r = await this.edit(rest.slice(0, at).join(" "), rest[at], rest.slice(at + 1).join(" "));
      return r.ok || `⚠️ ${r.error}`;
    }

    if (["remove", "delete", "drop"].includes(verb) && rest.length) {
      const row = await this.find(rest.join(" "));
      // "remove" on its own is a real word in a task ("remove the old banner"), so this only
      // answers when it names somebody who is actually on the list.
      if (!row) return null;
      const r = await this.remove(row.name);
      return r.ok || `⚠️ ${r.error}`;
    }

    return null;
  }
}
