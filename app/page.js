// Today: the screen Ankit opens first. It answers one question — is anything
// waiting on me, and which board do I need? Everything on it is live data.
import { getBot } from "../lib/runtime.js";
import { HELP } from "../lib/bot.js";
import { MASTER } from "../lib/boards.js";
import Shell, { PageHead } from "../components/Shell";
import TaskCard from "../components/TaskCard";
import CopyLink from "../components/CopyLink";
import { Icon, Stats, Panel, Empty, DayStrip, DayList } from "../components/ui";

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

export default async function Home() {
  const bot = getBot();
  await globalThis.__ankitDeskDemo; // the demo seed, if it is still running
  const s = bot.s;
  const owner = bot.d.owner.name;

  const open = await bot.openTasks();
  const stats = bot.boards.stats(open, await bot.boards.doneWeek());
  const masterKey = await bot.boards.keyFor(MASTER);

  const pending = await bot.pendingOnMe();
  // Cards for everything waiting, so "the oldest" is the real oldest; the rail
  // then shows the first few and links out for the rest.
  const pendingCards = await bot.boards.cards(pending);
  const railCards = pendingCards.slice(0, 4);
  const oldest = Math.max(0, ...pendingCards.map((c) => c.days));

  const teams = [];
  for (const b of bot.boards.teamBusinesses()) {
    const theirs = open.filter((t) => t.business === b && t.owner !== owner);
    teams.push({
      name: b,
      key: await bot.boards.keyFor(b),
      people: bot.d.people.filter((p) => p.business === b).map((p) => p.name).join(", ") || "nobody added yet",
      open: theirs.length,
      attention: theirs.filter((t) => bot.boards.needsAttention(t)).length,
    });
  }

  const nowIso = bot.nowIso();
  const nowMin = toMin(nowIso.slice(11, 16));
  const slots = bot.boards.slots();

  const next = slots.find((x) => x.min > nowMin);

  const nav = await bot.boards.nav(masterKey, "today");

  const finding = pending.length
    ? `${plural(pending.length, "task")} waiting on you${oldest >= 3 ? `, the oldest open ${plural(oldest, "day")}` : ""}.`
    : "Nothing is waiting on you.";

  return (
    <Shell scope="Master board" groups={nav} title="Today">
      <PageHead
        title="Today"
        finding={finding}
        stamp={`${s.timezone.split("/")[1] || s.timezone} · ${bot.boards.updated()}`}
      />

      {s.store === "memory" && (
        <p className="mb-5 rounded-card border border-[#fde68a] bg-[var(--pill-warning-bg)] px-3 py-2 text-small text-[var(--pill-warning-ink)]">
          In-memory store: every task and message here is lost when the server restarts. Set <span className="font-mono">MONGODB_URI</span>{/* taste-skill-ignore: an environment variable name */} before go-live.
        </p>
      )}

      {/* The lead figure answers the sentence under the title. */}
      <Stats items={[
        { label: "Waiting on you", value: pending.length, tone: "negative", caption: "stuck on you, plus your own open tasks" },
        { label: "Needs attention", value: stats.attention, caption: `of ${stats.open} open: stuck, a P1 over a day old, or 7 days` },
        { label: "P1 open", value: stats.p1, caption: "delivered the moment you send them" },
        { label: "Closed", value: stats.doneWeek, caption: "in the last 7 days" },
      ]} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title="The bot's day"
            action={<span className="text-small text-faint">{next ? `next: ${next.what} at ${next.time}` : "done for today"}</span>}
          >
            <DayStrip slots={slots} nowMin={nowMin} />
            <DayList slots={slots} nowMin={nowMin} />
            <p className="mt-3 border-t border-rule pt-3 text-small text-faint">
              Working days {s.workDays}. P1 tasks skip the schedule and go out the moment you send them. Outside
              WhatsApp&rsquo;s 24-hour window the bot sends the approved template and releases the full task as soon as
              the person replies.
            </p>
          </Panel>

          <Panel
            title="Team boards"
            count={`${teams.length} boards`}
            note={<>View only, and never showing your own tasks, so these counts are lower than the ones in the sidebar. Send <span className="font-mono text-muted">newlink EPC</span>{/* taste-skill-ignore: a literal WhatsApp command */} to the bot if a link leaks.</>}
            pad={false}
          >
            <table className="w-full text-body">
              <thead>
                <tr className="text-small text-faint">
                  <th scope="col" className="w-1/2 px-4 pb-2 pt-3 text-left font-normal sm:px-5">Business</th>
                  <th scope="col" className="px-3 pb-2 pt-3 text-right font-normal">Open</th>
                  <th scope="col" className="pb-2 pt-3 text-right font-normal">Attention</th>
                  <th scope="col" className="pb-2 pt-3" />
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.name} className="border-t border-rule">
                    <td className="px-4 py-2.5 align-middle sm:px-5">
                      <a href={`/board/${t.key}`} className="text-body font-medium text-ink hover:text-[var(--accent)]">{t.name}</a>
                      <span className="mt-0.5 block truncate text-small text-muted">{t.people}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle tabular text-ink">{t.open}</td>
                    <td className={`py-2.5 text-right align-middle tabular ${t.attention ? "text-ink" : "text-faint"}`}>
                      {t.attention || "—"}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right align-middle sm:pr-5">
                      <CopyLink path={`/board/${t.key}`} label={`Copy the ${t.name} board link`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title="Waiting on you"
            action={
              <a href={`/board/${masterKey}?tab=attention`} className="press inline-flex h-7 items-center gap-1 rounded-control border border-[var(--control)] px-2 text-small text-muted hover:border-ink hover:text-ink">
                Open board <Icon.chevron width={12} height={12} />
              </a>
            }
            pad={railCards.length === 0}
          >
            {railCards.length === 0 ? (
              <Empty>Nothing is stuck on you and you have no tasks of your own.</Empty>
            ) : (
              <>
                <div className="divide-y divide-rule px-4 sm:px-5">
                  {railCards.map((c) => <TaskCard key={c.id} c={c} ownerView showBusiness compact />)}
                </div>
                {pending.length > railCards.length && (
                  <p className="border-t border-rule px-4 py-2 text-small text-faint sm:px-5">
                    {pending.length - railCards.length} more on the master board.
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel title="Master board" pad={false}>
            <div className="divide-y divide-rule">
              {[
                ["Needs attention", `?tab=attention`, "stuck, overdue, and everything on you", "chevron"],
                ["Mine", `?tab=mine`, "your own open tasks and today's score", "chevron"],
                ["Messages", `?tab=messages`, "every message word for word, voice notes too", "chevron"],
                ["CSV backup", "/export", "every task ever, as a spreadsheet", "download"],
              ].map(([label, q, sub, glyph]) => {
                const Glyph = Icon[glyph];
                return (
                  <a key={label} href={`/board/${masterKey}${q}`}
                    className="press flex items-center gap-3 px-4 py-2.5 hover:bg-active/60 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium">{label}</span>
                      <span className="block truncate text-small text-muted">{sub}</span>
                    </span>
                    <Glyph className="flex-none text-faint" />
                  </a>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="What you can send the bot" className="mt-6">
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {helpBlocks().map((b, i) => (
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
      </Panel>

      <p className="mt-6 text-small text-faint">
        Webhook <span className="font-mono">/api/webhook</span> · health <span className="font-mono">/api/health</span>
      </p>
    </Shell>
  );
}
