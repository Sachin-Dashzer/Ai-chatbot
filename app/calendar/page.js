// Calendar: the same tasks as the boards, read by day instead of by person.
// A task sits on the day it was assigned and, once closed, also on the day it
// was closed — those are the only two dates a task has. The day panel adds the
// bot's own schedule for that day, so a date ahead still has something to say,
// and what would still be open on it.
import { getBot } from "../../lib/runtime.js";
import { MASTER } from "../../lib/boards.js";
import { MONTHS, weekdayOf, fmtDayMon, workDaySet } from "../../lib/time.js";
import Shell, { PageHead } from "../../components/Shell";
import TaskCard from "../../components/TaskCard";
import { Section, Panel, Empty, Status } from "../../components/ui";

export const dynamic = "force-dynamic";

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const HEAD = ["M", "T", "W", "T", "F", "S", "S"];
const pad = (n) => String(n).padStart(2, "0");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const monthOf = (ymd) => ymd.slice(0, 7);
const monthLabel = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const dayLabel = (ymd) => {
  const w = weekdayOf(ymd);
  return `${w[0].toUpperCase()}${w.slice(1)} ${fmtDayMon(ymd)}`;
};
const daysIn = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
const shiftMonth = (ym, n) => {
  let y = +ym.slice(0, 4);
  let m = +ym.slice(5, 7) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}`;
};

export default async function CalendarPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const bot = getBot();
  await globalThis.__ankitDeskDemo; // the demo seed, if it is still running
  const s = bot.s;
  const today = bot.today();
  const owner = bot.d.owner.name;

  const names = [owner, ...bot.d.people.map((p) => p.name)];
  const who = names.includes(sp.who) ? sp.who : "";
  const link = (ym, d) => `/calendar?m=${ym}&d=${d}${who ? `&who=${encodeURIComponent(who)}` : ""}`;

  const ym = /^\d{4}-\d{2}$/.test(sp.m || "") ? sp.m : monthOf(today);
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(sp.d || "") && monthOf(sp.d) === ym
    ? sp.d
    : ym === monthOf(today) ? today : `${ym}-01`;

  const all = (await bot.store.find("tasks", {}, { sort: { id: 1 } }))
    .filter((t) => t.status !== "cancelled" && (!who || t.owner === who));

  // One pass over the month: what was assigned on each day, what was closed on
  // it, what is due at a set time on it, and whether anything assigned that day
  // is now stuck or overdue.
  const byDay = new Map();
  const bucket = (ymd) => {
    let b = byDay.get(ymd);
    if (!b) byDay.set(ymd, (b = { assigned: [], closed: [], timed: [] }));
    return b;
  };
  for (const t of all) {
    const made = t.created_at.slice(0, 10);
    if (monthOf(made) === ym) bucket(made).assigned.push(t);
    if (t.done_at && monthOf(t.done_at) === ym) bucket(t.done_at.slice(0, 10)).closed.push(t);
    if (t.due_at && monthOf(t.due_at) === ym) bucket(t.due_at.slice(0, 10)).timed.push(t);
  }

  const lead = WEEK.indexOf(weekdayOf(`${ym}-01`));
  const work = workDaySet(s.workDays);
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn(ym) }, (_, i) => `${ym}-${pad(i + 1)}`),
  ];

  const monthAssigned = [...byDay.values()].reduce((n, b) => n + b.assigned.length, 0);
  const monthClosed = [...byDay.values()].reduce((n, b) => n + b.closed.length, 0);

  // The selected day
  const day = byDay.get(sel) || { assigned: [], closed: [], timed: [] };
  const assigned = await bot.boards.cards(day.assigned, true);
  const closed = await bot.boards.cards(day.closed, true);
  const timed = await bot.boards.cards([...day.timed].sort((a, b) => a.due_at.localeCompare(b.due_at)), true);
  const isWork = work.has(weekdayOf(sel));
  const slots = isWork ? bot.boards.slots() : [];

  // Who is expected to report on that day, and who is paused through it.
  const due = [];
  const paused = [];
  for (const p of bot.d.people) {
    if (who && p.name !== who) continue;
    if (await bot.cfg.paused(p.name, sel)) paused.push(p.name);
    else if (isWork && (await bot.cfg.checkinDays(p.name)).includes(weekdayOf(sel))) due.push(p.name);
  }

  // From today on, whatever is still open is part of that day too.
  const ahead = sel >= today
    ? await bot.boards.cards(
        all
          .filter((t) => t.status !== "done" && t.created_at.slice(0, 10) <= sel)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        true,
      )
    : [];

  const nav = await bot.boards.nav(await bot.boards.keyFor(MASTER), "calendar");
  const scoped = who ? ` · ${who === owner ? "yours" : who} only` : "";

  return (
    <Shell scope="Master board" sections={nav} title="Calendar">
      <PageHead
        title="Calendar"
        finding={`${plural(monthAssigned, "task")} assigned in ${monthLabel(ym)}, ${monthClosed} closed${scoped}.`}
        stamp={`${s.timezone.split("/")[1] || s.timezone} · ${bot.boards.updated()}`}
      />

      {/* Whose tasks. A link per person, so the screen stays server-rendered. */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {[["", "Everyone"], ...names.map((n) => [n, n === owner ? "You" : n])].map(([v, label]) => (
          <a
            key={v || "all"}
            href={`/calendar?m=${ym}&d=${sel}${v ? `&who=${encodeURIComponent(v)}` : ""}`}
            aria-current={who === v ? "true" : undefined}
            className={`press inline-flex h-7 items-center rounded-control border px-2.5 text-small ${
              who === v
                ? "border-[var(--accent)] bg-[var(--pill-accent-bg)] font-medium text-[var(--pill-accent-ink)]"
                : "border-[var(--control)] text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel
          title={monthLabel(ym)}
          pad={false}
          action={
            <span className="flex items-center gap-1">
              <a
                href={link(shiftMonth(ym, -1), `${shiftMonth(ym, -1)}-01`)}
                aria-label={`Go to ${monthLabel(shiftMonth(ym, -1))}`}
                className="press inline-flex h-7 w-7 items-center justify-center rounded-control border border-[var(--control)] text-muted hover:border-ink hover:text-ink"
              >
                <span aria-hidden>&lsaquo;</span>
              </a>
              <a
                href={link(shiftMonth(ym, 1), `${shiftMonth(ym, 1)}-01`)}
                aria-label={`Go to ${monthLabel(shiftMonth(ym, 1))}`}
                className="press inline-flex h-7 w-7 items-center justify-center rounded-control border border-[var(--control)] text-muted hover:border-ink hover:text-ink"
              >
                <span aria-hidden>&rsaquo;</span>
              </a>
              <a
                href={link(monthOf(today), today)}
                className="press ml-1 inline-flex h-7 items-center rounded-control border border-[var(--control)] px-2 text-small text-muted hover:border-ink hover:text-ink"
              >
                Today
              </a>
            </span>
          }
        >
          <div className="grid grid-cols-7 border-b border-edge">
            {HEAD.map((h, i) => (
              <p key={i} className="py-1.5 text-center text-small text-faint">{h}</p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((ymd, i) => {
              if (!ymd) return <span key={`b${i}`} className="border-b border-r border-rule bg-raised/50" />;
              const b = byDay.get(ymd) || { assigned: [], closed: [], timed: [] };
              const att = b.assigned.some((t) => t.status !== "done" && bot.boards.needsAttention(t));
              const isToday = ymd === today;
              const picked = ymd === sel;
              const off = !work.has(weekdayOf(ymd));
              return (
                <a
                  key={ymd}
                  href={link(ym, ymd)}
                  aria-current={picked ? "date" : undefined}
                  className={`press relative flex min-h-[62px] flex-col gap-1 border-b border-r border-rule p-1.5 sm:min-h-[76px] ${
                    picked ? "bg-[var(--pill-accent-bg)]" : off ? "bg-raised/50 hover:bg-active" : "hover:bg-active"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-small tabular ${
                        isToday ? "bg-[var(--accent)] font-medium text-white" : off ? "text-faint" : "text-ink"
                      }`}
                    >
                      {+ymd.slice(8, 10)}
                    </span>
                    {att && (
                      <span
                        aria-hidden
                        title="something assigned this day is stuck or overdue"
                        className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--negative)]"
                      />
                    )}
                  </span>
                  <span className="mt-auto flex flex-wrap gap-1">
                    {b.assigned.length > 0 && (
                      <span
                        title={`${plural(b.assigned.length, "task")} assigned`}
                        className="rounded-chip bg-[var(--pill-accent-bg)] px-1 text-small font-medium tabular text-[var(--pill-accent-ink)]"
                      >
                        {b.assigned.length}
                      </span>
                    )}
                    {b.closed.length > 0 && (
                      <span
                        title={`${plural(b.closed.length, "task")} closed`}
                        className="rounded-chip bg-[var(--pill-positive-bg)] px-1 text-small tabular text-[var(--pill-positive-ink)]"
                      >
                        {b.closed.length}
                      </span>
                    )}
                    {b.timed.length > 0 && (
                      <span
                        title={`${plural(b.timed.length, "task")} due at a set time`}
                        className="rounded-chip bg-[var(--pill-warning-bg)] px-1 text-small tabular text-[var(--pill-warning-ink)]"
                      >
                        {b.timed.length}
                      </span>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
          <p className="border-t border-edge px-4 py-2 text-small text-faint sm:px-5">
            Left figure: tasks assigned that day. Middle: tasks closed. Amber: tasks due at a set time, which ping
            their owner 5 minutes before. A red dot means something assigned that day is now stuck or overdue.
            Non-working days are shaded.
          </p>
        </Panel>

        <div className="grid min-w-0 content-start gap-6">
          <Panel
            title={dayLabel(sel)}
            action={
              <span className="text-small text-faint">{sel === today ? "today" : sel > today ? "ahead" : "past"}</span>
            }
          >
            {slots.length === 0 ? (
              <Empty>Not a working day — the bot sends nothing on {dayLabel(sel)}.</Empty>
            ) : (
              <dl>
                {slots.map((x) => (
                  <div key={x.time + x.what} className="flex gap-3 border-b border-rule py-2 last:border-0">
                    <dt className="w-[4.5rem] shrink-0 text-body tabular text-ink">{x.time}</dt>
                    <dd className="min-w-0 text-body text-muted">
                      {x.what}
                      {x.kind === "pending" && (
                        <span className="mt-0.5 block text-small text-faint">
                          {due.length ? `reply expected from ${due.join(", ")}` : "no reply expected today"}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {paused.length > 0 && (
              <p className="mt-3 border-t border-rule pt-3 text-small text-faint">
                Paused on this day: {paused.join(", ")}. Nothing reaches them until they are back.
              </p>
            )}
          </Panel>

          {timed.length > 0 && (
            <Section title="Due at a set time" count={timed.length}>
              <div className="rounded-card border border-edge px-4 sm:px-5">
                {timed.map((c) => <TaskCard key={c.id} c={c} ownerView compact />)}
              </div>
            </Section>
          )}

          <Section title="Assigned" count={assigned.length || null}>
            {assigned.length === 0 ? (
              <Empty>Nothing was assigned on {dayLabel(sel)}.</Empty>
            ) : (
              <div className="rounded-card border border-edge px-4 sm:px-5">
                {assigned.map((c) => <TaskCard key={c.id} c={c} ownerView compact />)}
              </div>
            )}
          </Section>

          {closed.length > 0 && (
            <Section title="Closed" count={closed.length}>
              <div className="rounded-card border border-edge px-4 sm:px-5">
                {closed.map((c) => <TaskCard key={c.id} c={c} ownerView compact />)}
              </div>
            </Section>
          )}

          {sel >= today && (
            <Section
              title="Still open on this day"
              count={ahead.length || null}
              action={<Status dot="open">{sel === today ? "now" : "if nothing closes"}</Status>}
            >
              {ahead.length === 0 ? (
                <Empty>Nothing would be left open.</Empty>
              ) : (
                <div className="rounded-card border border-edge px-4 sm:px-5">
                  {ahead.slice(0, 25).map((c) => <TaskCard key={c.id} c={c} ownerView compact />)}
                  {ahead.length > 25 && (
                    <p className="border-t border-rule py-2 text-small text-faint">{ahead.length - 25} more.</p>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </Shell>
  );
}
