// Manual triggers for testing: POST /api/admin/run/checkin?token=WA_VERIFY_TOKEN
import { getBot } from "../../../../../lib/runtime.js";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { job } = await params;
  const bot = getBot();
  if (new URL(req.url).searchParams.get("token") !== bot.s.waVerifyToken) return new Response("forbidden", { status: 403 });
  const jobs = { batch: () => bot.runBatch(), checkin: () => bot.runCheckin(), nudge: () => bot.runNudge(), brief: () => bot.runBrief() };
  if (!jobs[job]) return new Response("unknown job", { status: 404 });
  await jobs[job]();
  return Response.json({ ran: job });
}
