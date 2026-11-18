// Master board actions: tick a task done. Only the master link may do this.
import { getBot } from "../../../../lib/runtime.js";
import { MASTER } from "../../../../lib/boards.js";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { key } = await params;
  const bot = getBot();
  if ((await bot.boards.scopeOf(key)) !== MASTER) return new Response("forbidden", { status: 403 });
  const form = await req.formData();
  await bot.boards.act(Number(form.get("id")), String(form.get("action")));
  const tab = encodeURIComponent(String(form.get("tab") || "attention"));
  // The view the tick came from, so ticking in "All open tasks" lands back there.
  const view = encodeURIComponent(String(form.get("view") || ""));
  return new Response(null, {
    status: 303,
    headers: { Location: `/board/${key}?tab=${tab}${view ? `&view=${view}` : ""}` },
  });
}
