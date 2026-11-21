import { Directory, loadSettings } from "../lib/config.js";
import { MemoryStore } from "../lib/store/memory.js";
import { Bot } from "../lib/bot.js";

export const OWNER = "910000000001", HIMANSHU = "910000000002", SHALU = "910000000003", RAJNEESH = "910000000004", PULKIT = "910000000005";

export class FakeWA {
  // failing = [phone, ...]: sends to those numbers throw, the way the real client does on a
  // rejected template, an expired token or a number that is not on WhatsApp.
  // failingTemplates = [name, ...]: that template throws the way Meta does while it is still
  // in review, so the fallback can be tested.
  constructor() { this.sent = []; this.failing = []; this.failingTemplates = []; }
  _check(to) { if (this.failing.includes(to)) throw new Error("WhatsApp send failed 400: (#132015) template is not Active"); }
  async sendText(to, body) { this._check(to); this.sent.push({ kind: "text", to, body }); }
  async sendButtons(to, body, buttons) { this._check(to); this.sent.push({ kind: "buttons", to, body, buttons }); }
  async sendTemplate(to, name, params = [], payloads = []) {
    this._check(to);
    if (this.failingTemplates.includes(name)) {
      throw new Error("WhatsApp send failed 400: (#132001) template name does not exist in the translation");
    }
    this.sent.push({ kind: "template", to, name, params, payloads });
  }
  async downloadMedia(id) { return { bytes: Buffer.from(id), mime: "audio/ogg" }; }
  to(p) { return this.sent.filter((m) => m.to === p); }
  last(p) { const a = this.to(p); return a[a.length - 1]; }
}

export const VOICE = {
  v1: "Himanshu ko bolo Galaxy Royal ka final invoice aaj bhejo, urgent hai",
  v2: "Himanshu Sector 76 site visit, Galaxy Royal AMC quote. Shalu Oct collection. Rajneesh 2B. Mujhe Goodbite urgent",
  h1: "Invoice bhej diya. Site visit Wednesday fix hai. AMC quote mein sir ka rate approval chahiye.",
};

