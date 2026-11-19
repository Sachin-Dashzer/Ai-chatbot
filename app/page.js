// Today: the screen Ankit opens first. It answers one question — is anything
// waiting on me, and which board do I open? Everything on it is live data.
//
// It is written for someone opening it for the first time: one block per
// question, in the order a beginner asks them (what needs me → what will the
// bot do today → where do I go → how do I talk to it), plain sentences instead
// of dashboard shorthand, and every number appearing exactly once, in the block
// that explains it.
import { getBot } from "../lib/runtime.js";
import { HELP } from "../lib/bot.js";
import { MASTER, TEAM } from "../lib/boards.js";
import Shell, { PageHead } from "../components/Shell";
import TaskCard from "../components/TaskCard";
import CopyLink from "../components/CopyLink";
import { Icon, Panel, DayList } from "../components/ui";

export const dynamic = "force-dynamic";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// *word* in HELP means bold on WhatsApp; here it is the command itself.
function Rich({ line }) {
  return line.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 ? <code key={i} className="font-mono text-[13px] font-medium text-ink">{part}</code> /* taste-skill-ignore: real commands, in a code element */ : part);
}

// HELP is the single source of truth for what the bot understands.
function helpBlocks() {
  const blocks = [];
  for (const line of HELP.split("\n").slice(1)) {
    if (!line) { blocks.push({ head: null, items: [] }); continue; }
    if (!blocks.length) blocks.push({ head: null, items: [] });
    const b = blocks[blocks.length - 1];
    if (!b.items.length && line.length <= 30 && (line.endsWith(":") || /^\*[^*]+\*$/.test(line))) {
      b.head = line.replace(/[*:]/g, "");
    } else b.items.push(line);
  }
  return blocks.filter((b) => b.items.length);
}

