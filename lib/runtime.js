
import path from "node:path";
import { loadSettings, Directory } from "./config.js";
import { MemoryStore } from "./store/memory.js";
import { MongoStore } from "./store/mongo.js";
import { WhatsApp } from "./whatsapp.js";
import { AI } from "./ai.js";
import { Bot } from "./bot.js";
import { seedDemo } from "./demo.js";

export function getBot() {
  if (!globalThis.__ankitDesk) {
    const settings = loadSettings();
    const directory = Directory.fromFile(path.resolve(process.cwd(), settings.peopleFile));
    const store = settings.store === "mongo" ? new MongoStore(settings.mongoUri, settings.mongoDb) : new MemoryStore();
    if (settings.store !== "mongo") console.warn("[ankit-desk] Using in-memory store – data is lost on restart. Set MONGODB_URI for production.");
    globalThis.__ankitDesk = new Bot({ settings, store, wa: new WhatsApp(settings), ai: new AI(settings, directory), directory });
    if (process.env.DEMO === "1" && settings.store === "memory") {
      globalThis.__ankitDeskDemo = seedDemo(globalThis.__ankitDesk).catch((e) => console.error("demo seed failed", e));
    }
  }
  return globalThis.__ankitDesk;
}