export class FakeAI {
  async transcribe(bytes) { return VOICE[bytes.toString()]; }
  // The real one corrects spelling and grammar; here it only has to be the identity, so a
  // test can tell a message that went through the pass from one that skipped it.
  async polish(text) { return text; }
  async parseOwner(text, openTasks = [], now = "", memory = "", meetings = [], closed = []) {
    // "reopen the 1st task of Himanshu": his lowest-numbered closed task.
    if (/reopen the 1st task/i.test(text)) {
      const hs = closed.filter((t) => t.owner === "Himanshu").sort((a, b) => a.id - b.id);
      return { reopens: hs.length ? [hs[0].id] : [] };
    }
    // A lasting fact about him, a habit he wants, and a message that is only conversation —
    // the three shapes the real prompt added. Checked first: each of these also contains
    // words the task branches below would otherwise match.
    if (/^remember /i.test(text)) return { memories: [{ text: "Does not take calls after 9 PM" }] };
    if (/drink water/i.test(text)) {
      return { habits: [{ label: "drink water", text: "A glass of water, Ankit 💛", times: ["11:00", "14:00", "17:00"], days: "daily" }] };
    }
    if (/thank|how are you|love you/i.test(text)) return {};
    // A follow-up read together with the instruction it answers.
    if (/^EARLIER \(not understood\): send the deck[\s\S]*NOW: it's for me/i.test(text)) {
      return { tasks: [{ owner: "me", task: "Send the deck" }] };
    }
    if (/^send the deck$/i.test(text)) return { unclear: ["Send the deck"] };
    // Conversation the model also, wrongly, dropped in unclear.
    if (/what's up/i.test(text)) return { chat: true, unclear: [text] };
    // A meeting with someone who is not on the team.
    if (/with ryan/i.test(text)) return { meetings: [{ title: null, with: ["Ryan"], at: "2026-11-17T18:00", note: null }] };
    if (text === VOICE.v1) return { tasks: [{ owner: "Himanshu", task: "Send Galaxy Royal final invoice" }] };
    if (text === VOICE.v2) return { tasks: [
      { owner: "Himanshu", task: "Fix Sector 76 society site visit" },
      { owner: "Himanshu", task: "Send AMC quote to Galaxy Royal" },
      { owner: "Shalu", task: "Match Oct collections vs billing" },
      { owner: "Rajneesh", task: "Oct GSTR-2B reconciliation" },
      { owner: "me", task: "Review Goodbite reply" }] };
    if (text.includes("Amazon")) return { tasks: [{ owner: "Pulkit", task: "Share 7-day Amazon ad spend report" }] };
    // A reminder for himself with a clock time: the real prompt is given "now", so it
    // returns the moment resolved, which is what the bot stores and pings on.
    if (/rahul/i.test(text)) return { tasks: [{ owner: "me", task: "Call Mr Rahul", due_at: "2026-11-17T21:00" }] };
    if (/courier/i.test(text)) return { tasks: [{ owner: "Pulkit", task: "Call the courier", due_at: "2026-11-17T21:00" }] };
    // Nobody named: the real prompt works the owner out from what each person handles and
    // flags that it reasoned rather than read a name.
    if (/gst refund/i.test(text)) {
      return { tasks: [{ owner: "Pulkit", task: "File the GST refund", person_sure: false, why: "handles GST refunds" }] };
    }
    // A new time for a meeting already listed. Like the real model, it reads "5 PM" as tomorrow.
    if (/change .*meeting|reschedul/i.test(text) && meetings.length) {
      return { moves: [{ meeting_id: meetings[0].id, at: "2026-11-17T17:00" }] };
    }
    if (/meeting|baje call/i.test(text)) {
      return { meetings: [{ title: "Tally data review", with: ["Himanshu", "Shalu"], at: "2026-11-17T16:00", note: null }] };
    }
    // A reply that commits to a rate is held back for Ankit to confirm.
    if (/rate approved/i.test(text)) {
      const t = openTasks.find((x) => /Galaxy Royal/i.test(x.description));
      return { replies: [{ task_id: t ? t.id : 0, message: "Rate approved at 4,500. Send the quote today.", needs_confirm: true, why: "approves a rate of 4,500" }] };
    }
    return { tasks: [], unclear: [text] };
  }
  // The real one reads the task list and finds the pattern; here it returns a fixed line
  // for Pulkit and null for anyone whose tasks show none, which is the branch that matters.
  async draftBeat(name, descriptions) {
    if (name === "Rajneesh") return null;
    return "Amazon ads, ad spend reports";
  }
  // The real one writes Love’s own words. Here it proves only what a test can check: that
  // she was reached, and which facts her prompt was given.
  async chat(system, text) {
    this.lastChatSystem = system;
    return "Any time, Ankit 💛";
  }

  async parseStatus(text, items, meetings = []) {
    if (meetings.length && /theek hai|i'll be there/i.test(text)) {
      return { updates: [], meeting_updates: [{ meeting_id: meetings[0].id, reply: "yes", note: null }], other: null };
    }
    const ids = Object.fromEntries(items.map(([i, t]) => [i, t.id]));
    if (text === VOICE.h1) return { updates: [
      { task_id: ids[1], status: "done", stuck_on: null, note: null },
      { task_id: ids[2], status: "working", stuck_on: null, note: "Site visit fixed for Wednesday" },
      { task_id: ids[3], status: "stuck", stuck_on: "ankit", note: "Needs Ankit's rate approval" }] };
    if (text.includes("working")) return { updates: [{ task_id: ids[1], status: "working", stuck_on: null, note: "Clinic data comes tomorrow" }] };
    if (text.includes("done")) return { updates: [{ task_id: ids[1], status: "done", stuck_on: null, note: null }] };
    return { updates: [], other: null };
  }
}

// clock: at(16, 18, 0) -> 16 Nov 2026 18:00 India time
export function makeClock() {
  const c = { t: null };
  c.at = (d, h, m = 0) => { c.t = new Date(`2026-11-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`); };
  return c;
}

export function setup(clock) {
  const directory = new Directory({
    owner: { name: "Ankit", phone: OWNER },
    people: [
      { name: "Himanshu", phone: HIMANSHU, does: "Galaxy Royal account, site visits" },
      { name: "Shalu", phone: SHALU, does: "collections and billing" },
      { name: "Rajneesh", phone: RAJNEESH },
      { name: "Pulkit", phone: PULKIT, does: "GST refunds, Amazon ads" },
    ],
  });
  const wa = new FakeWA();
  const ai = new FakeAI();
  const bot = new Bot({ settings: loadSettings({}), store: new MemoryStore(), wa, ai, directory, now: () => clock.t });
  return { bot, wa, ai };
}

let n = 0;
export const text = (from, body) => ({ from, id: `m${++n}`, type: "text", text: { body } });
export const voice = (from, key) => ({ from, id: `m${++n}`, type: "audio", audio: { id: key } });
export const tap = (from, payload) => ({ from, id: `m${++n}`, type: "button", button: { payload, text: "View" } });

export const btn = (from, id) => ({ from, id: `m${++n}`, type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: "x" } } });
