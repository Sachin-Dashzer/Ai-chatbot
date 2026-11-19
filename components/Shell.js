// WhatsApp's own frame: one green band across the whole top (the panel colour
// after dark, as the app itself does), the sidebar on the panel grey beside
// white work, a teal row for where you are, and counts as unread badges. A 1px
// rule is the only thing between the panes and the content runs to the edge.
// On a phone the sidebar folds into the band's menu button.
import { Icon, Mark } from "./ui";

function NavRow({ item }) {
  const Glyph = item.icon ? Icon[item.icon] : null;
  return (
    <a
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`press group flex h-9 items-center gap-2.5 rounded-control px-2 text-body ${
        item.active
          ? "bg-[var(--accent-soft)] font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]"
          : "text-muted hover:bg-active hover:text-ink"
      }`}
    >
      {Glyph ? (
        <Glyph className="flex-none text-faint group-aria-[current=page]:text-[var(--accent)]" />
      ) : (
        <span className="w-4 flex-none" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count > 0 && (
        <span
          title={item.countTitle}
          className="inline-flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-[var(--badge)] px-1.5 text-[11px] font-semibold leading-none tabular text-[var(--badge-ink)]"
        >
          {item.count}
        </span>
      )}
    </a>
  );
}

function NavBody({ sections }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto pb-4">
      {sections.map((g, gi) => (
        <div key={g.label || gi}>
          {g.label && <p className="mb-1.5 px-2 text-small text-muted">{g.label}</p>}
          <div className="space-y-px">
            {g.items.map((it) => <NavRow key={it.href + it.label} item={it} />)}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Shell({ brand = "Ankit Desk", scope, sections = [], title, action, flush = false, children }) {
  const hasNav = sections.length > 0;
  return (
    // A flush screen is a fixed-height column at every width, so its panes do
    // their own scrolling. Without the flex chain below, the content simply
    // overflows the clipped page and cannot be reached.
    <div className={`flex flex-col bg-ground ${flush ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {/* The band. It names the product and the screen, carries the one action
          a screen has, and on a phone holds the menu. */}
      <header className="on-brand sticky top-0 z-20 flex h-topbar flex-none items-center gap-2 bg-[var(--brand)] px-3 text-[var(--brand-ink)] sm:px-4">
        {hasNav && (
          <details className="relative lg:hidden">
            <summary
              aria-label="Open navigation"
              className="press flex h-8 w-8 items-center justify-center rounded-control text-[var(--brand-ink)] hover:bg-black/10"
            >
              <Icon.menu />
            </summary>
            <div /* taste-skill-ignore: a real overlay menu */ className="navsheet absolute left-0 top-10 z-30 flex max-h-[80dvh] w-[17rem] flex-col overflow-hidden rounded-card border border-edge bg-raised px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              <NavBody sections={sections} />
            </div>
          </details>
        )}

        <span className={`flex min-w-0 items-center gap-2 ${hasNav ? "lg:w-[calc(var(--sidebar)-1.25rem)]" : ""}`}>
          <Mark size={18} />
          <span className="min-w-0">
            <span className="block truncate text-body font-semibold leading-tight">{brand}</span>
            {scope && (
              <span className="block truncate text-small leading-tight text-[var(--brand-dim)]">{scope}</span>
            )}
          </span>
        </span>

        <p className="min-w-0 flex-1 truncate text-body font-medium">{title}</p>
        {action}
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {hasNav && (
          <aside
            className="sticky hidden flex-none flex-col border-r border-edge bg-raised px-3 py-3 lg:flex"
            style={{ width: "var(--sidebar)", top: "var(--topbar)", height: "calc(100dvh - var(--topbar))" }}
          >
            <NavBody sections={sections} />
          </aside>
        )}

        {/* `flush` hands the whole area to the screen (the chat), which lays
            out its own panes and scrolls them itself. */}
        <main
          className={`min-w-0 flex-1 bg-surface ${
            flush ? "flex min-h-0 flex-col" : "px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          }`}
        >
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
