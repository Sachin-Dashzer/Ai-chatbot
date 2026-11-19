// The frame: a tinted L holding the sidebar and the top bar with no rule
// between them, and the work on a white sheet inset 8px from the window's
// right and bottom edges, with a 1px edge and no shadow (tasteskill app sheet
// `framed-sheet`, seed 360299993).
//
// In this world that is the counterfoil book itself: the board of the book is
// the frame, and the form paper is the sheet lying on it. The frame is the one
// place colour owns a whole region; inside the sheet, only two hues appear and
// each carries a fact.
//
// Phone first — Ankit reads this standing up, one-handed. There the frame
// disappears: the sheet becomes the screen under a 48px bar on the board tint
// holding the menu, the product's name and at most one action.
import { Icon, Mark } from "./ui";

function NavRow({ item }) {
  const Glyph = item.icon ? Icon[item.icon] : null;
  return (
    <a
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`press group flex min-h-11 items-center gap-2.5 rounded-control px-2.5 text-body lg:min-h-0 lg:h-8 ${
        item.active
          ? "bg-active font-medium text-ink"
          : "text-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {Glyph ? (
        <Glyph className={`flex-none ${item.active ? "text-furniture" : "text-faint"}`} />
      ) : (
        <span className="w-4 flex-none" />
      )}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count > 0 && (
        // A count sits only on a queue that needs doing, and its noun is in the
        // label beside it. A figure, not a badge.
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
          {g.label && <p className="furniture mb-2 px-2.5 text-small">{g.label}</p>}
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

// The product names itself, with the scope under it. The mark is the office's
// own: a struck ring with the initial inside it, drawn in ui.js.
function Brand({ brand, scope, className = "" }) {
  return (
    <a
      href="/"
      className={`press flex items-center gap-2.5 rounded-control px-2.5 py-1.5 hover:bg-raised ${className}`}
    >
      <span className="flex-none text-stamp">
        <Mark size={22} />
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
  brand = "Love",
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
    <div className={`flex flex-col bg-board ${flush ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {/* The phone's bar, on the board tint. Below lg only, where the
          sidebar cannot exist. */}
      <header className="sticky top-0 z-20 flex h-topbar flex-none items-center gap-2 bg-board px-3 lg:hidden">
        <span className="flex-none text-stamp">
          <Mark size={22} />
        </span>
        <p className="flex-none text-body font-semibold text-ink">{brand}</p>
        {title && (
          <>
            <span aria-hidden className="h-3.5 w-px flex-none bg-control" />
            <p className="min-w-0 flex-1 truncate text-meta text-muted">{title}</p>
          </>
        )}
        {action}
        {hasNav && (
          <details className="relative ml-auto flex-none">
            <summary
              aria-label="Open navigation"
              className="press flex h-11 w-11 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink"
            >
              <Icon.menu />
            </summary>
            <div
              className="navsheet absolute right-0 top-12 z-30 flex max-h-[80dvh] w-[17rem] flex-col gap-5 overflow-y-auto rounded-card border border-edge bg-surface p-4 shadow-[0_12px_32px_rgba(20,19,16,0.16)]" /* taste-skill-ignore: a real overlay menu, which floats above the page */
            >
              <Brand brand={brand} scope={scope} className="-mx-1" />
              <NavBody sections={sections} />
            </div>
          </details>
        )}
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 lg:gap-0">
        {hasNav && (
          // The sidebar is part of the frame: the same board tint, no rule
          // between it and the bar above, nothing dark or saturated.
          <aside
            className="sticky hidden flex-none flex-col overflow-y-auto bg-board px-4 py-4 lg:flex"
            style={{ width: "var(--sidebar)", top: 0, height: "100dvh" }}
          >
            <Brand brand={brand} scope={scope} className="mb-6" />
            <NavBody sections={sections} className="flex-1" />
            {foot && (
              <div className="mt-6 border-t border-edge pt-3 text-small leading-snug text-faint">
                {foot}
              </div>
            )}
          </aside>
        )}

        {/* The sheet. Inset 8px from the window's right and bottom on desktop,
            a 1px edge, no shadow; on a phone it is simply the screen. */}
        <main
          className={`min-w-0 flex-1 bg-board lg:mb-sheet lg:mr-sheet lg:rounded-sheet lg:border lg:border-sheet-edge lg:bg-surface ${
            flush ? "flex min-h-0 flex-col bg-surface" : "px-4 pb-6 sm:px-6 lg:p-gutter"
          }`}
        >
          {flush ? (
            children
          ) : (
            <div className="mx-auto max-w-[1240px]">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}

// The head of a screen, on a field of the board: on a phone the sheet fills the
// window, so without this the frame survives only as a 48px bar and the world
// goes missing from the screen it was chosen for. The band bleeds to the edges,
// carries the title, the question and its figure, and ends where the records
// begin — a form laid on the board. At lg the frame is already around the
// sheet, so the band turns itself off.
export function Band({ children }) {
  return (
    <div className="-mx-4 mb-4 bg-board px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-6 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
      {children}
    </div>
  );
}

// The title row of a sheet. The screen's name as its one h1, the finding under
// it in one sentence about the data — never about the interface — and the
// freshness stamp with any real action on the right.
export function PageHead({ title, finding, stamp, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-fig font-semibold tracking-[-0.014em] text-ink lg:text-title">
          {title}
        </h1>
        {finding && <p className="mt-1.5 max-w-[68ch] text-body text-muted">{finding}</p>}
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
