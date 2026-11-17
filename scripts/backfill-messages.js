
import path from "node:path";
import { loadSettings, Directory } from "../lib/config.js";
import { MemoryStore } from "../lib/store/memory.js";
import { MongoStore } from "../lib/store/mongo.js";

const write = process.argv.includes("--write");
const settings = loadSettings();
const directory = Directory.fromFile(path.resolve(process.cwd(), settings.peopleFile));

if (settings.store !== "mongo") {
  console.error("This reads your real data, so it needs MONGODB_URI. The in-memory store keeps nothing between runs.");
  process.exit(1);
}

const store = new MongoStore(settings.mongoUri, settings.mongoDb);
const owner = directory.owner.name;

const tasks = await store.find("tasks", {});
const byId = new Map(tasks.map((t) => [t.id, t]));

// Ankit's forwarded replies: person is the owner and there is no status label.
const notes = (await store.find("task_notes", { person: owner }, { sort: { id: 1 } }))
  .filter((n) => !n.status && n.text);

// Anything already in the log, so a second run adds nothing.
const existing = new Set((await store.find("messages_out", {})).map((m) => `${m.person}|${m.created_at}`));

let added = 0, skipped = 0, orphan = 0;
for (const n of notes) {
  const task = byId.get(n.task_id);
  if (!task) { orphan++; continue; }
  if (task.owner === owner) { skipped++; continue; }   // a note on his own task was never sent out
  const key = `${task.owner}|${n.created_at}`;
  if (existing.has(key)) { skipped++; continue; }

  const doc = {
    person: task.owner,
    auto: 0,
    backfilled: 1,
    text: `Ankit on #${task.id} (${task.description}):\n${n.text}`,
    created_at: n.created_at,
  };
  if (write) await store.insert("messages_out", doc);
  existing.add(key);
  added++;
}

console.log(`${write ? "Added" : "Would add"} ${added} outgoing message(s).`);
if (skipped) console.log(`Skipped ${skipped} already present or never sent.`);
if (orphan) console.log(`Skipped ${orphan} note(s) whose task no longer exists.`);
if (!write) console.log("Nothing was written. Re-run with --write to apply.");
console.log(
  "\nCheck-ins, batches and P1 pushes sent before the log existed cannot be recovered:\n" +
  "their text was built at send time and never stored. Everything the bot sends from now on\n" +
  "is recorded in full."
);

process.exit(0);
