import { getBot } from "../../../lib/runtime.js";
import { MASTER } from "../../../lib/boards.js";
import { TeamBoard, MasterBoard } from "../../../components/Board";
import Shell from "../../../components/Shell";
import Chat from "../../../components/Chat";
import AutoRefresh from "../../../components/AutoRefresh";
import { Mark } from "../../../components/ui";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params, searchParams }) {
  const { key } = await params;
  const sp = await searchParams;
  const bot = getBot();
  const scope = await bot.boards.scopeOf(key);

  if (!scope) {
    return (
      <Shell title="Link not valid">
        <div className="mx-auto max-w-[46ch] py-12 sm:py-20">
          <h1 className="text-title font-semibold">This link is not valid</h1>
          <p className="mt-2 text-body text-muted">
            It has most likely been replaced. Whenever a board link is replaced from WhatsApp the old one stops
            working straight away, so nothing that leaked keeps access.
          </p>
          <p className="mt-4 text-body text-muted">
            Ask Ankit for the current one: he sends <span className="font-mono text-ink">boards</span>{/* taste-skill-ignore: a literal WhatsApp command */} to the bot
            and gets every link back.
          </p>
        </div>
      </Shell>
    );
  }

  const isMaster = scope === MASTER;

  if (isMaster) {
    const tab = sp?.tab || "attention";
    const data = await bot.boards.masterBoard(tab, sp?.who || "");
    const groups = await bot.boards.nav(key, data.tab);

    // The chat lays out and scrolls its own two panes, so it gets the whole
    // area rather than the padded canvas the other tabs use.
    if (data.tab === "messages") {
      return (
        <Shell scope="Master board" groups={groups} title={data.title} flush>
          <AutoRefresh seconds={120} />
          <Chat data={data} boardKey={key} />
        </Shell>
      );
    }

    return (
      <Shell scope="Master board" groups={groups} title={data.title}>
        <AutoRefresh seconds={120} />
        <MasterBoard data={data} boardKey={key} />
        <Footer />
      </Shell>
    );
  }

  const data = await bot.boards.teamBoard(scope);
  return (
    <Shell brand={`${scope} · Ankit Desk`} title={scope}>
      <AutoRefresh seconds={120} />
      <TeamBoard data={data} />
      <Footer />
    </Shell>
  );
}

function Footer() {
  return (
    <p className="mt-6 flex items-center gap-1.5 text-small text-faint">
      <span className="text-[var(--accent)]"><Mark size={14} /></span>
      Ankit Desk · this page refreshes itself every 2 minutes
    </p>
  );
}
