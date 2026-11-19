// Calendar: the same tasks as the boards, read by day instead of by person.
// A task sits on the day it was assigned and, once closed, also on the day it
// was closed — those are the only two dates a task has. A date ahead still has
// something to say for itself: the meetings called for it, anything due at a set
// time on it, and what would still be open by then.
import { getBot } from "../../lib/runtime.js";
import { MASTER } from "../../lib/boards.js";
import { MONTHS, weekdayOf, fmtDayMon, fmtTime, workDaySet } from "../../lib/time.js";
import Shell, { PageHead } from "../../components/Shell";
import TaskCard from "../../components/TaskCard";
import { Section, Panel, Empty, Status } from "../../components/ui";

export const dynamic = "force-dynamic";

const REPLY_WORD = { yes: "coming", no: "cannot come", move: "wants another time" };
const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// Three letters, not one: "M T W T F S S" has two T's and two S's.
const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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

// The day marks. The legend below the month renders these same components, so
// a swatch can never drift from the mark it explains.
//
// Tasks assigned is the quantity the calendar is about, so it is a plain ink
// figure; the other two are the exceptions and carry a pale tint of their own
// meaning.
// The figure itself turns red when some of that day's work is now behind. An
// earlier build put a separate red dot beside the date, which fired on every
// past day that still had anything open and so covered half the month: red is
// a signal, not a texture, and a cell carries one mark.
const Assigned = ({ n, behind = false }) => (
  <span
    title={behind ? "some of this day's work is now stuck or overdue" : undefined}
    className={`inline-flex h-4 min-w-[16px] items-center justify-center text-small font-medium tabular ${
      behind ? "text-[var(--negative)]" : "text-ink"
    }`}
  >
    {n}
  </span>
);

const Closed = ({ n }) => (
  <span
    style={{ background: "var(--pill-positive-bg)", color: "var(--pill-positive-ink)" }}
    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-chip px-1 text-small tabular"
  >
    {n}
  </span>
);

// A meeting is the one thing on this calendar that is not a task, so it carries the one hue
// rather than a status tint: it is a fact about the day, not work in a state.
const Meet = ({ n }) => (
  <span
    style={{ background: "var(--hue-soft)", color: "var(--hue)" }}
    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-chip px-1 text-small font-medium tabular"
  >
    {n}
  </span>
);

