// Drop the whole database and start clean. This is the go-live step in the
// README: it clears test tasks, messages, check-ins, settings and board keys,
// and resets task numbering to #1.
//
// It writes a JSON dump of everything to backups/ first, so a reset made by
// mistake can be put back.
//
// Usage:  node --env-file-if-exists=.env scripts/reset-db.js [--write]
// Without --write it only reports what it would drop.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { loadSettings } from "../lib/config.js";

const write = process.argv.includes("--write");
const s = loadSettings();

if (s.store !== "mongo") {
  console.error("No MONGODB_URI, so there is no database to reset.");
  process.exit(1);
}

const client = new MongoClient(s.mongoUri);
await client.connect();
const db = client.db(s.mongoDb);

const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
if (!names.length) {
  console.log(`Database "${s.mongoDb}" is already empty.`);
  await client.close();
  process.exit(0);
}

const dump = {};
let total = 0;
for (const name of names) {
  const rows = await db.collection(name).find({}).toArray();
  dump[name] = rows;
  total += rows.length;
  console.log(String(rows.length).padStart(6), name);
}
console.log(`\n${total} document(s) in ${names.length} collection(s).`);

if (!write) {
  console.log("\nNothing was dropped. Re-run with --write to reset.");
  await client.close();
  process.exit(0);
}

const dir = path.resolve(process.cwd(), "backups");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${s.mongoDb}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify(dump, null, 1));
console.log(`\nBacked up to ${file}`);

await db.dropDatabase();
console.log(`Dropped "${s.mongoDb}". Task numbering restarts at #1.`);
console.log("Every board link has changed: send *boards* to the bot for the new ones.");

await client.close();
process.exit(0);
