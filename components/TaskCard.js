// One task. View-only on team boards; on the master board it gets a tick box, a P1/P2 button and remark history.
function Tag({ tone, children }) {
  const tones = {
    p1: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    stuck: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    working: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  };
  return <span className={`mr-1 inline-block rounded-md px-1.5 py-px align-[1px] text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function ActionForm({ boardKey, tab, id, action, children, className, label }) {
  return (
    <form method="post" action={`/board/${boardKey}/act`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tab" value={tab} />
      <button name="action" value={action} className={className} aria-label={label} title={label}>{children}</button>
    </form>
  );
}

export default function TaskCard({ c, boardKey, tab, showBusiness = false }) {
  const master = Boolean(boardKey);
  const meta = [master && c.isMine ? "You" : c.owner];
  if (showBusiness) meta.push(c.business);
  const age = c.status === "done" ? `done ${c.doneOn}` : c.ageText;
  const ageClass = c.status === "done" ? "" : c.ageLevel === "red" ? "font-semibold text-red-700 dark:text-red-300" : c.ageLevel === "amber" ? "font-semibold text-amber-700 dark:text-amber-300" : "";
  return (
    <div className={`mb-2 flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800 ${c.attention ? "border-l-4 border-l-red-600" : ""}`}>
      {master && c.status !== "done" && (
        <ActionForm boardKey={boardKey} tab={tab} id={c.id} action="done" label="Mark done"
          className="mt-0.5 h-6 w-6 flex-none rounded-md border-2 border-stone-400 hover:bg-green-100 active:bg-green-200 dark:border-stone-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">
          {c.p1 && <Tag tone="p1">P1</Tag>}
          {c.status === "stuck" && <Tag tone="stuck">Stuck · {c.stuckOn === "ankit" ? "Ankit" : "others"}</Tag>}
          {c.status === "working" && <Tag tone="working">Working</Tag>}
          {c.status === "done" && <Tag tone="done">Done</Tag>}
          <span className="text-stone-400">#{c.id}</span> {c.description}
        </p>
        <p className="mt-0.5 text-[13px] text-stone-500 dark:text-stone-400">
          {meta.join(" · ")} · <span className={ageClass}>{age}</span>{c.note ? ` · ${c.note}` : ""}
        </p>
        {master && c.remarks.length > 0 && (
          <details className="mt-1.5 text-[13px]">
            <summary className="cursor-pointer text-sky-700 dark:text-sky-300">Remarks ({c.remarks.length})</summary>
            <ul className="mt-1">
              {c.remarks.map((r, i) => (
                <li key={i} className="my-1 border-l-2 border-stone-200 pl-2 dark:border-stone-600">
                  <span className="text-stone-500 dark:text-stone-400">{r.when} · {r.person}{r.status ? ` · ${r.status}` : ""}</span>
                  <br />{r.text || "—"}
                </li>
              ))}
            </ul>
          </details>
        )}
        {master && c.status !== "done" && (
          <div className="mt-1.5">
            <ActionForm boardKey={boardKey} tab={tab} id={c.id} action={c.p1 ? "p2" : "p1"} label={c.p1 ? "Make P2" : "Make P1"}
              className="rounded-md border border-stone-300 px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-700">
              {c.p1 ? "Make P2" : "Make P1"}
            </ActionForm>
          </div>
        )}
      </div>
    </div>
  );
}
