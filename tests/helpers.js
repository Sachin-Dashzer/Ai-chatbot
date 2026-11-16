import { Directory, loadSettings } from "../lib/config.js";
import { MemoryStore } from "../lib/store/memory.js";
import { Bot } from "../lib/bot.js";

export const OWNER = "910000000001", HIMANSHU = "910000000002", SHALU = "910000000003", RAJNEESH = "910000000004", PULKIT = "910000000005";

export class FakeWA {
  constructor() { this.sent = []; }
  async sendText(to, body) { this.sent.push({ kind: "text", to, body }); }
  async sendTemplate(to, name, params = [], payloads = []) { this.sent.push({ kind: "template", to, name, params, payloads }); }
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
  async parseOwner(text) {
    if (text === VOICE.v1) return { tasks: [{ owner: "Himanshu", business: "HoldPoint", task: "Send Galaxy Royal final invoice", priority: "urgent" }] };
    if (text === VOICE.v2) return { tasks: [
      { owner: "Himanshu", business: "HoldPoint", task: "Fix Sector 76 society site visit", priority: "normal" },
      { owner: "Himanshu", business: "HoldPoint", task: "Send AMC quote to Galaxy Royal", priority: "normal" },
      { owner: "Shalu", business: "Ryan", task: "Match Oct collections vs billing", priority: "normal" },
      { owner: "Rajneesh", business: "EPC", task: "Oct GSTR-2B reconciliation", priority: "normal" },
      { owner: "me", business: "PHMG", task: "Review Goodbite reply", priority: "urgent" }] };
    if (text.includes("Amazon")) return { tasks: [{ owner: "Pulkit", business: "Pulkit", task: "Share 7-day Amazon ad spend report", priority: "normal" }] };
    return { tasks: [], unclear: [text] };
  }
  async parseStatus(text, items) {
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
    businesses: ["HoldPoint", "Pulkit", "Ryan", "EPC", "PHMG", "Personal"],
    people: [
      { name: "Himanshu", phone: HIMANSHU, business: "HoldPoint" },
      { name: "Shalu", phone: SHALU, business: "Ryan" },
      { name: "Rajneesh", phone: RAJNEESH, business: "EPC" },
      { name: "Pulkit", phone: PULKIT, business: "Pulkit" },
    ],
  });
  const wa = new FakeWA();
  const bot = new Bot({ settings: loadSettings({}), store: new MemoryStore(), wa, ai: new FakeAI(), directory, now: () => clock.t });
  return { bot, wa };
}

let n = 0;
export const text = (from, body) => ({ from, id: `m${++n}`, type: "text", text: { body } });
export const voice = (from, key) => ({ from, id: `m${++n}`, type: "audio", audio: { id: key } });
export const tap = (from, payload) => ({ from, id: `m${++n}`, type: "button", button: { payload, text: "View" } });