function HelpColumns({ blocks }) {
  return (
    <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.head && <h3 className="mb-1.5 text-body font-medium">{b.head}</h3>}
          <ul className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="text-body leading-snug text-muted">
                <Rich line={it.replace(/^• /, "")} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  const bot = getBot();
  await globalThis.__ankitDeskDemo; // the demo seed, if it is still running
  const s = bot.s;
  const owner = bot.d.owner.name;

  const open = await bot.openTasks();
  const stats = bot.boards.stats(open, await bot.boards.doneWeek());
  const masterKey = await bot.boards.keyFor(MASTER);

  const pending = await bot.pendingOnMe();
  // Cards for everything waiting, so "the oldest" is the real oldest; the panel
  // then shows the first few and links out for the rest.
  const pendingCards = await bot.boards.cards(pending);
  const rows = pendingCards.slice(0, 5);
  const oldest = Math.max(0, ...pendingCards.map((c) => c.days));

  const teamTasks = open.filter((t) => t.owner !== owner);
  const team = {
    key: await bot.boards.keyFor(TEAM),
    people: bot.d.people.map((p) => p.name).join(", ") || "nobody added yet",
    open: teamTasks.length,
    attention: teamTasks.filter((t) => bot.boards.needsAttention(t)).length,
  };

  const nowMin = toMin(bot.nowIso().slice(11, 16));
  const slots = bot.boards.slots();
  const next = slots.find((x) => x.min > nowMin);

  const nav = await bot.boards.nav(masterKey, "today");

  // The one sentence under the title says how the whole team stands. The number
  // that answers this screen leads its own block below, so neither repeats the
  // other.
  const finding = `${plural(stats.open, "task")} open across the team, ${stats.doneWeek} closed in the last 7 days.`;

  const blocks = helpBlocks();
  const cut = blocks.findIndex((b) => b.head === "Commands");
  const first = cut === -1 ? blocks : blocks.slice(0, cut + 1);
  const rest = cut === -1 ? [] : blocks.slice(cut + 1);

  return (
    <Shell scope="Master board" sections={nav} title="Today">
      <PageHead
        title="Today"
        finding={finding}
        stamp={`Updated ${bot.boards.updated()} · ${s.timezone.split("/")[1] || s.timezone} time`}
      />

      {s.store === "memory" && (
        <p className="mb-6 rounded-card border border-[#fde68a] bg-[var(--pill-warning-bg)] px-3 py-2 text-body text-[var(--pill-warning-ink)]">
          Nothing is being saved. This copy keeps tasks and messages in memory only, so restarting the
          server wipes them. Set <span className="font-mono">MONGODB_URI</span>{/* taste-skill-ignore: an environment variable name */} to a database before you
          start using it for real.
        </p>
      )}

      {/* The screen's question, answered first and by its biggest block. */}
      <Panel
        title="Waiting on you"
        action={
          <a href={`/board/${masterKey}?tab=attention`} className="press inline-flex h-7 items-center gap-1 rounded-control border border-[var(--control)] px-2 text-small text-muted hover:border-ink hover:text-ink">
            Open the full board <Icon.chevron width={12} height={12} />
          </a>
        }
        pad={false}
      >
        <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 sm:px-5 ${rows.length ? "border-b border-edge" : ""}`}>
          <span className={`text-kpi tabular ${pending.length ? "text-[var(--negative)]" : "text-ink"}`}>
            {pending.length}
          </span>
          <p className="min-w-0 flex-1 text-body text-muted">
            {pending.length === 0
              ? "Nothing is waiting on you. The bot is chasing the team for everything else."
              : `${pending.length === 1 ? "task is" : "tasks are"} waiting on you: your own work, plus anything the team is stuck on until you answer`
                + (oldest >= 3 ? `. The oldest has been open ${plural(oldest, "day")}.` : ".")}
          </p>
        </div>

        {rows.length > 0 && (
          <>
            <div className="px-4 sm:px-5">
              {rows.map((c) => <TaskCard key={c.id} c={c} ownerView />)}
            </div>
            {pending.length > rows.length && (
              <p className="border-t border-rule px-4 py-2 text-small text-faint sm:px-5">
                {pending.length - rows.length} more on the full board.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel
        title="What the bot does today"
        action={<span className="text-small text-faint">{next ? `Next at ${next.time}` : "Nothing left today"}</span>}
        note={<>You never wait for these to give someone a task: a task reaches the person the second you send it.
          These are the times the bot chases people and reports back to you. Working days {s.workDays}.</>}
        className="mt-6"
      >
        <DayList slots={slots} nowMin={nowMin} />
      </Panel>

      {/* items-start: the links keep their own height instead of stretching to
          the table beside them and leaving a blank band at the foot. */}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <Panel
          title="The team's board"
          note={<>One board for everyone on the team. It never shows your own tasks, so its counts are lower than the
            ones in the menu. &ldquo;Behind&rdquo; means stuck, or untouched for a week. If the link reaches the wrong
            person, send <span className="font-mono text-muted">newlink team</span>{/* taste-skill-ignore: a literal WhatsApp command */} to the bot and the old one stops working.</>}
          pad={false}
        >
          <table className="w-full text-body">
            <thead>
              <tr className="text-small text-faint">
                <th scope="col" className="w-1/2 px-4 pb-2 pt-3 text-left font-normal sm:px-5">Board</th>
                <th scope="col" className="px-3 pb-2 pt-3 text-right font-normal">Open tasks</th>
                <th scope="col" className="pb-2 pt-3 text-right font-normal">Behind</th>
                <th scope="col" className="pb-2 pt-3" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-rule">
                <td className="px-4 py-2.5 align-middle sm:px-5">
                  <a href={`/board/${team.key}`} className="text-body font-medium text-ink hover:text-[var(--accent)]">Team tasks</a>
                  <span className="mt-0.5 block truncate text-small text-muted">{team.people}</span>
                </td>
                <td className="px-3 py-2.5 text-right align-middle tabular text-ink">{team.open}</td>
                <td className={`py-2.5 text-right align-middle tabular ${team.attention ? "text-ink" : "text-faint"}`}>
                  {team.attention || "—"}
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right align-middle sm:pr-5">
                  <CopyLink path={`/board/${team.key}`} label="Copy the team board link" />
                </td>
              </tr>
            </tbody>
          </table>
        </Panel>

        <Panel title="The rest of your board" pad={false}>
          {[
            ["Stuck or too old", `/board/${masterKey}?tab=attention`, "nobody has moved it in a week, or it is waiting on someone", "chevron"],
            ["Your own tasks", `/board/${masterKey}?tab=mine`, "what you gave yourself, and what you closed today", "chevron"],
            ["Every message", `/board/${masterKey}?tab=messages`, "what the team wrote, word for word, voice notes included", "chevron"],
            ["Who the bot messages", `/board/${masterKey}?tab=people`, "add someone, fix a number, or stop messages reaching them", "chevron"],
            ["What is coming up", "/calendar", "every task on the day it was given, and what the bot sends that day", "chevron"],
            ["Download every task", `/board/${masterKey}/export`, "a spreadsheet file of everything, for your own records", "download"],
          ].map(([label, href, sub, glyph]) => {
            const Glyph = Icon[glyph];
            return (
              <a key={label} href={href}
                className="press flex items-center gap-3 border-b border-rule px-4 py-3 last:border-0 hover:bg-active/60 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium">{label}</span>
                  <span className="block text-small text-muted">{sub}</span>
                </span>
                <Glyph className="flex-none text-faint" />
              </a>
            );
          })}
        </Panel>
      </div>


      {/* Everything the bot can do, it does on WhatsApp — so this is the last
          block, and it starts with the handful a first-time user needs. */}
      <Panel title="How to use the bot on WhatsApp" className="mt-6">
        <HelpColumns blocks={first} />

        {rest.length > 0 && (
          <details className="mt-5 border-t border-rule pt-4">
            <summary className="press inline-flex items-center gap-1.5 text-body font-medium text-muted hover:text-ink">
              <Icon.chevron className="chev" width={14} height={14} />
              Show the rest: settings, fixing mistakes, your team, board links
            </summary>
            <div className="mt-4">
              <HelpColumns blocks={rest} />
            </div>
          </details>
        )}
      </Panel>
    </Shell>
  );
}
