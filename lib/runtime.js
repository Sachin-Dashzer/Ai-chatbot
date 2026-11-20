
import path from "node:path";
import { loadSettings, Directory } from "./config.js";
import { MemoryStore } from "./store/memory.js";
import { MongoStore } from "./store/mongo.js";
import { WhatsApp } from "./whatsapp.js";
import { AI } from "./ai.js";
import { Bot } from "./bot.js";

export function getBot() {
  if (!globalThis.__ankitDesk) {
    const settings = loadSettings();
    const directory = Directory.fromFile(path.resolve(process.cwd(), settings.peopleFile));
    // In-memory data lives inside one server process. On Vercel every instance has its own copy,
    // so the team saw two different task lists and deletes landed on only one of them. Outside
    // local development the bot refuses to start without MongoDB.
    const hosted = process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production";
    if (settings.store !== "mongo" && hosted && process.env.ALLOW_MEMORY_STORE !== "1") {
      throw new Error("[ankit-desk] MONGODB_URI is not set. Add it in the host's environment variables and redeploy.");
    }
    const store = settings.store === "mongo" ? new MongoStore(settings.mongoUri, settings.mongoDb) : new MemoryStore();
    if (settings.store !== "mongo") console.warn("[ankit-desk] Using in-memory store – data is lost on restart. Local development only. Set MONGODB_URI for production.");
    globalThis.__ankitDesk = new Bot({ settings, store, wa: new WhatsApp(settings), ai: new AI(settings, directory), directory });
  }
  return globalThis.__ankitDesk;
}
