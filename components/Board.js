// The two boards. Both render inside the canvas; the frame and the navigation
// come from Shell. A team board is view-only; the master board can tick a task.
//
// Two structural rules hold on both:
//
//  · A list of short rows does not span 1240px. A five-column table stretched
//    across the canvas leaves a 500px void between a task and its owner, so
//    every list here pairs with a rail and the rows sit at about 800px. The
//    exception is a full list of every task, which is long enough to earn the
//    width.
//  · A section states its own count and its rows do not repeat it. The
//    previous build drew a four-cell figure strip in which three cells named a
//    panel directly below, and a status chip on every row of a section whose
//    heading already said that status.
import TaskCard from "./TaskCard";
import { PageHead, Band } from "./Shell";
import { Icon, Panel, Section, Empty, Lead, Track, Tabs, MiniLink } from "./ui";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Rows({ cards, empty, ...rest }) {
  if (!cards.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-hidden rounded-card border border-edge bg-surface px-4 sm:px-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0">
      {cards.map((c) => (
        <TaskCard key={c.id} c={c} {...rest} />
      ))}
    </div>
  );
}

// The rail's list: closed work, which is the one thing a board full of open
// work cannot show.
function ClosedRail({ cards, total, className = "" }) {
  return (
    <Section
      title="Closed in the last 7 days"
      count={total || null}
      className={className}
    >
      {cards.length === 0 ? (
        <Empty>Nothing closed yet this week.</Empty>
      ) : (
        <div className="overflow-hidden rounded-card border border-edge bg-surface lg:rounded-none lg:border-0 lg:bg-transparent px-4">
          {cards.map((c) => (
            <TaskCard key={c.id} c={c} ownerView compact />
          ))}
        </div>
      )}
    </Section>
  );
}

