// One flat surface. The sidebar, the top bar and the work all sit on the same
// ground; a 1px rule is the only thing between them, and the content runs to
// the edge. On a phone the sidebar folds into the top bar's menu button.
import { Icon, Mark } from "./ui";

function NavRow({ item }) {
  const Glyph = item.icon ? Icon[item.icon] : null;
  return (
    <a
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`press group flex h-8 items-center gap-2.5 rounded-control px-2 text-body ${
        item.active ? "bg-active font-medium text-ink" : "text-muted hover:bg-active/60 hover:text-ink"
      }`}
    >
      {Glyph ? <Glyph className="flex-none text-faint group-aria-[current=page]:text-ink" /> : <span className="w-4 flex-none" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count > 0 && (
        <span title={item.countTitle} className="flex-none text-small tabular text-faint">
          {item.count}
        </span>
      )}
    </a>
  );
}

function NavBody({ brand, scope, groups }) {
  return (
    <>
      <div className="flex h-topbar items-center gap-2 px-2">
        <Mark />
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold leading-tight">{brand}</span>
          {scope && <span className="block truncate text-small leading-tight text-faint">{scope}</span>}
        </span>
      </div>
      <nav className="mt-3 flex-1 space-y-5 overflow-y-auto pb-4">
        {groups.map((g, gi) => (
          <div key={g.label || gi}>
            {g.label && <p className="mb-1.5 px-2 text-small text-faint">{g.label}</p>}
            <div className="space-y-px">
              {g.items.map((it) => <NavRow key={it.href + it.label} item={it} />)}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

export default function Shell({ brand = "Ankit Desk", scope, groups = [], title, action, flush = false, children }) {
  const hasNav = groups.length > 0;
  return (
    // A flush screen is a fixed-height column at every width, so its panes do
    // their own scrolling. Without the flex chain below lg, the content simply
    // overflowed the clipped page and could not be reached.
    <div
      className={`bg-ground ${
        flush ? "flex h-dvh flex-col overflow-hidden lg:flex-row" : "min-h-dvh lg:flex"
      }`}
    >
      {hasNav && (
        <aside
          className="sticky top-0 hidden h-dvh flex-none flex-col border-r border-edge px-3 py-2 lg:flex"
          style={{ width: "var(--sidebar)" }}
        >
          <NavBody brand={brand} scope={scope} groups={groups} />
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 48px top bar on the frame's ground, no rule under it */}
        {/* With a sidebar there is nothing left for a desktop top bar to
            carry, and an empty 48px band is just chrome. It stays on the
            phone, where it holds the menu and the screen's name, and on the
            team board, where it is the only place the product is named. */}
        <header
          className={`flex h-topbar flex-none items-center gap-2 border-b border-edge px-4 sm:px-6 ${
            hasNav ? "lg:hidden" : ""
          }`}
        >
          {hasNav ? (
            <>
              <details className="relative lg:hidden">
                <summary
                  aria-label="Open navigation"
                  className="press flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-active hover:text-ink"
                >
                  <Icon.menu />
                </summary>
                <div /* taste-skill-ignore: a real overlay menu */ className="navsheet absolute left-0 top-10 z-30 flex max-h-[80dvh] w-[17rem] flex-col rounded-card border border-edge bg-surface px-3 pb-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                  <NavBody brand={brand} scope={scope} groups={groups} />
                </div>
              </details>
              <p className="min-w-0 flex-1 truncate text-body font-medium lg:hidden">{title}</p>
              <span className="hidden flex-1 lg:block" />
            </>
          ) : (
            <>
              <Mark size={18} />
              <p className="min-w-0 flex-1 truncate text-meta text-muted">{brand}</p>
            </>
          )}
          {action}
        </header>

        {/* `flush` hands the whole area to the screen (the chat), which lays
            out its own panes and scrolls them itself. */}
        <main className={`min-w-0 flex-1 bg-surface ${flush ? "flex min-h-0 flex-col" : "px-4 py-6 sm:px-6 lg:px-8 lg:py-8"}`}>
          {flush ? children : <div className={hasNav ? "" : "mx-auto max-w-[1180px]"}>{children}</div>}
        </main>
      </div>
    </div>
  );
}

// The title row inside the sheet: a noun, one grey sentence about the data,
// and the freshness stamp on the right.
export function PageHead({ title, finding, stamp, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-title font-semibold">{title}</h1>
        {finding && <p className="mt-1 max-w-[62ch] text-body text-muted">{finding}</p>}
      </div>
      <div className="flex flex-none items-center gap-2">
        {stamp && <p className="text-small tabular text-faint">{stamp}</p>}
        {actions}
      </div>
    </div>
  );
}
