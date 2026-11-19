// The frame: an open plane. One labelled sidebar sits on the page ground with a
// single hairline between it and the canvas, and there is no desktop top bar —
// the previous build spent 48px on a saturated band that held a wordmark and a
// page name the h1 repeated 50px below it.
//
// Nothing in this chrome carries colour. Where you are is a neutral grey pill;
// a count is a plain tabular figure, not a filled badge. Every drop of colour
// in the product is spent inside the work, on a fact.
//
// On a phone the sidebar folds into a 48px bar holding the screen's name and a
// menu button, on the same ground.
import { Icon, Mark } from "./ui";

function NavRow({ item }) {
  const Glyph = item.icon ? Icon[item.icon] : null;
  return (
    <a
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`press group flex h-8 items-center gap-2.5 rounded-control px-2.5 text-body ${
        item.active
          ? "bg-active font-medium text-ink"
          : "text-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {Glyph ? (
        <Glyph className={`flex-none ${item.active ? "text-ink" : "text-faint"}`} />
      ) : (
        <span className="w-4 flex-none" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count > 0 && (
        // A count only ever sits on a queue that needs doing, and its noun is
        // in the label beside it. A figure, not a badge: the colour budget is
        // for the data, and a filled disc here would be chrome.
        <span
          title={item.countTitle}
          className={`flex-none tabular text-meta ${item.active ? "text-ink" : "text-faint"}`}
        >
          {item.count}
        </span>
      )}
    </a>
  );
}

function NavBody({ sections, className = "" }) {
  return (
    <nav className={`space-y-6 ${className}`}>
      {sections.map((g, gi) => (
        <div key={g.label || gi}>
          {g.label && (
            <p className="mb-2 px-2.5 text-small text-faint">{g.label}</p>
          )}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavRow key={it.href + it.label} item={it} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// The product names itself at the top of the sidebar, with the scope under it.
// A screen whose product cannot be named from a screenshot reads as a template.
function Brand({ brand, scope }) {
  return (
    <a
      href="/"
      className="press mb-7 flex items-center gap-2.5 rounded-control px-2.5 py-1.5 hover:bg-raised"
    >
      <span className="flex-none text-ink">
        <Mark size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold leading-tight text-ink">
          {brand}
        </span>
        {scope && (
          <span className="mt-0.5 block truncate text-small leading-tight text-faint">
            {scope}
          </span>
        )}
      </span>
    </a>
  );
}

export default function Shell({
  brand = "Ankit Desk",
  scope,
  sections = [],
  title,
  action,
  foot,
  flush = false,
  children,
}) {
  const hasNav = sections.length > 0;

  return (
    // A flush screen is a fixed-height column at every width, so its panes do
    // their own scrolling. Without the flex chain below, the content simply
    // overflows the clipped page and cannot be reached.
    <div className={`flex flex-col bg-ground ${flush ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {/* The phone's bar. It exists only below lg, where the sidebar cannot. */}
      <header className="sticky top-0 z-20 flex h-topbar flex-none items-center gap-2 border-b border-edge bg-ground px-3 lg:hidden">
        {hasNav ? (
          <details className="relative flex-none">
            <summary
              aria-label="Open navigation"
              className="press flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink"
            >
              <Icon.menu />
            </summary>
            <div
              className="navsheet absolute left-0 top-10 z-30 flex max-h-[80dvh] w-[17rem] flex-col overflow-y-auto rounded-card border border-edge bg-surface p-4 shadow-[0_12px_32px_rgba(10,10,10,0.14)]" /* taste-skill-ignore: a real overlay menu, which floats above the page */
            >
              <Brand brand={brand} scope={scope} />
              <NavBody sections={sections} />
            </div>
          </details>
        ) : (
          <span className="flex-none text-ink">
            <Mark size={18} />
          </span>
        )}

        <p className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
          {title || brand}
        </p>
        {action}
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {hasNav && (
          <aside
            className="sticky hidden flex-none flex-col overflow-y-auto border-r border-edge bg-ground px-4 py-5 lg:flex"
            style={{ width: "var(--sidebar)", top: 0, height: "100dvh" }}
          >
            <Brand brand={brand} scope={scope} />
            <NavBody sections={sections} className="flex-1" />
            {foot && (
              <div className="mt-6 border-t border-edge pt-3 text-small leading-snug text-faint">
                {foot}
              </div>
            )}
          </aside>
        )}

        {/* `flush` hands the whole area to the screen (the transcript), which
            lays out its own panes and scrolls them itself. */}
        <main
          className={`min-w-0 flex-1 ${
            flush
              ? "flex min-h-0 flex-col bg-surface"
              : "bg-ground px-4 py-6 sm:px-6 lg:px-gutter lg:py-8"
          }`}
        >
          {flush ? children : (
            <div className={hasNav ? "mx-auto max-w-[1240px]" : "mx-auto max-w-[1100px]"}>
              {/* Without a sidebar there is nothing else naming the product, and
                  a screen whose product cannot be named reads as a template. */}
              {!hasNav && (
                <p className="mb-7 hidden items-center gap-2 text-body font-semibold text-ink lg:flex">
                  <span className="text-ink">
                    <Mark size={18} />
                  </span>
                  {brand}
                </p>
              )}
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// The title row. A noun at 24/600, one grey sentence about the data under it —
// the screen's finding, never a sentence about the interface — and the
// freshness stamp with any real action on the right.
export function PageHead({ title, finding, stamp, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {finding && (
          <p className="mt-1.5 max-w-[68ch] text-body text-muted">{finding}</p>
        )}
      </div>
      {(stamp || actions) && (
        <div className="flex flex-none items-center gap-3">
          {stamp && <p className="text-small tabular text-faint">{stamp}</p>}
          {actions}
        </div>
      )}
    </div>
  );
}