const Timed = ({ n }) => (
  <span
    style={{ background: "var(--pill-warning-bg)", color: "var(--pill-warning-ink)" }}
    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-chip px-1 text-small tabular"
  >
    {n}
  </span>
);


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
    if (!b) byDay.set(ymd, (b = { assigned: [], closed: [], timed: [], meetings: [] }));
    return b;
  };
  for (const t of all) {
    const made = t.created_at.slice(0, 10);
    if (monthOf(made) === ym) bucket(made).assigned.push(t);
    if (t.done_at && monthOf(t.done_at) === ym) bucket(t.done_at.slice(0, 10)).closed.push(t);
    if (t.due_at && monthOf(t.due_at) === ym) bucket(t.due_at.slice(0, 10)).timed.push(t);
  }

  // Meetings sit on the calendar beside the tasks: they are the other thing with a time on
  // it, and the whole point of putting one in the bot was so it shows up here.
  const meetings = (await bot.store.find("meetings", { status: { $ne: "cancelled" } }, { sort: { at: 1 } }))
    .filter((m) => monthOf(m.at) === ym && (!who || m.with.includes(who) || who === owner));
  for (const m of meetings) bucket(m.at.slice(0, 10)).meetings.push(m);

  const lead = WEEK.indexOf(weekdayOf(`${ym}-01`));
  const work = workDaySet(s.workDays);
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn(ym) }, (_, i) => `${ym}-${pad(i + 1)}`),
  ];

  const monthAssigned = [...byDay.values()].reduce((n, b) => n + b.assigned.length, 0);
  const monthClosed = [...byDay.values()].reduce((n, b) => n + b.closed.length, 0);

  // The selected day
  const day = byDay.get(sel) || { assigned: [], closed: [], timed: [], meetings: [] };
  const assigned = await bot.boards.cards(day.assigned, true);
  const closed = await bot.boards.cards(day.closed, true);
  const timed = await bot.boards.cards([...day.timed].sort((a, b) => a.due_at.localeCompare(b.due_at)), true);

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
            // A filter selection is the neutral pill the navigation uses, not a
            // filled near-black: the one filled button on a screen is its
            // primary action, and choosing whose tasks to see is not that.
            className={`press inline-flex h-7 items-center rounded-control px-2.5 text-small ${
              who === v
                ? "bg-active font-medium text-ink"
                : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* items-start: the month keeps its own height. The previous build let
          it stretch to the day column beside it and held 2,508px of blank. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
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
              const b = byDay.get(ymd) || { assigned: [], closed: [], timed: [], meetings: [] };
              const att = b.assigned.some((t) => t.status !== "done" && bot.boards.needsAttention(t));
              const isToday = ymd === today;
              const picked = ymd === sel;
              const off = !work.has(weekdayOf(ymd));
              return (
                <a
                  key={ymd}
                  href={link(ym, ymd)}
                  aria-current={picked ? "date" : undefined}
                  className={`press-row relative flex min-h-[56px] flex-col border-b border-r border-rule p-2 sm:min-h-[66px] ${
                    picked
                      ? "bg-active font-medium"
                      : off
                        ? "bg-raised/60 hover-row"
                        : "hover-row"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-small tabular ${
                        isToday
                          ? "bg-[var(--hue)] font-semibold text-white"
                          : off
                            ? "text-faint"
                            : "text-ink"
                      }`}
                    >
                      {+ymd.slice(8, 10)}
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    {b.assigned.length > 0 && <Assigned n={b.assigned.length} behind={att} />}
                    {b.closed.length > 0 && <Closed n={b.closed.length} />}
                    {b.timed.length > 0 && <Timed n={b.timed.length} />}
                    {b.meetings.length > 0 && <Meet n={b.meetings.length} />}
                  </span>
                </a>
              );
            })}
          </div>
          {/* A legend whose swatches are the marks themselves, rather than a
              caption naming which figure is which. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-edge px-5 py-3 text-small text-faint">
            <span className="flex items-center gap-1.5">
              <Assigned n={3} /> assigned
            </span>
            <span className="flex items-center gap-1.5">
              <Closed n={2} /> closed
            </span>
            <span className="flex items-center gap-1.5">
              <Timed n={1} /> due at a set time, pings 5 minutes before
            </span>
            <span className="flex items-center gap-1.5">
              <Meet n={1} /> meeting
            </span>
            <span className="flex items-center gap-1.5">
              <Assigned n={3} behind /> some of it now behind
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3.5 w-5 rounded-[3px] border border-[var(--border)] bg-raised" />
              non-working day
            </span>
          </div>
        </Panel>

        <div className="grid min-w-0 content-start gap-6">
          {day.meetings.length > 0 && (
            <Section title="Meetings" count={day.meetings.length}>
              <div className="overflow-hidden rounded-card border border-edge bg-surface px-4 sm:px-5">
                {day.meetings.map((m) => {
                  const r = m.responses || {};
                  const answered = m.with.filter((n) => r[n]);
                  return (
                    <div key={m.id} className="border-b border-rule py-3 last:border-0">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-body text-ink">
                          {/* taste-skill-ignore: a meeting id */}
                          <span className="font-mono text-meta text-faint">M{m.id}</span>{" "}
                          {m.title || "Meeting"}
                        </span>
                        <span className="flex-none text-meta tabular text-ink">{fmtTime(m.at)}</span>
                      </p>
                      <p className="mt-1 text-meta text-muted">Ankit, {m.with.join(", ")}</p>
                      {answered.length > 0 && (
                        <p className="mt-1 text-small text-faint">
                          {m.with
                            .map((n) => n + ": " + (REPLY_WORD[r[n]] || "no answer yet"))
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

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
