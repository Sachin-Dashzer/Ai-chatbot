// CSV backup of every task (master link only).
import { getBot } from "../../../../lib/runtime.js";
import { MASTER } from "../../../../lib/boards.js";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { key } = await params;
  const bot = getBot();
  if ((await bot.boards.scopeOf(key)) !== MASTER) return new Response("forbidden", { status: 403 });
  return new Response(await bot.boards.exportCsv(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=tasks.csv" },
  });
}
