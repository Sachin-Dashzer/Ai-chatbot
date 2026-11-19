// Messages: the record of what the team actually said.
//
// It is a transcript, not a copy of WhatsApp. The previous build wore
// WhatsApp's own skin — green bubbles, a cream wallpaper, a violet sender
// colour — which put more saturated pixels on this one screen than on the rest
// of the product put together, and failed both the palette and the contrast
// check. Here the two sides are told apart the way every other surface in the
// app is told apart: by alignment and one tone step.
//
// Two honest departures from WhatsApp remain: there is one tick, not two,
// because the bot knows a message was accepted for delivery and nothing more;
// and anything the schedule sent rather than Ankit says so.
import { Icon, Status } from "./ui";

// WhatsApp's own markup, which the bot writes into the messages it sends.
// Rendered rather than printed, so a pending list reads as it does on the
// phone instead of showing its asterisks.
function Rich({ text }) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/).map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// A preview is one line: no markup, no newlines.
const plainOneLine = (text) => text.replace(/[*_~]/g, "").replace(/\s*\n+\s*/g, " ").trim();

// A person is known by their initial and their name, not by a colour. The
// previous build gave each sender a hue from a six-colour wheel, which put
// indigo and magenta on an otherwise achromatic screen to say something the
// name already said.
function Avatar({ name, size = 36 }) {
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full bg-raised text-meta font-medium text-muted"
      style={{ width: size, height: size, boxShadow: "inset 0 0 0 1px var(--border)" }}
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

// ── The chat list ────────────────────────────────────────────────────────
function ChatList({ data, boardKey }) {
  // One h1 per screen: it belongs to whichever pane the reader is actually in.
  const H = data.hasSelection ? "h2" : "h1";
  const waiting = data.chats.filter((c) => c.state === "waiting").length;
  const href = (who) => `/board/${boardKey}?tab=messages&who=${encodeURIComponent(who)}`;

  return (
    <>
      <div className="flex h-14 flex-none items-center justify-between gap-3 border-b border-edge px-4">
        <H className="text-section font-semibold text-ink">Chats</H>
        <p className="text-small text-faint">
          {data.checkinSent ? `${waiting} still to reply` : `list goes out at ${data.listTime}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <a
          href={href("~all")}
          aria-current={data.hasSelection && !data.selected ? "page" : undefined}
          className="press-row hover-row flex items-center gap-3 border-b border-rule px-4 py-3 aria-[current=page]:bg-active"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-raised text-faint"
            style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            <Icon.inbox width={16} height={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-medium text-ink">Everyone</span>
            <span className="block truncate text-meta text-faint">
              All {data.chats.length} conversation{data.chats.length === 1 ? "" : "s"} in one thread
            </span>
          </span>
        </a>

        {data.chats.map((c) => (
          <a
            key={c.name}
            href={href(c.name)}
            aria-current={data.selected === c.name ? "page" : undefined}
            className="press-row hover-row flex items-center gap-3 border-b border-rule px-4 py-3 aria-[current=page]:bg-active"
          >
            <Avatar name={c.name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                {/* A row's identity stays in ink: grey is for meta only. */}
                <span className="truncate text-body font-medium text-ink">{c.name}</span>
                {c.last && (
                  <span className="flex-none text-small tabular text-faint">{c.last.time}</span>
                )}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-meta text-muted">
                  {c.last ? (
                    <>
                      {c.last.out && <span className="text-faint">You: </span>}
                      {c.last.voice && (
                        <span
                          className="mr-1 inline-flex translate-y-[2px] text-faint"
                          title="Voice note"
                        >
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
        className={`max-w-[85%] rounded-[10px] px-3 py-2 sm:max-w-[72%] lg:max-w-[min(62%,34rem)] ${
          out ? "rounded-br-[3px]" : "rounded-bl-[3px]"
        }`}
        style={{
          background: out ? "var(--chat-out-bg)" : "var(--chat-in-bg)",
          color: "var(--text)",
          boxShadow: out ? "none" : "inset 0 0 0 1px var(--border)",
        }}
      >
        {showName && (
          <p className="mb-1 text-meta font-semibold text-ink">
            {out ? `to ${m.person}` : m.person}
          </p>
        )}

        {(m.auto || m.voice) && (
          <p
            className="mb-1 flex items-center gap-1 text-small"
            style={{ color: "var(--chat-meta)" }}
          >
            {m.auto ? <Icon.clock width={11} height={11} /> : <Icon.mic width={11} height={11} />}
            {m.auto ? "sent by the schedule" : "voice note, transcribed"}
          </p>
        )}

        <p className="whitespace-pre-wrap break-words text-body">
          <Rich text={m.text} />
          <span
            className="float-right ml-3 mt-[7px] inline-flex translate-y-px items-center gap-1 text-small leading-none tabular"
            style={{ color: "var(--chat-meta)" }}
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
      <div className="flex h-14 flex-none items-center gap-3 border-b border-edge px-3 sm:px-4">
        <a
          href={`/board/${boardKey}?tab=messages`}
          aria-label="Back to all chats"
          className="press -ml-1 flex h-8 w-8 flex-none items-center justify-center rounded-control text-muted hover:bg-raised hover:text-ink lg:hidden"
        >
          <Icon.chevron width={16} height={16} className="rotate-180" />
        </a>
        {data.selected ? <Avatar name={title} size={32} /> : null}
        <div className="min-w-0 flex-1">
          <H className="truncate text-section font-semibold text-ink">{title}</H>
        </div>
        {chat && <Status dot={STATE[chat.state].dot}>{STATE[chat.state].label}</Status>}
      </div>

      {/* column-reverse: the newest day sits at the foot and the pane opens
          there, the way a chat does, without a line of script. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-chat-ground py-3">
        {data.thread.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-muted">
            Nothing from {data.selected || "the team"} yet. Messages appear here the moment they
            reach the bot.
          </p>
        ) : (
          [...data.thread].reverse().map((d) => (
            <section key={d.day}>
              {/* Not sticky. A sticky chip inside a column-reverse scroller sat
                  on top of the first bubble of its own day. */}
              <p className="my-3 flex justify-center">
                <span
                  className="rounded-chip px-2 py-0.5 text-small font-medium"
                  style={{
                    background: "var(--chat-in-bg)",
                    color: "var(--chat-meta)",
                    boxShadow: "inset 0 0 0 1px var(--border)",
                  }}
                >
                  {d.day}
                </span>
              </p>
              <div className="space-y-1.5">
                {d.items.map((m, i) => (
                  <Bubble key={i} m={m} showName={showName} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Last in the DOM, so in a column-reverse pane it sits at the very top
            of the conversation, above the oldest message it explains. */}
        {data.partial && (
          <p
            className="mx-auto mb-2 max-w-[52ch] px-4 text-center text-small leading-snug"
            style={{ color: "var(--chat-meta)" }}
          >
            {data.outFrom
              ? `Only the team's side is kept before ${data.outFrom}. What the bot sent earlier was never stored, so it cannot be shown.`
              : "Nothing the bot sends has been recorded yet. From now on both sides of every conversation are kept here."}
          </p>
        )}
      </div>

      <p className="flex-none border-t border-edge px-4 py-2.5 text-small text-faint">
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
        className={`min-h-0 w-full flex-none flex-col border-r border-edge bg-surface lg:flex lg:w-[336px] ${
          sel ? "hidden" : "flex"
        }`}
      >
        <ChatList data={data} boardKey={boardKey} />
      </aside>
      <section
        className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${sel ? "flex" : "hidden"}`}
      >
        <Thread data={data} boardKey={boardKey} />
      </section>
    </div>
  );
}
