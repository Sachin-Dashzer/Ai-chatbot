// One task, as a list row. View-only on team boards; on the master board it
// gets a tick, a P1/P2 control and its remark history.
// The row uses the full width: what it is on the left, who and how old on one
// right edge, the action last. Below lg it folds into two lines.
import { Icon, Status, P1Mark } from "./ui";

function ActionForm({ boardKey, tab, id, action, children, className, label }) {
  return (
    <form method="post" action={`/board/${boardKey}/act`} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tab" value={tab} />
      <button name="action" value={action} className={className} aria-label={label} title={label}>
        {children}
      </button>
    </form>
  );
}

function statusMark(c, ownerView) {
  // Closed tasks only ever appear in a section that already says so, and the
  // meta line carries the date — a chip on every row would just be a stripe.
  if (c.status === "done") return null;
  if (c.status === "stuck") {
    return c.stuckOn === "ankit"
      ? <Status dot="warning">{ownerView ? "Waiting on you" : "Waiting on Ankit"}</Status>
      : <Status dot="warning">Stuck</Status>;
  }
  if (c.status === "working") return <Status dot="muted">Working</Status>;
  return <Status dot="open">Not started</Status>;
}

function Meta({ who, business, age, old, className = "" }) {
  return (
    <p className={`mt-1 flex items-baseline justify-between gap-4 text-meta text-muted ${className}`}>
      <span className="min-w-0 truncate">{business ? `${who} · ${business}` : who}</span>
      <span className={`flex-none tabular ${old ? "font-medium text-ink" : ""}`}>{age}</span>
    </p>
  );
}

// `compact` keeps the row on one stacked column — for the narrow rails, where
// splitting it would squeeze the description to three words a line.
export default function TaskCard({ c, boardKey, tab, showBusiness = false, compact = false, ownerView = Boolean(boardKey) }) {
  const master = Boolean(boardKey);
  const who = ownerView && c.isMine ? "You" : c.owner;
  const age = c.status === "done" ? `done ${c.doneOn}` : c.ageText;
  const old = c.status !== "done" && c.ageLevel === "red";

  return (
    <div className="flex items-start gap-3 border-b border-rule py-2.5 last:border-0">
      {master && c.status !== "done" && (
        <ActionForm
          boardKey={boardKey} tab={tab} id={c.id} action="done" label={`Mark #${c.id} done`}
          className="press group mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[3px] border-2 border-[var(--control)] hover:border-[var(--positive)]"
        >
          <Icon.check
            width={12} height={12} strokeWidth={2.2}
            className="text-[var(--positive)] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
          />
        </ActionForm>
      )}

      <div className={`min-w-0 flex-1 ${compact ? "" : "lg:flex lg:items-start lg:gap-5"}`}>
        <div className={`min-w-0 ${compact ? "" : "lg:flex-1"}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {c.p1 && <P1Mark />}
            {statusMark(c, ownerView)}
            <p className="min-w-0 text-body text-ink">
              <span className="font-mono text-meta text-faint">#{c.id}</span>{/* taste-skill-ignore: a task id */} {c.description}
            </p>
          </div>

          {c.note && <p className="mt-1 text-meta text-muted">{c.note}</p>}

          {/* Stacked: who and how old belong on line 2, above the disclosure.
              Split: the same facts move to their own right-aligned column. */}
          {!compact && <Meta who={who} business={showBusiness && c.business} age={age} old={old} className="lg:hidden" />}

          {master && c.remarks.length > 0 && (
            <details className="mt-1.5">
              <summary className="press inline-flex items-center gap-1 text-meta text-muted hover:text-ink">
                <Icon.chevron className="chev" width={12} height={12} />
                {c.remarks.length} remark{c.remarks.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1.5 space-y-2 border-l border-edge pl-3">
                {c.remarks.map((r, i) => (
                  <li key={i} className="text-meta">
                    <span className="tabular text-faint">{r.when}</span>
                    <span className="px-1 text-faint">·</span>
                    <span className="text-muted">{r.person}{r.status ? ` · ${r.status.toLowerCase()}` : ""}</span>
                    <span className="mt-0.5 block text-body text-ink">{r.text || "—"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <Meta
          who={who} business={showBusiness && c.business} age={age} old={old}
          className={compact ? "" : "hidden lg:mt-[3px] lg:flex lg:w-56 lg:flex-none"}
        />
      </div>

      {master && c.status !== "done" && (
        <div className="flex-none pt-px">
          <ActionForm
            boardKey={boardKey} tab={tab} id={c.id} action={c.p1 ? "p2" : "p1"}
            label={c.p1 ? `Move #${c.id} to P2` : `Make #${c.id} a P1`}
            className="press inline-flex h-7 items-center whitespace-nowrap rounded-control border border-[var(--control)] px-2 text-meta text-muted hover:border-ink hover:text-ink"
          >
            {c.p1 ? "Make P2" : "Make P1"}
          </ActionForm>
        </div>
      )}
    </div>
  );
}
