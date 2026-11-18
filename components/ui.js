// Shared pieces for every screen: the drawn icon set, status marks, the KPI
// strip, section frames, empty states and the bot's day strip.
// One icon set, 16px, 1.5px stroke, currentColor — no emoji, no glyph fonts.

const S = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const Icon = {
  menu: (p) => (
    <svg {...S} {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
  ),
  close: (p) => (
    <svg {...S} {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>
  ),
  chevron: (p) => (
    <svg {...S} {...p}><path d="M6 3.5L10.5 8 6 12.5" /></svg>
  ),
  check: (p) => (
    <svg {...S} {...p}><path d="M3 8.5l3.2 3.2L13 5" /></svg>
  ),
  mic: (p) => (
    <svg {...S} {...p}>
      <rect x="6" y="1.75" width="4" height="7.5" rx="2" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" />
    </svg>
  ),
  download: (p) => (
    <svg {...S} {...p}><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M2.5 13.5h11" /></svg>
  ),
  copy: (p) => (
    <svg {...S} {...p}>
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.5" />
      <path d="M10.25 3.5A1.5 1.5 0 0 0 8.75 2h-5.5A1.5 1.5 0 0 0 1.75 3.5v5.25" />
    </svg>
  ),
  clock: (p) => (
    <svg {...S} {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 4.5V8l2.25 1.5" /></svg>
  ),
  flag: (p) => (
    <svg {...S} {...p}><path d="M3.75 14.5V2.25h8.5l-2 3 2 3h-8.5" /></svg>
  ),
  home: (p) => (
    <svg {...S} {...p}><path d="M2.5 7L8 2.5 13.5 7v6.5h-11z" /></svg>
  ),
  inbox: (p) => (
    <svg {...S} {...p}>
      <path d="M2 9.5V4a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 14 4v5.5" />
      <path d="M2 9.5h3l1 2h4l1-2h3v2.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
    </svg>
  ),
  user: (p) => (
    <svg {...S} {...p}><circle cx="8" cy="5.25" r="2.75" /><path d="M2.75 14c.6-2.8 2.7-4.25 5.25-4.25S12.65 11.2 13.25 14" /></svg>
  ),
  calendar: (p) => (
    <svg {...S} {...p}>
      <rect x="2" y="3.25" width="12" height="10.75" rx="1.5" />
      <path d="M2 6.75h12M5.5 1.75v2.5M10.5 1.75v2.5" />
    </svg>
  ),
  building: (p) => (
    <svg {...S} {...p}>
      <path d="M2.75 14V3.25a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1V14" />
      <path d="M10.25 6.5h2a1 1 0 0 1 1 1V14M1.5 14h13M5.25 5.5h2.5M5.25 8.25h2.5M5.25 11h2.5" />
    </svg>
  ),
};

// The mark: a message that became a task. Drawn, not a letter in a box.
export function Mark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H8.2L4.4 17.1a.5.5 0 0 1-.8-.4V14A2.5 2.5 0 0 1 3 11.5z" />
      <path d="M6.9 8.6l2 2 4.2-4.2" />
    </svg>
  );
}

// ── Status marks ─────────────────────────────────────────────────────────
// One neutral chip per row; the state is a 6px dot inside it. A section where
// every row shares a state would otherwise become a stripe of colour.
const DOT = {
  muted: "bg-[var(--faint)]",
  open: "border border-[var(--control)]",
  warning: "bg-[var(--warning)]",
  positive: "bg-[var(--positive)]",
};

export function Status({ dot = "muted", children }) {
  return (
    <span className="inline-flex h-5 flex-none items-center gap-1.5 whitespace-nowrap rounded-chip bg-[var(--pill-neutral-bg)] pl-1.5 pr-2 text-small font-medium text-[var(--pill-neutral-ink)]">
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[dot]}`} />
      {children}
    </span>
  );
}

// ── The KPI strip ────────────────────────────────────────────────────────
// One container split by 1px dividers. Label above the value; a caption that
// names the window the figure is measured over. No icons, no sparklines.
const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };

export function Stats({ items }) {
  return (
    <dl className={`grid grid-cols-2 overflow-hidden rounded-card border border-edge ${COLS[items.length] || "sm:grid-cols-4"}`}>
      {items.map((it, i) => (
        <div key={it.label}
          className={`min-w-0 border-edge px-4 py-3 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t" : ""} sm:border-l sm:border-t-0 sm:first:border-l-0`}>
          <dt className="truncate text-body font-medium text-muted">{it.label}</dt>
          <dd className={`mt-1 text-kpi tabular ${it.tone === "negative" && it.value > 0 ? "text-[var(--negative)]" : "text-ink"}`}>
            {it.value}
          </dd>
          <p className="mt-1 text-small leading-tight text-faint">{it.caption}</p>
        </div>
      ))}
    </dl>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────
// A bordered block with its heading in a ruled header. One border, no shadow,
// and never nested inside another panel.
export function Panel({ title, count, action, note, children, className = "", pad = true }) {
  return (
    <section className={`overflow-hidden rounded-card border border-edge ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-2.5 sm:px-5">
          <h2 className="min-w-0 truncate text-section font-semibold">{title}</h2>
          <div className="flex flex-none items-center gap-3">
            {count != null && <span className="text-small tabular text-faint">{count}</span>}
            {action}
          </div>
        </header>
      )}
      {note && <p className="border-b border-edge px-4 py-2 text-small text-faint sm:px-5">{note}</p>}
      <div className={pad ? "px-4 py-4 sm:px-5" : ""}>{children}</div>
    </section>
  );
}

// ── Section frames ───────────────────────────────────────────────────────
export function Section({ title, count, action, children, className = "" }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-section font-semibold tracking-[-0.006em]">{title}</h2>
        {count != null && <span className="shrink-0 text-small tabular text-faint">{count}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

// An empty block keeps its frame and says one true sentence in the product's words.
export function Empty({ children }) {
  return (
    <p className="rounded-card border border-dashed border-edge px-3 py-2.5 text-body text-muted">{children}</p>
  );
}

// ── The bot's day ────────────────────────────────────────────────────────
// This product's own element: the moments the bot acts, as a plain list you
// read top to bottom — the clock on the left, one sentence saying what happens,
// what has already gone out ticked and greyed, and the one still to come marked
// "next". It replaced an axis chart: the chart was shorter to read only if you
// already knew what the five marks on it meant.
export function DayList({ slots, nowMin }) {
  const next = slots.find((s) => s.min > nowMin);
  return (
    <dl>
      {slots.map((s) => {
        const past = s.min <= nowMin;
        const isNext = s === next;
        return (
          <div key={s.time + s.kind} className="flex items-baseline gap-3 border-b border-rule py-2.5 last:border-0">
            <dt className={`w-[4.25rem] shrink-0 text-body font-medium tabular ${past ? "text-faint" : "text-ink"}`}>
              {s.time}
            </dt>
            <dd className={`min-w-0 flex-1 text-body ${past ? "text-faint" : "text-ink"}`}>{s.what}</dd>
            {isNext && <Status dot="warning">Next</Status>}
            {past && (
              <span className="flex-none">
                <Icon.check width={14} height={14} className="text-faint" />
                <span className="sr-only">already sent</span>
              </span>
            )}
          </div>
        );
      })}
    </dl>
  );
}
