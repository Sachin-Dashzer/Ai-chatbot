// Manual triggers for testing: POST /api/admin/run/checkin?token=WA_VERIFY_TOKEN
import { getBot } from "../../../../../lib/runtime.js";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { job } = await params;
  const bot = getBot();
  if (new URL(req.url).searchParams.get("token") !== bot.s.waVerifyToken) return new Response("forbidden", { status: 403 });
  const jobs = { pending: () => bot.runPending(), review: () => bot.runReview(), nudge: () => bot.runNudge(),
    brief: () => bot.runBrief(), due: () => bot.runDue() };
  if (!jobs[job]) return new Response("unknown job", { status: 404 });
  // The job's own result comes back, so a failed WhatsApp send shows up here, not only in the logs.
  return Response.json({ ran: job, ...(await jobs[job]()) });
}
