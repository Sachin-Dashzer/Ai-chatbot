// One task, as a list row. View-only on team boards; on the master board it
// gets a tick and its remark history.
//
// Three decisions hold the list together:
//
//  · Every description starts on one left edge. The previous build put a status
//    chip in front of the text, so the identity column began 110px further
//    right on some rows than on others.
//  · The state and the owner sit in one fixed right slot and the age in
//    another, so the states read down the page as a column and the ages line up
//    digit for digit.
//  · The note and the remark toggle share line two, so a row with a history is
//    no taller than a row with a note and the list keeps one pitch.
//
// Below lg the row folds to two lines, the way a table becomes a list on a
// phone: identity on line one, the same facts in grey on line two.
import { Icon, Status, Tag } from "./ui";

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

function statusMark(c, ownerView) {
  if (c.status === "done") return null;
  if (c.status === "stuck") {
    return c.stuckOn === "ankit" ? (
      <Status dot="negative">{ownerView ? "Waiting on you" : "Waiting on Ankit"}</Status>
    ) : (
      <Status dot="warning">Stuck</Status>
    );
  }
  if (c.status === "working") return <Status dot="muted">Working</Status>;
  return <Status dot="open">Not started</Status>;
}

function RemarkList({ remarks }) {
  return (
    <ul className="mt-2 space-y-2.5 border-l border-edge pl-3">
      {remarks.map((r, i) => (
        <li key={i} className="text-meta">
          <span className="tabular text-faint">{r.when}</span>
          <span className="px-1 text-faint">·</span>
          <span className="text-faint">
            {r.person}
            {r.status ? ` · ${r.status.toLowerCase()}` : ""}
          </span>
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
  const age = done ? `done ${c.doneOn}` : c.ageText;
  const sub =
    done && c.took != null
      ? c.took === 0
        ? "same day"
        : `took ${c.took} day${c.took === 1 ? "" : "s"}`
      : null;
  // The one red mark a row may carry: an age past a week. Nothing else in the
  // row competes with it.
  const old = !done && c.ageLevel === "red";
  const mark = hideStatus ? null : statusMark(c, ownerView);
  const hasLineTwo = Boolean(c.note) || (master && c.remarks.length > 0);

  const meta = (
    <>
      <span className={`min-w-0 ${compact ? "" : hideOwner ? "lg:flex-none" : "lg:w-[132px] lg:flex-none"}`}>
        {mark && <span className={hideOwner ? "block" : "mb-1 block"}>{mark}</span>}
        {!hideOwner && <span className="block truncate text-meta text-muted">{who}</span>}
      </span>
      <span
        className={`flex-none self-start text-right text-meta tabular ${
          compact ? "" : "lg:w-[78px]"
        }`}
      >
        <span className={old ? "font-medium text-[var(--negative)]" : "text-muted"}>{age}</span>
        {sub && <span className="block text-small text-faint">{sub}</span>}
      </span>
    </>
  );

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
          className="press group mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[4px] border border-[var(--control)] bg-surface hover:border-[var(--positive)]"
        >
          <Icon.check
            width={12}
            height={12}
            strokeWidth={2.4}
            className="text-[var(--positive)] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </ActionForm>
      )}

      <div className={`min-w-0 flex-1 ${compact ? "" : "lg:flex lg:items-start lg:gap-4"}`}>
        <div className={`min-w-0 ${compact ? "" : "lg:flex-1"}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {c.due && !done && (
              <Tag tone="warning" title="the reminder goes out 5 minutes before this">
                {c.due}
              </Tag>
            )}
            <p className="min-w-0 text-body text-ink">
              {/* taste-skill-ignore: a task id, which is an identifier */}
              <span className="font-mono text-meta text-faint">#{c.id}</span> {c.description}
            </p>
          </div>

          {hasLineTwo && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
            </div>
          )}

          {/* Split at lg: the same facts move to their own fixed right slots. */}
          {!compact && (
            <p className="mt-1.5 flex items-baseline justify-between gap-4 lg:hidden">{meta}</p>
          )}
        </div>

        {compact ? (
          <p className="mt-1 flex items-baseline justify-between gap-4">{meta}</p>
        ) : (
          <div className="hidden lg:flex lg:items-start lg:gap-4">{meta}</div>
        )}
      </div>
    </div>
  );
}
