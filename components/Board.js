import TaskCard from "./TaskCard";

export function Stats({ s }) {
  const items = [["Open", s.open], ["Attention", s.attention], ["P1 open", s.p1], ["Done this week", s.doneWeek]];
  return (
    <div className="mb-4 grid grid-cols-4 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-stone-200 bg-white px-2.5 py-2 dark:border-stone-700 dark:bg-stone-800">
          <div className="text-xl font-semibold">{v}</div>
          <div className="text-[11px] leading-tight text-stone-500 dark:text-stone-400">{k}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, count, empty, children }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 flex items-baseline justify-between text-[15px] font-semibold">
        {title}<span className="text-xs font-normal text-stone-500">{count}</span>
      </h2>
      {count === 0 && empty ? <p className="px-0.5 py-1 text-sm text-stone-500">{empty}</p> : children}
    </section>
  );
}

export function Pill({ href, on, children }) {
  return (
    <a href={href} className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${on
      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
      : "border-stone-300 bg-white text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"}`}>{children}</a>
  );
}

export function TeamBoard({ data }) {
  return (
    <>
      <Header title={data.title} sub={`Updated ${data.updated} · view only · update your tasks on WhatsApp`} />
      <Stats s={data.stats} />
      <Section title="Needs attention" count={data.attention.length} empty="Nothing stuck or overdue.">
        {data.attention.map((c) => <TaskCard key={c.id} c={c} />)}
      </Section>
      {data.groups.map((g) => (
        <Section key={g.name} title={g.name} count={`${g.cards.length} open`}>
          {g.cards.map((c) => <TaskCard key={c.id} c={c} />)}
        </Section>
      ))}
      <Section title="Done in the last 7 days" count={data.done.length} empty="Nothing yet.">
        {data.done.map((c) => <TaskCard key={c.id} c={c} />)}
      </Section>
    </>
  );
}

export function MasterBoard({ data, boardKey }) {
  const showBusiness = data.tab === "attention" || data.tab === "mine";
  return (
    <>
      <Header title={data.title} sub={`Master board · updated ${data.updated}`} />
      <nav className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1.5">
        {data.tabs.map(([k, label]) => <Pill key={k} href={`/board/${boardKey}?tab=${k}`} on={k === data.tab}>{label}</Pill>)}
      </nav>
      {data.stats && <Stats s={data.stats} />}
      {data.score && <p className="mb-2 text-sm text-stone-500">{data.score}</p>}
      {data.sections?.map((s, i) => (
        <Section key={i} title={s.title} count={s.cards.length} empty={s.empty}>
          {s.cards.map((c) => <TaskCard key={c.id} c={c} boardKey={boardKey} tab={data.tab} showBusiness={showBusiness} />)}
        </Section>
      ))}
      {data.tab === "messages" && (
        <>
          <nav className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1.5">
            <Pill href={`/board/${boardKey}?tab=messages`} on={!data.who}>Everyone</Pill>
            {data.people.map((n) => <Pill key={n} href={`/board/${boardKey}?tab=messages&who=${encodeURIComponent(n)}`} on={data.who === n}>{n}</Pill>)}
          </nav>
          {data.messageDays.length === 0 && <p className="text-sm text-stone-500">No messages yet.</p>}
          {data.messageDays.map((d) => (
            <div key={d.day}>
              <p className="mb-1.5 mt-4 text-xs uppercase tracking-wide text-stone-500">{d.day}</p>
              {d.items.map((m, i) => (
                <div key={i} className="mb-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-800">
                  <p className="text-xs text-stone-500 dark:text-stone-400">{m.time} · {m.voice ? "🎤 voice · " : ""}{m.person}</p>
                  <p className="text-[15px]">{m.text}</p>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      <p className="mt-8 text-center text-xs">
        <a className="text-sky-700 underline dark:text-sky-300" href={`/board/${boardKey}/export`}>Download all tasks (CSV backup)</a>
      </p>
    </>
  );
}

function Header({ title, sub }) {
  return (
    <header className="mb-3.5">
      <h1 className="text-[21px] font-semibold">{title}</h1>
      <p className="mt-0.5 text-[13px] text-stone-500 dark:text-stone-400">{sub}</p>
    </header>
  );
}
