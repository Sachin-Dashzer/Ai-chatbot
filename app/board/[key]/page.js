import { getBot } from "../../../lib/runtime.js";
import { MASTER } from "../../../lib/boards.js";
import { TeamBoard, MasterBoard } from "../../../components/Board";
import Shell from "../../../components/Shell";
import Chat from "../../../components/Chat";
import People from "../../../components/People";
import AutoRefresh from "../../../components/AutoRefresh";

export const dynamic = "force-dynamic";

// The line at the foot of the sidebar, which replaced a footer repeated at the
// bottom of every screen.
const FOOT = <>Live data · this page refreshes itself every 2 minutes.</>;

export default async function BoardPage({ params, searchParams }) {
  const { key } = await params;
  const sp = await searchParams;
  const bot = getBot();
  const scope = await bot.boards.scopeOf(key);

  if (!scope) {
    return (
      // One short message has no business occupying a 1440px canvas: it sits
      // in a card of its own width, centred, and the ground around it is the
      // page rather than a hole in it.
      <Shell title="Link not valid">
        <div className="flex min-h-[76dvh] items-center justify-center py-10">
          <div className="w-full max-w-[34rem] rounded-card border border-edge bg-surface p-7">
            <h1 className="text-title font-semibold text-ink">This link is not valid</h1>
            <p className="mt-3 text-body text-muted">
              It has most likely been replaced. Whenever a board link is replaced from WhatsApp the
              old one stops working straight away, so nothing that leaked keeps access.
            </p>
            <p className="mt-3 border-t border-rule pt-3 text-body text-muted">
              Ask Ankit for the current one: he sends{" "}
              {/* taste-skill-ignore: a literal WhatsApp command */}
              <span className="font-mono text-ink">boards</span> to the bot and gets every link
              back.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const isMaster = scope === MASTER;

  if (isMaster) {
    const tab = sp?.tab || "attention";
    const data = await bot.boards.masterBoard(tab, sp?.who || "", sp?.view || "");
    const nav = await bot.boards.nav(key, data.tab);

    if (data.tab === "people") {
      return (
        <Shell scope="Master board" sections={nav} title={data.title} foot={FOOT}>
          <People data={data} boardKey={key} ok={sp?.ok || ""} err={sp?.err || ""} />
        </Shell>
      );
    }

    // The transcript lays out and scrolls its own two panes, so it gets the
    // whole area rather than the padded canvas the other tabs use.
    if (data.tab === "messages") {
      return (
        <Shell scope="Master board" sections={nav} title={data.title} foot={FOOT} flush>
          <AutoRefresh seconds={120} />
          <Chat data={data} boardKey={key} />
        </Shell>
      );
    }

    return (
      <Shell scope="Master board" sections={nav} title={data.title} foot={FOOT}>
        <AutoRefresh seconds={120} />
        <MasterBoard data={data} boardKey={key} />
      </Shell>
    );
  }

  const data = await bot.boards.teamBoard();
  return (
    <Shell brand="Ankit Desk" title={data.title}>
      <AutoRefresh seconds={120} />
      <TeamBoard data={data} />
      <p className="mt-8 text-small text-faint">
        Ankit Desk · this page refreshes itself every 2 minutes.
      </p>
    </Shell>
  );
}
