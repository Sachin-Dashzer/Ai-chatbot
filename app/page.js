// Home: the live dashboard entry point – board links, today's numbers, and what the bot does.
import { getBot } from "../lib/runtime.js";
import { HELP } from "../lib/bot.js";
import { MASTER } from "../lib/boards.js";
import { Stats, Pill } from "../components/Board";

export const dynamic = "force-dynamic";

// HELP is the single source of truth for the WhatsApp commands; *word* means bold.
function Rich({ line }) {
  return line.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 ? <strong key={i} className="font-semibold text-stone-900 dark:text-stone-100">{part}</strong> : part);
}

function HelpBlock() {
  const blocks = [];
  for (const line of HELP.split("\n").slice(1)) {
    if (!line) { blocks.push({ head: null, items: [] }); continue; }
    if (!blocks.length) blocks.push({ head: null, items: [] });
    const b = blocks[blocks.length - 1];
    // short "Commands:" style lines become the block heading; a full sentence stays body text
    if (!b.items.length && line.length <= 30 && (line.endsWith(":") || /^\*[^*]+\*$/.test(line))) b.head = line.replace(/[*:]/g, "");
    else b.items.push(line);
  }
  return (
    <div className="space-y-4">
      {blocks.filter((b) => b.items.length).map((b, i) => (
        <div key={i}>
          {b.head && <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{b.head}</h3>}
          <ul className="space-y-1">
            {b.items.map((it, j) => (
              <li key={j} className="text-[14px] leading-snug text-stone-600 dark:text-stone-300">
                <Rich line={it.replace(/^• /, "")} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Row({ href, title, sub, right }) {
  return (
    <a href={href} className="flex items-center gap-3 px-3.5 py-3 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-stone-50 dark:hover:bg-stone-700/40">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-stone-500 dark:text-stone-400">{sub}</span>
      </span>
      {right}
      <span aria-hidden className="text-stone-400 dark:text-stone-500">&rsaquo;</span>
    </a>
  );
}

function Count({ n, label, tone }) {
  if (!n) return null;
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${tone === "red"
      ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200"
      : "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300"}`}>{n} {label}</span>
  );
}

export default async function Home() {
  const bot = getBot();
  await globalThis.__ankitDeskDemo; // demo seed, if it is still running
  const owner = bot.d.owner.name;
  const open = await bot.openTasks();
  const stats = bot.boards.stats(open, await bot.boards.doneWeek());
  const masterKey = await bot.boards.keyFor(MASTER);

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

  const s = bot.s;
  const schedule = [
    [s.briefTime, `Your brief: yesterday's closures, what is stuck, today's P1s`],
    [s.batchTimes.split(",").join(" & "), "Held P2 tasks go out, one message per person"],
    [s.checkinTime, "Check-in: each person gets their full open list"],
    [s.nudgeTime, "One reminder to anyone who has not replied"],
    ["any time", "P1 tasks are delivered the moment you send them"],
  ];

  return (
    <main className="mx-auto max-w-2xl px-3.5 pb-16 pt-6">
      <header className="mb-5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Ankit Desk</h1>
        <p className="mt-1 text-[13px] text-stone-500 dark:text-stone-400">
          Running · {s.timezone} · {bot.boards.updated()}
          {s.store === "memory" && <> · <span className="text-amber-700 dark:text-amber-400">in-memory store, data resets on restart</span></>}
        </p>
      </header>

      <Stats s={stats} />

      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold">Boards</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
          <Row href={`/board/${masterKey}`} title="Master board" sub="Everything, with tick, P1 / P2 and remarks — only for you"
            right={<Count n={stats.attention} label="need you" tone="red" />} />
          <div className="border-t border-stone-200 px-3.5 pb-3 pt-2.5 dark:border-stone-700">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
              <Pill href={`/board/${masterKey}?tab=attention`}>Needs attention</Pill>
              <Pill href={`/board/${masterKey}?tab=mine`}>Mine</Pill>
              <Pill href={`/board/${masterKey}?tab=messages`}>Messages</Pill>
              <Pill href={`/board/${masterKey}/export`}>CSV backup</Pill>
            </div>
          </div>
        </div>

        <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Team boards <span className="font-normal normal-case tracking-normal">· view only, share one per team</span>
        </h3>
        <div className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-800">
          {teams.map((t) => (
            <Row key={t.name} href={`/board/${t.key}`} title={t.name} sub={t.people}
              right={<span className="flex gap-1.5">
                <Count n={t.attention} label="stuck" tone="red" />
                <Count n={t.open} label="open" />
              </span>} />
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-2 text-[15px] font-semibold">The day, on its own</h2>
        <dl className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
          {schedule.map(([when, what]) => (
            <div key={when} className="flex gap-3 border-b border-stone-200 px-3.5 py-2.5 last:border-0 dark:border-stone-700">
              <dt className="w-[6.5rem] shrink-0 text-[13px] font-medium tabular-nums text-stone-500 dark:text-stone-400">{when}</dt>
              <dd className="text-[14px] leading-snug">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 px-0.5 text-[13px] text-stone-500 dark:text-stone-400">
          Working days {s.workDays}. Outside WhatsApp&rsquo;s 24-hour window the bot sends an approved template and releases
          the full task the moment the person taps View.
        </p>
      </section>

      <section className="mt-7">
        <h2 className="mb-2.5 text-[15px] font-semibold">What you can send the bot</h2>
        <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-3.5 dark:border-stone-700 dark:bg-stone-800">
          <HelpBlock />
        </div>
      </section>

      <p className="mt-7 text-center text-xs text-stone-400 dark:text-stone-500">
        Webhook <code className="font-mono">/api/webhook</code> · health <code className="font-mono">/api/health</code>
      </p>
    </main>
  );
}
