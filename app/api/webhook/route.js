// WhatsApp webhook: Meta calls GET once to verify, then POSTs every incoming message.
import crypto from "node:crypto";
import { getBot } from "../../../lib/runtime.js";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Transcribing a voice note and creating its tasks runs after the response, inside this budget.
export const maxDuration = 60;

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const bot = getBot();
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === bot.s.waVerifyToken) {
    return new Response(p.get("hub.challenge") || "", { headers: { "content-type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req) {
  const bot = getBot();
  const raw = await req.text();
  if (bot.s.waAppSecret) {
    const sig = req.headers.get("x-hub-signature-256") || "";
    const expected = "sha256=" + crypto.createHmac("sha256", bot.s.waAppSecret).update(raw).digest("hex");
    const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return new Response("bad signature", { status: 401 });
  }
  let data = {};
  try { data = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  for (const entry of data.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        // Reply to Meta at once, then process (voice notes take a few seconds). `after` keeps the
        // work running past the response: serverless hosts freeze the process the moment it is sent,
        // which would drop the task silently. On an always-on server it behaves the same way.
        after(() => bot.handleMessage(msg).catch((e) => console.error("[ankit-desk] message failed", msg.id, e)));
        // Reminders due this minute go out too, in case the minute cron is late.
        after(() => bot.tickDue().catch((e) => console.error("[ankit-desk] due check failed", e)));
      }
    }
  }
  return Response.json({ ok: true });
}
