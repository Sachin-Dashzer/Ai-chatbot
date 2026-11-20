// One task, as a counterfoil. View-only on team boards; on the master board it
// gets a tick and the words that came back.
//
// Four decisions hold the list together:
//
//  · Every description starts on one left edge. An earlier build put a status
//    chip in front of the text, so the identity column began 110px further
//    right on some rows than on others.
//  · One mark per row, and it carries the fact that varies. A column of
//    identical "With you" stamps beside a column of ages said one thing twice
//    and turned the list into a grid of boxes, so the stamp absorbed the age:
//    where the heading already names the state, the stamp is the age itself.
//  · A closed line is struck through, the way a clerk closes it, and its stamp
//    turns green. Nothing else in the row changes.
//  · Below lg the row folds to two lines — identity on line one, the same
//    facts in grey on line two — with the stamp holding the right edge of
//    line one, away from the thumb.
import { Icon, Stamp, Tag } from "./ui";

function ActionForm({ boardKey, tab, view, id, action, children, className, label }) {
  return (
    <form method="post" action={`/board/${boardKey}/act`} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tab" value={tab} />
      {view && <input type="hidden" name="view" value={view} />}
      <button name="action" value={action} className={className} aria-label={label} title={label}>
        {children}
      </button>
    </form>
  );
}

// A stamp is struck only where the state is news: it is waiting on Ankit, it
// is held on someone outside the team, or nothing has moved for a week. Six
// identical boxes down a screen were the status pill this world refuses, so an
// ordinary open record now carries its age as plain text and no box at all.
//
// `stated` means the section heading already names the state, so the words in
// the stamp would repeat the heading; there only an age past a week is news.
function stampFor(c, ownerView, stated) {
  // Closed: the struck-through line already says it. A second mark would be
  // the pill again, in green.
  if (c.status === "done") return null;
  const old = c.ageLevel === "red";
  if (c.status === "stuck" && c.stuckOn === "ankit" && !stated) {
    return (
      <Stamp
        state={ownerView ? "With you" : "With Ankit"}
        when={c.ageText}
        title="nothing moves until he answers"
      />
    );
  }
  if (c.status === "stuck" && c.stuckOn !== "ankit") {
    return <Stamp state="Held" when={c.ageText} title="waiting on someone outside the team" />;
  }
  if (old) {
    return <Stamp state="No movement" when={c.ageText} title={`open ${c.ageText}`} />;
  }
  return null;
}

// What an ordinary record carries where the stamp would be: its age, plainly,
// and the date it closed when it is closed.
function ageText(c) {
  if (c.status === "done") {
    const took = c.took == null ? "" : c.took === 0 ? " · same day" : ` · took ${c.took}d`;
    return `closed ${c.doneOn}${took}`;
  }
  return c.ageText;
}

// The counterfoil: every word that came back on this record, verbatim, with
// its time — on the carbon duplicate, which is where quoted words live.
function RemarkList({ remarks }) {
  return (
    <ul className="mt-2">
      {remarks.map((r, i) => (
        <li
          key={i}
          className="border-l-2 border-carbon-rule bg-carbon px-3 py-2 text-meta [&+li]:border-t [&+li]:border-t-carbon-rule"
        >
          <span className="furniture">{r.person}</span>
          {r.status ? <span className="text-faint"> · {r.status.toLowerCase()}</span> : ""}
          <span className="px-1 text-faint">·</span>
          <span className="tabular text-faint">{r.when}</span>
          <span className="mt-0.5 block text-body text-ink">{r.text || "—"}</span>
        </li>
      ))}
    </ul>
  );
}

// `compact` keeps the row on one stacked column — for the narrow rails, where
// splitting it would squeeze the description to three words a line.
export default function TaskCard({
  c,
  boardKey,
  tab,
  view,
  compact = false,
  hideStatus = false,
  // A column that holds the same value on every row is a dead column: on
  // Ankit's own board every task is his, so the owner slot goes.
  hideOwner = false,
  ownerView = Boolean(boardKey),
}) {
  const master = Boolean(boardKey);
  const who = ownerView && c.isMine ? "You" : c.owner;
  const done = c.status === "done";
  const mark = stampFor(c, ownerView, hideStatus);
  const age = <span className="tabular text-small text-faint">{ageText(c)}</span>;

  return (
    <div className="flex items-start gap-3 border-b border-rule py-3 last:border-0">
      {master && !done && (
        <ActionForm
          boardKey={boardKey}
          tab={tab}
          view={view}
          id={c.id}
          action="done"
          label={`Mark #${c.id} done`}
          className="press group mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[2px] border border-[var(--control)] bg-surface hover:border-furniture"
        >
          <Icon.check
            width={12}
            height={12}
            strokeWidth={2.4}
            className="text-furniture opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </ActionForm>
      )}

      <div className={`min-w-0 flex-1 ${compact ? "" : "lg:flex lg:items-start lg:gap-4"}`}>
        <div className={`min-w-0 ${compact ? "" : "lg:flex-1"}`}>
          {/* Line one: the work, with its mark holding the right edge. */}
          <div className="flex items-start justify-between gap-3">
            <p className={`min-w-0 text-body ${done ? "struck text-muted" : "text-ink"}`}>
              {/* taste-skill-ignore: a task id, which is an identifier */}
              <span className="font-narrow tabular text-meta text-faint">#{c.id}</span>{" "}
              {c.description}
            </p>
            {!compact && <span className="flex-none lg:hidden">{mark || age}</span>}
          </div>

          {/* Line two: who it sits with, the clock time it carries, the note,
              and the words that came back. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {!hideOwner && <span className="furniture text-meta">{who}</span>}
            {c.due && !done && (
              <Tag tone="warning" title="the reminder goes out 5 minutes before this">
                {c.due}
              </Tag>
            )}
            {c.note && <p className="min-w-0 text-meta text-muted">{c.note}</p>}
            {master && c.remarks.length > 0 && (
              <details className="min-w-0 flex-none">
                <summary className="press inline-flex items-center gap-1 text-meta text-faint hover:text-ink">
                  <Icon.chevron className="chev" width={12} height={12} />
                  {c.remarks.length} remark{c.remarks.length === 1 ? "" : "s"}
                </summary>
                <RemarkList remarks={c.remarks} />
              </details>
            )}
            {compact && <span className="ml-auto flex-none">{mark || age}</span>}
          </div>
        </div>

        {/* At lg the mark moves to its own fixed slot, so the stamps read down
            the page as one column. */}
        {!compact && (
          <div className="hidden flex-none lg:block lg:w-[104px] lg:text-right">
            <span className="inline-flex justify-end">{mark || age}</span>
          </div>
        )}
      </div>
    </div>
  );
}