// Who is carrying what. It rides beside the full open list, where the table
// would otherwise span the canvas, and answers the question that list raises.
function LoadRail({ rows, title = "Open per person", unit = "" }) {
  const most = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Section title={title} count={rows.length}>
      <div className="overflow-hidden rounded-card border border-edge bg-surface lg:rounded-none lg:border-0 lg:bg-transparent px-4">
        {rows.map((r) => (
          <div key={r.name} className="border-b border-rule py-2.5 last:border-0">
            <p className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-body text-ink">{r.name}</span>
              <span className="flex-none text-meta tabular text-muted">
                {r.behind > 0 && (
                  <span className="text-[var(--negative)]">{r.behind} behind</span>
                )}
                {r.behind > 0 && <span className="px-1 text-faint">·</span>}
                {r.open}
              </span>
            </p>
            {/* A 2px proportional bar, grey, so "most loaded first" is seen and
                not only read. */}
            <span
              aria-hidden
              className="mt-1.5 block h-[2px] rounded-full bg-[var(--control)]"
              style={{ width: `${Math.round((r.open / most) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Team board ───────────────────────────────────────────────────────────
export function TeamBoard({ data }) {
  const att = data.attention.length;
  const oldest = Math.max(0, ...data.attention.map((c) => c.days || 0));

  return (
    <>
      <Band>
        <PageHead
          title={data.title}
          finding={`${data.stats.open} open across the team, ${data.stats.doneWeek} closed in the last 7 days.`}
          stamp={`Updated ${data.updated}`}
        />
      </Band>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0">
          <Panel pad={false} className="mb-6">
            <div className={`px-5 py-4 ${att ? "border-b border-edge" : ""}`}>
              <Lead value={att} label="Behind">
                {att
                  ? `${att === 1 ? "task is" : "tasks are"} stuck, or have gone a week without moving` +
                    (oldest >= 3 ? `. The oldest has been open ${plural(oldest, "day")}.` : ".")
                  : "Nothing is stuck and nothing has gone a week without moving."}
              </Lead>
            </div>
            {att > 0 && (
              <div className="px-5">
                {data.attention.map((c) => (
                  <TaskCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </Panel>

          {data.byPerson.map((p, i) => (
            <Section
              key={p.name}
              title={p.name}
              count={`${p.cards.length} open`}
              className={i ? "mt-6" : ""}
            >
              <Rows cards={p.cards} empty="No open tasks." />
            </Section>
          ))}
        </div>

        <div className="min-w-0 xl:sticky xl:top-8">
          <ClosedRail cards={data.done} total={data.done.length} />

          <p className="mt-6 rounded-card border border-edge bg-surface px-4 py-3 text-meta leading-snug text-muted">
            This board is view only. Reply to the bot on WhatsApp with your status —
            &ldquo;1 done, 2 working, 3 stuck&rdquo; — and it lands here within a minute.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Master board ─────────────────────────────────────────────────────────
function masterFinding(data) {
  if (data.tab === "mine") {
    return data.score ? `${data.score}.` : "You have no tasks of your own.";
  }

  const first = data.sections?.[0];
  if (data.tab === "attention" && data.view === "open") {
    const n = first?.cards.length || 0;
    const oldest = Math.max(0, ...(first?.cards.map((c) => c.days || 0) || [0]));
    return n
      ? `Everything still open, whoever it is with${
          oldest >= 3 ? `. The oldest has been open ${plural(oldest, "day")}` : ""
        }.`
      : "Nothing is open. Every task has been closed.";
  }
  if (data.tab === "attention" && data.view === "closed") {
    const n = data.closedTotal || 0;
    if (!n) return "Nothing has been closed yet.";
    return `${plural(n, "task")} finished so far${
      data.more ? `. The newest ${first?.cards.length} are below; the rest are in the CSV` : ""
    }.`;
  }
  if (data.tab === "attention") {
    const onMe = first?.cards.length || 0;
    const team = data.sections?.[1]?.cards.length || 0;
    const oldest = Math.max(0, ...(first?.cards.map((c) => c.days || 0) || [0]));
    if (!onMe) {
      return team
        ? `Nothing is waiting on you. ${plural(team, "task")} are stuck or overdue with the team.`
        : "Nothing is stuck and nothing is waiting on you.";
    }
    return `${onMe === 1 ? "task is" : "tasks are"} waiting on you${
      oldest >= 3 ? `, the oldest open ${plural(oldest, "day")}` : ""
    }. ${plural(team, "task")} stuck or overdue with the team.`;
  }
  const open = data.stats?.open || 0;
  const people = data.sections?.filter((s) => s.cards.length).length || 0;
  return `${plural(open, "task")} open across ${people} ${people === 1 ? "person" : "people"}.`;
}

function DayTrack({ day }) {
  if (!day || !day.total) return null;
  return (
    <section className="mt-8">
      <p className="furniture mb-2 text-meta">Your day</p>
      <Track
        ratio={day.done / day.total}
        left={`${day.done} of ${day.total} closed`}
        right={day.done === day.total ? "all clear" : `${day.total - day.done} still open`}
      />
    </section>
  );
}

export function MasterBoard({ data, boardKey }) {
  // Every list here pairs with a rail, so no table stretches the full canvas.
  // The archive of completed work is the exception: it is the one list long
  // enough to earn the width, and it is read rarely.
  const paired = data.tab === "mine" || data.tab === "attention";
  const main = paired ? data.sections.slice(0, data.tab === "mine" ? 1 : 2) : data.sections;
  const rail = data.tab === "mine" ? data.sections[1] : null;
  const load =
    data.view === "open" ? data.load : data.view === "closed" ? data.closedLoad : null;

  return (
    <>
      <Band>
      <PageHead
        title={data.title}
        finding={
          (data.tab === "attention" && data.view === "attention") || data.tab === "mine"
            ? null
            : masterFinding(data)
        }
        stamp={`Updated ${data.updated}`}
        actions={
          <MiniLink href={`/board/${boardKey}/export`}>
            <Icon.download width={13} height={13} />
            CSV backup
          </MiniLink>
        }
      />

      {/* Which tasks this screen is showing: the same list filtered three ways.
          Underline tabs on a full-width rule — the previous build used filled
          black pills, which read louder than the data they filtered. */}
      {data.views && (
        <Tabs
          className="mb-6"
          items={data.views.map(([k, label, count]) => ({
            href: `/board/${boardKey}?tab=${data.tab}${k === "attention" ? "" : `&view=${k}`}`,
            label,
            count,
            on: k === data.view,
          }))}
        />
      )}

      {/* The screen answers one question, and its answer is the largest
          figure on the page: everything else here is smaller than this. */}
      {data.tab === "attention" && data.view === "attention" && (
        <Lead value={data.sections?.[0]?.cards.length || 0} label="Waiting on you">
          {masterFinding(data)}
        </Lead>
      )}
      {data.tab === "mine" && (
        <Lead value={data.sections?.[0]?.cards.length || 0} label="Open on you" tone="neutral">
          {masterFinding(data)}
        </Lead>
      )}
      </Band>

      <div
        className={
          paired ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_316px]" : ""
        }
      >
        <div className="min-w-0">
          {main?.map((s, i) => (
            <Section
              key={i}
              title={s.title}
              count={s.cards.length || null}
              className={i ? "mt-6" : ""}
            >
              {/* The heading names the state, so the rows do not repeat it. */}
              <Rows
                cards={s.cards}
                empty={s.empty || "Nothing here."}
                boardKey={boardKey}
                tab={data.tab}
                view={data.view}
                hideStatus={s.hideStatus}
                hideOwner={data.tab === "mine"}
              />
            </Section>
          ))}

          {data.more > 0 && (
            <p className="mt-3 text-small text-faint">
              {data.more} older completed {data.more === 1 ? "task is" : "tasks are"} not shown. The
              CSV backup above has every task ever.
            </p>
          )}
        </div>

        {/* The rail travels with a list that can run far past it, rather than
            being stranded at the top of 500px of ground. */}
        {paired && (
          <div className="min-w-0 xl:sticky xl:top-8">
            {rail ? (
              <Section title={rail.title} count={rail.cards.length || null}>
                {rail.cards.length === 0 ? (
                  <Empty>{rail.empty}</Empty>
                ) : (
                  <div className="overflow-hidden rounded-card border border-edge bg-surface px-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0">
                    {rail.cards.map((c) => (
                      <TaskCard key={c.id} c={c} ownerView compact hideOwner={data.tab === "mine"} />
                    ))}
                  </div>
                )}
              </Section>
            ) : load ? (
              <LoadRail
                rows={load}
                title={data.view === "closed" ? "Closed per person" : "Open per person"}
              />
            ) : (
              <ClosedRail cards={data.recent || []} total={data.recentTotal} />
            )}
            <DayTrack day={data.day} />
          </div>
        )}
      </div>
    </>
  );
}
