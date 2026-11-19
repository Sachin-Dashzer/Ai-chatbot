// Shared pieces for every screen: the drawn icon set, the panel, section
// headings, figures, status marks, tabs, notices, empty states, and the bot's
// day — the one element only this product has.
//
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
  menu: (p) => <svg {...S} {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>,
  close: (p) => <svg {...S} {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>,
  chevron: (p) => <svg {...S} {...p}><path d="M6 3.5L10.5 8 6 12.5" /></svg>,
  check: (p) => <svg {...S} {...p}><path d="M3 8.5l3.2 3.2L13 5" /></svg>,
  mic: (p) => (
    <svg {...S} {...p}>
      <rect x="6" y="1.75" width="4" height="7.5" rx="2" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" />
    </svg>
  ),
  download: (p) => <svg {...S} {...p}><path d="M8 2v8M4.5 7l3.5 3.5L11.5 7M2.5 13.5h11" /></svg>,
  copy: (p) => (
    <svg {...S} {...p}>
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.5" />
      <path d="M10.25 3.5A1.5 1.5 0 0 0 8.75 2h-5.5A1.5 1.5 0 0 0 1.75 3.5v5.25" />
    </svg>
  ),
  clock: (p) => <svg {...S} {...p}><circle cx="8" cy="8" r="6.25" /><path d="M8 4.5V8l2.25 1.5" /></svg>,
  flag: (p) => <svg {...S} {...p}><path d="M3.75 14.5V2.25h8.5l-2 3 2 3h-8.5" /></svg>,
  home: (p) => <svg {...S} {...p}><path d="M2.5 7L8 2.5 13.5 7v6.5h-11z" /></svg>,
  inbox: (p) => (
    <svg {...S} {...p}>
      <path d="M2 9.5V4a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 14 4v5.5" />
      <path d="M2 9.5h3l1 2h4l1-2h3v2.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
    </svg>
  ),
  user: (p) => (
    <svg {...S} {...p}>
      <circle cx="8" cy="5.25" r="2.75" />
      <path d="M2.75 14c.6-2.8 2.7-4.25 5.25-4.25S12.65 11.2 13.25 14" />
    </svg>
  ),
  users: (p) => (
    <svg {...S} {...p}>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.75c.5-2.5 2.3-3.75 4.5-3.75s4 1.25 4.5 3.75M11 3.3a2.5 2.5 0 0 1 0 4.4M12.6 10.4c1.1.6 1.7 1.7 1.9 3.35" />
    </svg>
  ),
  calendar: (p) => (
    <svg {...S} {...p}>
      <rect x="2" y="3.25" width="12" height="10.75" rx="1.5" />
      <path d="M2 6.75h12M5.5 1.75v2.5M10.5 1.75v2.5" />
    </svg>
  ),
  arrow: (p) => <svg {...S} {...p}><path d="M3 8h10M9 4l4 4-4 4" /></svg>,
};

// The mark: the office's own datestamp — a struck ring with the hour bar
// across it, sitting a little off-square the way a hand-struck stamp does.
// Drawn, never a letter in a box.
export function Mark({ size = 22 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
    >
      <g transform="rotate(-8 11 11)">
        <circle cx="11" cy="11" r="8.1" strokeWidth="1.7" />
        <circle cx="11" cy="11" r="5.1" strokeWidth="1" opacity="0.5" />
        <path d="M3.4 11h15.2" strokeWidth="1.7" />
        <path d="M11 6.6v2.1M11 13.3v2.1" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────
// A white card on the ground: one 1px edge, one tone step, no shadow, never
// nested inside another panel.
export function Panel({
  title, count, action, note, children, className = "", pad = true, as: Tag = "section",
}) {
  return (
    <Tag
      className={`overflow-hidden rounded-card border border-edge bg-surface lg:rounded-none lg:border-0 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-4 border-b border-edge px-5 py-3 lg:px-0">
          <h2 className="min-w-0 truncate font-narrow text-section font-semibold text-ink">{title}</h2>
          <div className="flex flex-none items-center gap-3">
            {count != null && <span className="text-small tabular text-faint">{count}</span>}
            {action}
          </div>
        </header>
      )}
      {note && (
        <p className="border-b border-edge bg-raised px-5 py-2.5 text-small leading-snug text-faint">
          {note}
        </p>
      )}
      <div className={pad ? "p-5 lg:px-0" : ""}>{children}</div>
    </Tag>
  );
}

// A heading over content with no box around it. Used where a frame would be a
// fourth nesting level.
export function Section({ title, count, action, children, className = "", id }) {
  return (
    <section className={className} id={id}>
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <h2 className="font-narrow text-section font-semibold text-ink">{title}</h2>
        <div className="flex flex-none items-baseline gap-3">
          {count != null && <span className="text-small tabular text-faint">{count}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Figures ──────────────────────────────────────────────────────────────
// The figure that answers a screen's question, with the sentence that reads it
// aloud beside it. Red only when the answer is bad: a count of work waiting is
// bad at one and fine at zero.
export function Lead({ value, tone = "auto", label, children }) {
  const bad = tone === "negative" || (tone === "auto" && Number(value) > 0);
  return (
    <div>
      {label && <p className="furniture mb-0.5 text-meta">{label}</p>}
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className={`text-kpi tabular leading-none ${bad ? "text-stamp" : "text-ink"}`}>
          {value}
        </span>
        <p className="min-w-0 flex-1 text-body text-muted">{children}</p>
      </div>
    </div>
  );
}

// ── The signature move: the datestamp ────────────────────────────────────
// A record's state is struck on the record, dated, slightly off-square — not a
// tinted pill repeated down every row. Its first line is what happened, its
// second is when. Three tones and no more: it needs him, the office closed it,
// or it is waiting on WhatsApp's own window.
export function Stamp({ state, when, tone = "needs", strike = false, title }) {
  return (
    <span
      title={title}
      className={`stamp stamp-${tone} ${strike ? "stamp-strike" : ""} flex-none`}
    >
      <span>{state}</span>
      {when && <span className="when">{when}</span>}
    </span>
  );
}

// A track drawn at its true ratio: no stub at zero, no padded range, both ends
// labelled. The one data mark on these screens, in the office's own green.
export function Track({ ratio = 0, left, right, className = "" }) {
  const pct = Math.max(0, Math.min(1, Number(ratio) || 0)) * 100;
  return (
    <div className={className}>
      <div className="h-2 w-full bg-raised" role="presentation">
        {pct > 0 && <div className="h-full bg-furniture" style={{ width: pct + "%" }} />}
      </div>
      {(left || right) && (
        <div className="mt-1.5 flex items-baseline justify-between gap-3 text-small text-faint">
          <span className="tabular">{left}</span>
          <span className="tabular">{right}</span>
        </div>
      )}
    </div>
  );
}

// One container split by 1px dividers: label above the value, a caption naming
// the window it is measured over. No tiles, no icons, no sparklines.
// Every cell has to earn its place — a cell that merely names a block below it
// belongs in that block's own lead figure instead.
const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

export function Stats({ items, className = "" }) {
  return (
    <dl
      className={`grid grid-cols-2 overflow-hidden rounded-card border border-edge bg-surface lg:rounded-none lg:border-0 lg:bg-transparent ${
        COLS[items.length] || "sm:grid-cols-3"
      } ${className}`}
    >
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`min-w-0 border-edge px-5 py-4 ${i % 2 ? "border-l" : ""} ${
            i >= 2 ? "border-t" : ""
          } sm:border-l sm:border-t-0 sm:first:border-l-0`}
        >
          <dt className="furniture truncate text-small">{it.label}</dt>
          <dd
            className={`mt-1.5 text-fig tabular leading-none ${
              it.tone === "negative" && it.value > 0 ? "text-stamp" : "text-ink"
            }`}
          >
            {it.value}
          </dd>
          {it.caption && (
            <p className="mt-2 text-small leading-tight text-faint">{it.caption}</p>
          )}
        </div>
      ))}
    </dl>
  );
}

// ── Status marks ─────────────────────────────────────────────────────────
// One neutral chip, the state a 6px dot inside it. Neutral because a section
// where most rows share a state would otherwise become a stripe of colour.
// Rendered only where it tells the reader something the heading has not.
const DOT = {
  muted: "bg-[var(--faint)]",
  open: "border border-[var(--control)]",
  warning: "bg-[var(--warning)]",
  negative: "bg-[var(--negative)]",
  positive: "bg-[var(--positive)]",
  hue: "bg-[var(--hue)]",
};

export function Status({ dot = "muted", children, title }) {
  return (
    <span
      title={title}
      className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-small text-muted"
    >
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[dot]}`} />
      {children}
    </span>
  );
}

// A pale tint with dark text of the same hue. Reserved for a fact that needs a
// decision: a clock time a task is due at.
export function Tag({ tone = "warning", children, title }) {
  const ink = { warning: "text-stamp", negative: "text-stamp", positive: "text-furniture" }[tone];
  return (
    <span
      title={title}
      className={`inline-flex flex-none items-center gap-1 whitespace-nowrap border border-current px-1.5 py-px font-narrow text-small font-semibold tabular ${ink}`}
    >
      {children}
    </span>
  );
}

// ── Controls ─────────────────────────────────────────────────────────────
// One filled primary per screen, near-black. A secondary is the surface with a
// 1px border; a tertiary is text. All three share one height in a row.
export function Button({ as: Tag = "button", kind = "secondary", className = "", children, ...rest }) {
  const base =
    "press inline-flex h-9 flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 text-body font-medium";
  const look = {
    primary: "bg-[var(--primary)] text-[var(--primary-ink)] hover:opacity-90",
    secondary:
      "border border-[var(--control)] bg-surface text-ink hover:bg-raised",
    ghost: "text-muted hover:bg-raised hover:text-ink",
    danger:
      "border border-[var(--negative)] text-[var(--negative)] hover:bg-[var(--pill-negative-bg)]",
  }[kind];
  return (
    <Tag className={`${base} ${look} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// A small control for a title row or a card header: 28px, quiet until hovered.
export function MiniLink({ href, children, className = "" }) {
  return (
    <a
      href={href}
      className={`press inline-flex h-7 flex-none items-center gap-1 whitespace-nowrap rounded-control border border-[var(--control)] bg-surface px-2 text-small text-muted hover:bg-raised hover:text-ink ${className}`}
    >
      {children}
    </a>
  );
}

// Underline tabs on a full-width rule, the indicator 2px and as wide as the
// label. This replaced a row of filled black pills, which read louder than the
// data they filtered.
export function Tabs({ items, className = "" }) {
  return (
    <div className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div className="flex min-w-max gap-5 border-b border-edge">
        {items.map((t) => (
          <a
            key={t.href + t.label}
            href={t.href}
            aria-current={t.on ? "page" : undefined}
            className={`press -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-body ${
              t.on
                ? "border-ink font-medium text-ink"
                : "border-transparent text-muted hover:border-[var(--control)] hover:text-ink"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`tabular text-small ${t.on ? "text-muted" : "text-faint"}`}>
                {t.count}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────
// An empty block keeps its frame and says one true sentence in the product's
// own words.
export function Empty({ children }) {
  return (
    <p className="rounded-card border border-dashed border-edge px-4 py-3 text-body text-muted">
      {children}
    </p>
  );
}

// Loading: the final layout with each value replaced by a flat grey bar at its
// real size, so nothing shifts when the data lands.
//
// The bars are still. A shimmer sweep is decoration, and a pulse is a looping
// attention animation on something a person sees dozens of times a day: the
// layout appearing in grey already says "this is arriving", and saying it
// twice only makes the wait louder.
export function Bar({ w = "100%", h = 14, className = "" }) {
  return (
    <span
      aria-hidden
      className={`block rounded-[3px] bg-raised ${className}`}
      style={{ width: w, height: h }}
    />
  );
}

// One task row's worth of bars, on the row's real pitch.
export function RowSkeleton({ n = 5 }) {
  return (
    <div className="overflow-hidden rounded-card border border-edge bg-surface px-5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-rule py-3 last:border-0">
          <Bar w={18} h={18} className="flex-none rounded-[4px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar w={`${52 + ((i * 13) % 28)}%`} h={14} />
            <Bar w={`${28 + ((i * 7) % 16)}%`} h={12} />
          </div>
          <Bar w={84} h={14} className="hidden flex-none lg:block" />
          <Bar w={52} h={14} className="flex-none" />
        </div>
      ))}
    </div>
  );
}

// The screen while its data is on the way: the title row, then the shape of
// the page it is about to become.
export function ScreenSkeleton({ rows = 6 }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="mb-6 space-y-2.5">
        <Bar w={180} h={26} />
        <Bar w={420} h={14} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
        <div className="min-w-0 space-y-3">
          <Bar w={160} h={16} />
          <RowSkeleton n={rows} />
        </div>
        <div className="min-w-0 space-y-3">
          <Bar w={140} h={16} />
          <RowSkeleton n={3} />
        </div>
      </div>
    </div>
  );
}

// A quiet notice: a pale amber field with a 1px edge, never a ground.
export function Notice({ children, tone = "warning" }) {
  const bg = tone === "negative" ? "var(--pill-negative-bg)" : "var(--pill-warning-bg)";
  const ink = tone === "negative" ? "var(--pill-negative-ink)" : "var(--pill-warning-ink)";
  const edge = tone === "negative" ? "#f3c6c2" : "#fde68a";
  return (
    <p
      role="status"
      style={{ background: bg, color: ink, borderColor: edge }}
      className="rounded-card border px-4 py-2.5 text-meta leading-snug"
    >
      {children}
    </p>
  );
}

// ── The bot's day ────────────────────────────────────────────────────────
// This product's own element, and the only place on the home screen that
// carries the hue.
//
// The boards are a window onto a bot that runs on a clock: four or five fixed
// moments when it chases the team and reports back. Read as a vertical track —
// the clock on the left, a dot on the track, one sentence saying what happens —
// so the shape of the day is seen before it is read: filled dots behind you,
// hollow dots ahead, and a single hue line for *now* between the two.
//
// An earlier build drew this as a horizontal axis and it failed, because five
// unlabelled marks on a line only read quickly to someone who already knew what
// they meant. Every mark here carries its time and its sentence.
export function DayList({ slots, nowMin, nowLabel }) {
  const next = slots.find((s) => s.min > nowMin);
  const started = slots.length > 0 && nowMin >= slots[0].min;
  const ended = slots.length > 0 && nowMin > slots[slots.length - 1].min;

  return (
    <ol className="relative">
      {/* The track. It runs between the first and last dot, not past them. */}
      <span
        aria-hidden
        className="absolute left-[4.4rem] top-5 bottom-5 w-px bg-[var(--rule)]"
      />

      {slots.map((s) => {
        const past = s.min <= nowMin;
        const isNext = s === next;
        return (
          <li key={s.time + s.kind}>
            {/* now, between the slot it has passed and the one it has not */}
            {isNext && started && (
              <p className="relative flex items-center gap-2.5 py-1" aria-hidden>
                <span className="w-[3.75rem] flex-none text-right text-small tabular font-medium text-[var(--hue)]">
                  {nowLabel}
                </span>
                <span className="flex-none" style={{ width: 17 }}>
                  <span className="block h-px w-full bg-[var(--hue)]" />
                </span>
                <span className="h-px flex-1 bg-[var(--hue)] opacity-30" />
              </p>
            )}

            <div className="relative flex items-start gap-2.5 py-2">
              <span
                className={`w-[3.75rem] flex-none pt-px text-right text-meta tabular ${
                  past ? "text-faint" : "font-medium text-ink"
                }`}
              >
                {s.time}
              </span>
              <span className="relative flex-none pt-[5px]" style={{ width: 17 }}>
                <span
                  aria-hidden
                  className={`block h-[7px] w-[7px] rounded-full ring-4 ring-[var(--surface)] ${
                    past
                      ? "bg-[var(--control)]"
                      : "border border-[var(--control)] bg-[var(--surface)]"
                  }`}
                  style={{ marginLeft: 5 }}
                />
              </span>
              <span className={`min-w-0 flex-1 text-body ${past ? "text-faint" : "text-ink"}`}>
                {s.what}
                {past && <span className="sr-only"> — already sent</span>}
              </span>
            </div>
          </li>
        );
      })}

      {ended && (
        <li className="relative flex items-center gap-2.5 pt-1" aria-hidden>
          <span className="w-[3.75rem] flex-none text-right text-small tabular font-medium text-[var(--hue)]">
            {nowLabel}
          </span>
          <span className="flex-none" style={{ width: 17 }}>
            <span className="block h-px w-full bg-[var(--hue)]" />
          </span>
          <span className="h-px flex-1 bg-[var(--hue)] opacity-30" />
        </li>
      )}
    </ol>
  );
}
