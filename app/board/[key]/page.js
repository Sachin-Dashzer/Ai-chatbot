import { getBot } from "../../../lib/runtime.js";
import { MASTER } from "../../../lib/boards.js";
import { TeamBoard, MasterBoard } from "../../../components/Board";
import AutoRefresh from "../../../components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params, searchParams }) {
  const { key } = await params;
  const sp = await searchParams;
  const bot = getBot();
  const scope = await bot.boards.scopeOf(key);
  if (!scope) {
    return <main className="mx-auto max-w-xl p-6"><h1 className="text-lg font-semibold">This link is not valid.</h1></main>;
  }
  const isMaster = scope === MASTER;
  const data = isMaster ? await bot.boards.masterBoard(sp?.tab || "attention", sp?.who || "") : await bot.boards.teamBoard(scope);
  return (
    <main className="mx-auto max-w-2xl px-3.5 pb-10 pt-4">
      <AutoRefresh seconds={120} />
      {isMaster ? <MasterBoard data={data} boardKey={key} /> : <TeamBoard data={data} />}
      <p className="mt-6 text-center text-xs text-stone-400">Ankit Desk · refreshes every 2 minutes</p>
    </main>
  );
}
