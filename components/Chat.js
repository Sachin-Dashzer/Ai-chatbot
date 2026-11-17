// The Messages screen, as the WhatsApp thread it is a record of: a chat list
// on the left, the conversation on the right. Incoming on the left in a plain
// bubble, outgoing on the right in WhatsApp's green, time and a sent tick
// inside the bubble, date chips between days, newest at the foot.
//
// Two honest departures from WhatsApp: there is one tick, not two, because the
// bot knows a message was accepted for delivery and nothing more; and anything
// the schedule sent rather than Ankit carries an "auto" mark.
import { Icon, Status } from "./ui";

// WhatsApp's own markup, which the bot writes into the messages it sends.
// Rendered rather than printed, so a pending list reads as it does on the phone.
function Rich({ text }) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/).map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// A preview is one line: no markup, no newlines.
const plainOneLine = (text) => text.replace(/[*_~]/g, "").replace(/\s*\n+\s*/g, " ").trim();

const WHO_COLOURS = 6;
// A person's colour has to be the same on every visit, so it comes from their
// name rather than from their position in a list that reorders itself.
function whoIndex(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return h % WHO_COLOURS;
}
const whoColour = (name) => `var(--who-${whoIndex(name)})`;

function Avatar({ name, size = 36 }) {
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full text-[13px] font-medium"
      style={{
        width: size, height: size,
        color: whoColour(name),
        background: "var(--raised)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const STATE = {
  replied: { dot: "positive", label: "replied" },
  waiting: { dot: "warning", label: "not yet" },
  none: { dot: "open", label: "—" },
};

// ── The group filter ─────────────────────────────────────────────────────
// Ankit works one business at a time, so choosing a group narrows the list to
// the people registered under it, and the merged thread with it. Chips rather
// than a select: the whole roster stays one tap away either way. Choosing a
// group closes the open chat, because that person may not be in the new one.
function GroupFilter({ groups, group, boardKey }) {
  if (!groups?.length) return null;
  return (
    <div className="flex flex-none gap-1.5 overflow-x-auto border-b border-rule px-4 py-2">
      {[["", "All"], ...groups.map((g) => [g, g])].map(([value, label]) => {
        const on = group === value;
        return (
          <a
            key={label}
            href={`/board/${boardKey}?tab=messages${value ? `&group=${encodeURIComponent(value)}` : ""}`}
            aria-current={on ? "true" : undefined}
            className={`press inline-flex h-7 flex-none items-center rounded-chip border px-2.5 text-small ${
              on ? "border-ink bg-ink text-[var(--surface)]" : "border-[var(--control)] text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}

// ── The chat list ────────────────────────────────────────────────────────
function ChatList({ data, boardKey }) {
  // One h1 per screen: it belongs to whichever pane the reader is actually in.
  const H = data.hasSelection ? "h2" : "h1";
  const waiting = data.chats.filter((c) => c.state === "waiting").length;
  const tail = data.group ? `&group=${encodeURIComponent(data.group)}` : "";
  const href = (who) => `/board/${boardKey}?tab=messages&who=${encodeURIComponent(who)}${tail}`;

  return (
    <>
      <div className="flex h-12 flex-none items-center justify-between gap-3 border-b border-edge px-4">
        <H className="text-body font-semibold">{data.group || "Chats"}</H>
        <p className="text-small text-faint">
          {data.checkinSent ? `${waiting} still to reply` : `list goes out at ${data.listTime}`}
        </p>
      </div>

      <GroupFilter groups={data.groups} group={data.group} boardKey={boardKey} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <a
          href={href("~all")}
          aria-current={data.hasSelection && !data.selected ? "page" : undefined}
          className="press flex items-center gap-3 border-b border-rule px-4 py-3 aria-[current=page]:bg-active hover:bg-active/60"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-raised text-faint"
            style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            <Icon.inbox width={16} height={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-medium">{data.group ? `Everyone in ${data.group}` : "Everyone"}</span>
            <span className="block truncate text-meta text-muted">
              All {data.chats.length} conversation{data.chats.length === 1 ? "" : "s"} in one thread
            </span>
          </span>
        </a>

        {data.chats.map((c) => (
          <a
            key={c.name}
            href={href(c.name)}
            aria-current={data.selected === c.name ? "page" : undefined}
            className="press flex items-center gap-3 border-b border-rule px-4 py-3 aria-[current=page]:bg-active hover:bg-active/60"
          >
            <Avatar name={c.name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body font-medium">{c.name}</span>
                {c.last && <span className="flex-none text-small tabular text-faint">{c.last.time}</span>}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-meta text-muted">
                  {c.last ? (
                    <>
                      {c.last.out && <span className="text-faint">You: </span>}
                      {c.last.voice && (
                        <span className="mr-1 inline-flex translate-y-[2px] text-faint" title="Voice note">
                          <Icon.mic width={12} height={12} />
                        </span>
                      )}
                      {plainOneLine(c.last.text)}
                    </>
                  ) : (
                    <span className="text-faint">No messages yet</span>
                  )}
                </span>
                {c.state === "waiting" && (
                  <span
                    aria-label="has not replied to today's list"
                    title="Has not replied to today's list"
                    className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--warning)]"
                  />
                )}
              </span>
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

// ── One bubble ───────────────────────────────────────────────────────────
function Bubble({ m, showName }) {
  const out = m.out;
  return (
    <div className={`flex px-3 ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-bubble px-2.5 py-1.5 sm:max-w-[75%] lg:max-w-[62%] ${
          out ? "rounded-tr-none" : "rounded-tl-none"
        }`}
        style={{
          background: out ? "var(--chat-out-bg)" : "var(--chat-in-bg)",
          color: out ? "var(--chat-out-ink)" : "var(--chat-in-ink)",
          boxShadow: out ? "none" : "0 1px 0 rgba(17,20,24,0.06)",
        }}
      >
        {showName && !out && (
          <p className="mb-0.5 text-meta font-medium" style={{ color: whoColour(m.person) }}>
            {m.person}
          </p>
        )}

        {/* In the merged thread an outgoing bubble has to name its recipient,
            or three identical lists read as one conversation. */}
        {showName && out && (
          // The sender hues are tuned for the incoming bubble, so a recipient
          // label takes the green bubble's own meta colour instead.
          <p className="mb-0.5 text-meta font-medium" style={{ color: "var(--chat-meta-out)" }}>
            to {m.person}
          </p>
        )}

        {m.auto && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px]" style={{ color: out ? "var(--chat-meta-out)" : "var(--chat-meta)" }}>
            <Icon.clock width={11} height={11} />
            sent by the schedule
          </p>
        )}

        {m.voice && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px]" style={{ color: out ? "var(--chat-meta-out)" : "var(--chat-meta)" }}>
            <Icon.mic width={11} height={11} />
            voice note, transcribed
          </p>
        )}

        <p className="whitespace-pre-wrap break-words text-[14px] leading-[19px]">
          <Rich text={m.text} />
          <span
            className="float-right ml-2 mt-[7px] inline-flex translate-y-[1px] items-center gap-1 text-[11px] leading-none tabular"
            style={{ color: out ? "var(--chat-meta-out)" : "var(--chat-meta)" }}
          >
            {m.time}
            {out && <Icon.check width={12} height={12} strokeWidth={2} />}
          </span>
        </p>
      </div>
    </div>
  );
}

// ── The thread ───────────────────────────────────────────────────────────
function Thread({ data, boardKey }) {
  const H = data.hasSelection ? "h1" : "h2";
  const showName = !data.selected;
  const title = data.selected || "Everyone";
  const chat = data.selected ? data.chats.find((c) => c.name === data.selected) : null;

  return (
    <>
      <div className="flex h-12 flex-none items-center gap-3 border-b border-edge px-3 sm:px-4">
        <a
          href={`/board/${boardKey}?tab=messages${data.group ? `&group=${encodeURIComponent(data.group)}` : ""}`}
          aria-label="Back to all chats"
          className="press -ml-1 flex h-8 w-8 flex-none items-center justify-center rounded-control text-muted hover:bg-active hover:text-ink lg:hidden"
        >
          <Icon.chevron width={16} height={16} className="rotate-180" />
        </a>
        {data.selected ? <Avatar name={title} size={32} /> : null}
        <div className="min-w-0 flex-1">
          <H className="truncate text-body font-semibold">{title}</H>
          {chat && <p className="truncate text-small text-faint">{chat.business}</p>}
        </div>
        {chat && <Status dot={STATE[chat.state].dot}>{STATE[chat.state].label}</Status>}
      </div>

      {/* column-reverse: the newest day sits at the foot and the pane opens
          there, the way a chat does, without a line of script. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-chat-ground py-3">
        {data.thread.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-muted">
            Nothing from {data.selected || "the team"} yet. Messages appear here the moment they reach the bot.
          </p>
        ) : (
          [...data.thread].reverse().map((d) => (
            <section key={d.day}>
              <p className="sticky top-0 z-10 my-2 flex justify-center">
                <span
                  className="rounded-chip px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: "var(--chat-in-bg)", color: "var(--chat-meta)", boxShadow: "0 1px 0 rgba(17,20,24,0.06)" }}
                >
                  {d.day}
                </span>
              </p>
              <div className="space-y-1.5">
                {d.items.map((m, i) => <Bubble key={i} m={m} showName={showName} />)}
              </div>
            </section>
          ))
        )}

        {/* Last in the DOM, so in a column-reverse pane it sits at the very top
            of the conversation, above the oldest message it explains. */}
        {data.partial && (
          <p className="mx-auto mb-2 max-w-[46ch] px-4 text-center text-[11px] leading-snug" style={{ color: "var(--chat-meta)" }}>
            {data.outFrom
              ? `Only the team's side is kept before ${data.outFrom}. What the bot sent earlier was never stored, so it cannot be shown.`
              : "Nothing the bot sends has been recorded yet. From now on both sides of every conversation are kept here."}
          </p>
        )}
      </div>

      <p className="flex-none border-t border-edge px-4 py-2 text-small text-faint">
        A record, not a composer. Replies go out from WhatsApp, or from Ankit typing to the bot.
      </p>
    </>
  );
}

export default function Chat({ data, boardKey }) {
  const sel = data.hasSelection;
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={`min-h-0 w-full flex-none flex-col border-r border-edge lg:flex lg:w-[320px] ${
          sel ? "hidden" : "flex"
        }`}
      >
        <ChatList data={data} boardKey={boardKey} />
      </aside>
      <section className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${sel ? "flex" : "hidden"}`}>
        <Thread data={data} boardKey={boardKey} />
      </section>
    </div>
  );
}
