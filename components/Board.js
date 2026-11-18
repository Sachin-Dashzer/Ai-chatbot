// The two boards. Both render inside the sheet; the frame and the navigation
// come from Shell. A team board is view-only; the master board can tick a task.
import TaskCard from "./TaskCard";
import { PageHead } from "./Shell";
import { Icon, Stats, Section, Empty } from "./ui";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function statItems(s, caption = {}) {
  return [
    { label: "Open", value: s.open, caption: caption.open || "not closed or cancelled" },
    { label: "Needs attention", value: s.attention, tone: "negative", caption: "stuck, or open 7 days or more" },
    { label: "Stuck", value: s.stuck, caption: "waiting on you, a client or a vendor" },
    { label: "Closed", value: s.doneWeek, caption: "in the last 7 days" },
  ];
}

export function Pill({ href, on, children }) {
  return (
    <a
      href={href}
      aria-current={on ? "true" : undefined}
      className={`press inline-flex h-8 items-center whitespace-nowrap rounded-control border px-2.5 text-body ${
        on
          ? "border-ink bg-ink text-[var(--surface)]"
          : "border-[var(--control)] text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </a>
  );
}

function Rows({ cards, empty, ...rest }) {
  if (!cards.length) return <Empty>{empty}</Empty>;
  return (
    <div className="border-t border-rule">
      {cards.map((c) => <TaskCard key={c.id} c={c} {...rest} />)}
    </div>
  );
}

// ── Team board ───────────────────────────────────────────────────────────
export function TeamBoard({ data }) {
  const att = data.attention.length;
  const oldest = Math.max(0, ...data.attention.map((c) => c.days || 0));
  const finding = att
    ? `${plural(att, "task")} need attention${oldest >= 3 ? `; the oldest has been open ${plural(oldest, "day")}` : ""}.`
    : "Nothing is stuck or overdue.";

  return (
    <>
      <PageHead
        title={data.title}
        finding={finding}
        stamp={`Updated ${data.updated}`}
      />

      <Stats items={statItems(data.stats)} />

      <div className="mt-7 grid gap-x-6 gap-y-7 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Section title="Needs attention" count={att ? `${att}` : null}>
            <Rows cards={data.attention} empty="Nothing stuck or overdue." />
          </Section>

          {data.groups.map((g) => (
            <Section key={g.name} title={g.name} count={`${g.cards.length} open`} className="mt-7">
              <Rows cards={g.cards} empty="No open tasks." />
            </Section>
          ))}
        </div>

        <div className="min-w-0">
          <Section title="Closed in the last 7 days" count={data.done.length || null}>
            <Rows cards={data.done} empty="Nothing closed yet this week." compact />
          </Section>

          <p className="mt-6 rounded-card border border-edge bg-raised px-3 py-2.5 text-meta text-muted">
            This board is view only. Reply to the bot on WhatsApp with your status, &ldquo;1 done, 2 working,
            3 stuck&rdquo;, and it lands here within a minute.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Master board ─────────────────────────────────────────────────────────
function masterFinding(data) {
  if (data.tab === "mine") return data.score ? `${data.score} of your own tasks.` : "You have no tasks of your own.";

  const first = data.sections?.[0];
  if (data.tab === "attention" && data.view === "open") {
    const n = first?.cards.length || 0;
    const oldest = Math.max(0, ...(first?.cards.map((c) => c.days || 0) || [0]));
    return n
      ? `Everything still open, whoever it is with${oldest >= 3 ? `. The oldest has been open ${plural(oldest, "day")}` : ""}.`
      : "Nothing is open. Every task has been closed.";
  }
  if (data.tab === "attention" && data.view === "closed") {
    const n = data.closedTotal || 0;
    if (!n) return "Nothing has been closed yet.";
    return `${plural(n, "task")} finished so far${data.more ? `. The newest ${first?.cards.length} are below; the rest are in the CSV` : ""}.`;
  }
  if (data.tab === "attention") {
    const onMe = first?.cards.length || 0;
    const team = data.sections?.[1]?.cards.length || 0;
    const oldest = Math.max(0, ...(first?.cards.map((c) => c.days || 0) || [0]));
    if (!onMe) return team ? `Nothing is waiting on you. ${plural(team, "task")} are stuck or overdue with the team.` : "Nothing is stuck and nothing is waiting on you.";
    return `${plural(onMe, "task")} waiting on you${oldest >= 3 ? `, the oldest open ${plural(oldest, "day")}` : ""}. ${plural(team, "task")} stuck or overdue with the team.`;
  }
  const open = data.stats?.open || 0;
  const people = data.sections?.filter((s) => s.cards.length).length || 0;
  return `${plural(open, "task")} open across ${people} ${people === 1 ? "person" : "people"}.`;
}

export function MasterBoard({ data, boardKey }) {
  const showBusiness = data.tab === "attention" || data.tab === "mine";

  return (
    <>
      <PageHead
        title={data.title}
        finding={masterFinding(data)}
        stamp={`Updated ${data.updated}`}
        actions={
          <a
            href={`/board/${boardKey}/export`}
            className="press inline-flex h-8 items-center gap-1.5 rounded-control border border-[var(--control)] px-2.5 text-small text-muted hover:border-ink hover:text-ink"
          >
            <Icon.download width={14} height={14} />
            CSV backup
          </a>
        }
      />

      {/* No tab strip on a phone: every destination is in the menu button's
          sheet, with its counts, and a second scrolling row of the same links
          only cut the last business in half. The row below is this screen's own
          filter, which the sheet does not carry. */}

      {/* Which tasks this screen is showing. The same list, filtered three ways:
          what needs chasing, everything open, everything finished. */}
      {data.views && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-small text-faint">Showing</span>
          {data.views.map(([k, label, count]) => (
            <Pill
              key={k}
              href={`/board/${boardKey}?tab=${data.tab}${k === "attention" ? "" : `&view=${k}`}`}
              on={k === data.view}
            >
              {label}
              <span className="ml-1.5 tabular opacity-70">{count}</span>
            </Pill>
          ))}
        </div>
      )}

      {data.stats && <Stats items={statItems(data.stats)} />}

      {data.sections?.map((s, i) => (
        <Section key={i} title={s.title} count={s.cards.length || null} className="mt-7">
          <Rows cards={s.cards} empty={s.empty || "Nothing here."} boardKey={boardKey} tab={data.tab}
            view={data.view} showBusiness={showBusiness} />
        </Section>
      ))}

      {data.more > 0 && (
        <p className="mt-3 text-small text-faint">
          {data.more} older completed {data.more === 1 ? "task is" : "tasks are"} not shown. The CSV backup above has
          every task ever.
        </p>
      )}
    </>
  );
}

