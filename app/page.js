// Today: the screen Ankit opens first.
//
// Its one question: is anything waiting on me, and where do I go next? The
// biggest block on the screen answers it, and the largest figure on the screen
// is the one that sentence names. Everything here is live data.
//
// The blocks are paired into bands of two rather than stacked as five
// full-width cards: a list of five short rows stretched to 1240px leaves a
// 500px void between a task and its owner, and five identical frames down a
// page give the screen's question the same weight as a help manual.
import { getBot } from "../lib/runtime.js";
import { HELP } from "../lib/bot.js";
import { MASTER, TEAM } from "../lib/boards.js";
import Shell, { PageHead } from "../components/Shell";
import TaskCard from "../components/TaskCard";
import CopyLink from "../components/CopyLink";
import { Icon, Panel, DayList, Lead, Notice, MiniLink } from "../components/ui";

export const dynamic = "force-dynamic";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// *word* in HELP means bold on WhatsApp; here it is the command itself.
function Rich({ line }) {
  return line.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 ? (
      // taste-skill-ignore: real WhatsApp commands, in a code element
      <code key={i} className="font-mono text-meta font-medium text-ink">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

// HELP is the single source of truth for what the bot understands.
function helpBlocks() {
  const blocks = [];
  for (const line of HELP.split("\n").slice(1)) {
    if (!line) {
      blocks.push({ head: null, items: [] });
      continue;
    }
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
          {b.head && <h3 className="mb-2 text-body font-medium text-ink">{b.head}</h3>}
          <ul className="space-y-1.5">
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
  // Five rows. That leaves this block a little shorter than the bot's day
  // beside it, so the slack in the band sits above this panel's own closing
  // line — which is a link out, the one thing a stretched card may pin to its
  // foot. Capped and linked out, never paginated.
  const rows = pendingCards.slice(0, 5);
  const oldest = Math.max(0, ...pendingCards.map((c) => c.days));

  const teamTasks = open.filter((t) => t.owner !== owner);
  const team = {
    key: await bot.boards.keyFor(TEAM),
    people: bot.d.people.map((p) => p.name).join(", ") || "nobody added yet",
    open: teamTasks.length,
    attention: teamTasks.filter((t) => bot.boards.needsAttention(t)).length,
  };

  const nowIso = bot.nowIso();
  const nowMin = toMin(nowIso.slice(11, 16));
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

  const places = [
    ["Stuck or too old", `/board/${masterKey}?tab=attention`, "nobody has moved it in a week, or it is waiting on someone", "flag"],
    ["Your own tasks", `/board/${masterKey}?tab=mine`, "what you gave yourself, and what you closed today", "user"],
    ["Every message", `/board/${masterKey}?tab=messages`, "what the team wrote, word for word, voice notes included", "inbox"],
    ["Who the bot messages", `/board/${masterKey}?tab=people`, "add someone, fix a number, or stop messages reaching them", "users"],
    ["What is coming up", "/calendar", "every task on the day it was given, and what the bot sends that day", "calendar"],
    ["Download every task", `/board/${masterKey}/export`, "a spreadsheet file of everything, for your own records", "download"],
  ];

  return (
    <Shell
      scope="Master board"
      sections={nav}
      title="Today"
      foot={<>Live data · this page refreshes itself every 2 minutes.</>}
    >
      <PageHead
        title="Today"
        finding={finding}
        stamp={`Updated ${bot.boards.updated()} · ${s.timezone.split("/")[1] || s.timezone}`}
      />

      {s.store === "memory" && (
        <div className="mb-4">
          <Notice>
            Nothing is being saved. This copy keeps tasks and messages in memory only, so restarting
            the server wipes them. Set{" "}
            {/* taste-skill-ignore: an environment variable name */}
            <span className="font-mono">MONGODB_URI</span> to a database before you start using it
            for real.
          </Notice>
        </div>
      )}

      {/* Band one: the screen's question, and the clock the product runs on.
          Each panel keeps its own height — five tasks and five scheduled
          moments happen to land within about a dozen pixels of each other, so
          stretching one to meet the other would only put a hole in it. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
        <Panel
          title="Waiting on you"
          className="flex flex-col"
          action={
            <MiniLink href={`/board/${masterKey}?tab=attention`}>
              Open the full board <Icon.chevron width={12} height={12} />
            </MiniLink>
          }
          pad={false}
        >
          <div className={`px-5 py-4 ${rows.length ? "border-b border-edge" : ""}`}>
            <Lead value={pending.length}>
              {pending.length === 0
                ? "Nothing is waiting on you. The bot is chasing the team for everything else."
                : `${pending.length === 1 ? "task is" : "tasks are"} waiting on you: your own work, plus anything the team is stuck on until you answer` +
                  (oldest >= 3 ? `. The oldest has been open ${plural(oldest, "day")}.` : ".")}
            </Lead>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex-1 px-5">
                {/* The state stays: this list mixes work the team is blocked on
                    until you answer with your own tasks, and the mark is what
                    tells them apart. It also sits in the column that would
                    otherwise be the gap between a short description and its
                    owner. */}
                {rows.map((c) => (
                  <TaskCard key={c.id} c={c} ownerView />
                ))}
              </div>
              <p className="border-t border-rule px-5 py-2.5 text-small text-faint">
                {pending.length > rows.length
                  ? `${pending.length - rows.length} more on the full board.`
                  : "That is all of them."}
              </p>
            </>
          )}
        </Panel>

        <Panel
          title="The bot's day"
          className="flex flex-col"
          action={
            <span className="text-small text-faint">
              {next ? `next ${next.time}` : "done for today"}
            </span>
          }
          pad={false}
        >
          <div className="flex-1 px-5 py-4">
            <DayList slots={slots} nowMin={nowMin} nowLabel={nowIso.slice(11, 16)} />
          </div>
          <p className="border-t border-rule px-5 py-2.5 text-small leading-snug text-faint">
            A task reaches someone the second you send it. These are the times the bot chases people
            and reports back. Working days {s.workDays}.
          </p>
        </Panel>
      </div>

      {/* Band two: where the work lives. */}
      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
        <Panel title="The rest of your board" pad={false} className="flex flex-col">
          <div className="flex-1">
            {places.map(([label, href, sub, glyph]) => {
              const Glyph = Icon[glyph];
              return (
                <a
                  key={label}
                  href={href}
                  className="press-row hover-row flex items-center gap-3 border-b border-rule px-5 py-3 last:border-0"
                >
                  <Glyph className="mt-0.5 flex-none self-start text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-ink">{label}</span>
                    <span className="block text-meta text-faint">{sub}</span>
                  </span>
                  <Icon.chevron className="flex-none text-[var(--control)]" width={14} height={14} />
                </a>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="The team's board"
          className="flex flex-col"
          action={<CopyLink path={`/board/${team.key}`} label="Copy the team board link" />}
          pad={false}
        >
          <dl className="grid grid-cols-2 border-b border-edge">
            <div className="border-r border-edge px-5 py-3.5">
              <dt className="text-small text-faint">Open</dt>
              <dd className="mt-1 text-title tabular leading-none text-ink">{team.open}</dd>
            </div>
            <div className="px-5 py-3.5">
              <dt className="text-small text-faint">Behind</dt>
              <dd
                className={`mt-1 text-title tabular leading-none ${
                  team.attention ? "text-[var(--negative)]" : "text-ink"
                }`}
              >
                {team.attention || "0"}
              </dd>
            </div>
          </dl>

          <div className="flex-1 px-5 py-4">
            <p className="text-meta text-muted">{team.people}</p>
            <p className="mt-2.5 text-meta leading-snug text-faint">
              One board for everyone. It never shows your own tasks, so its counts are lower than the
              ones in the menu. &ldquo;Behind&rdquo; means stuck, or untouched for a week.
            </p>
            <p className="mt-2.5 text-meta leading-snug text-faint">
              It is view only: they answer the bot on WhatsApp and it lands here within a minute. If
              the link reaches the wrong person, send{" "}
              {/* taste-skill-ignore: a literal WhatsApp command */}
              <span className="font-mono text-muted">newlink team</span> to the bot and the old one
              stops working.
            </p>
          </div>

          <a
            href={`/board/${team.key}`}
            className="press-row hover-row flex items-center justify-between gap-3 border-t border-rule px-5 py-2.5 text-body font-medium text-ink"
          >
            Open the team board
            <Icon.arrow className="flex-none text-faint" width={14} height={14} />
          </a>
        </Panel>
      </div>

      {/* Everything the bot can do, it does on WhatsApp — so this is the last
          block, and it opens with the handful a first-time user needs. */}
      <Panel title="How to use the bot on WhatsApp" className="mt-8">
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
