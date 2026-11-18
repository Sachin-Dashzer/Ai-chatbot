# UI redesign — complete

The whole web surface of Ankit Desk has been redesigned. Nothing is left on the old look.

## Scope, as found in the source

This is a WhatsApp bot. WhatsApp is the chat screen, so the web surface is small and every
part of it was redesigned:

| Route | What it is | State |
|---|---|---|
| `/` | Today: the owner's entry screen | ✅ redesigned, checked at 1440 / 768 / 390 |
| `/board/[key]` → master, `?tab=attention` | Needs attention | ✅ |
| `/board/[key]` → master, `?tab=mine` | Ankit's own tasks | ✅ |
| `/board/[key]` → master, `?tab=messages` | Chat list (WhatsApp inbox) | ✅ |
| `/board/[key]` → master, `?tab=messages&who=<name>` | One person's thread | ✅ |
| `/board/[key]` → master, `?tab=messages&who=~all` | The merged thread | ✅ |
| `/board/[key]` → master, `?tab=<business>` | One tab per business (6) | ✅ |
| `/board/[key]` → team board | View-only board, one per business | ✅ |
| `/board/[key]` with an unknown key | Invalid-link screen | ✅ |
| `/board/[key]/act` | POST: tick done, P1/P2 | unchanged, re-tested |
| `/board/[key]/export` | CSV | unchanged, re-tested |
| `/api/webhook`, `/api/cron`, `/api/health`, `/api/admin/run/[job]` | No UI | untouched |

There is no auth screen, no settings screen, no customer/lead/sales module and no role
dashboard in this codebase — settings and commands live in WhatsApp, and `people.yaml` is the
directory. Nothing was invented to fill those gaps.

## Direction

Revised after the first round. The framed sheet and the warm palette were dropped at your
request; the chat was rebuilt as a real WhatsApp thread.

- **Layout:** one flat surface. No tinted frame, no inset sheet. The sidebar, the top bar and
  the work all sit on the same ground, separated only by 1px rules, and the content runs to the
  edge. The desktop top bar is gone entirely where a sidebar exists — with nothing real to carry
  it was 48px of empty chrome; it stays on the phone (menu + screen name) and on the team board
  (the only place the product is named).
- **Structure on the dashboard:** every block on Today is a bordered panel with its heading in a
  ruled header — one 1px border, no shadow, never nested. One gutter (24px) horizontally and
  vertically, panel padding 16/20px, canvas padding 32px at desktop. The two columns are
  balanced so the panels in a row end level (the rail shows four tasks and links out for the
  rest; "the oldest" in the title line is still computed from all of them, not just the four).
- **Colour:** cool and plain. Neutral greys, a quiet steel-blue accent (`#1f5f9e`) on links and
  the selected state only, near-black for the one filled button. Colour is otherwise reserved
  for data and status: red on the one figure that answers the screen's question and on the P1
  mark, nothing else. Dark mode follows the OS and uses the same plain palette.
- **The one exception** is the chat thread, which keeps WhatsApp's own bubble sides and greens,
  because that is the screen it is a record of.
- **Signature element:** *the bot's day* on the home screen — the five moments the bot acts
  (08:30 brief, 12:00 and 16:00 batches, 18:00 check-in, 19:00 reminder) on one axis with *now*
  marked, read live from `BRIEF_TIME` / `BATCH_TIMES` / `CHECKIN_TIME` / `NUDGE_TIME`.
- **Update (18 Nov 2026), the Today screen only:** made beginner-friendly. The four-figure KPI strip
  went — its cells overlapped ("Waiting on you" / "Needs attention" / "Stuck") and each named a panel
  below — and every number now leads the one block that explains it. *The bot's day* keeps its place as
  the signature element but is a plain list (clock, one sentence, a tick on what has gone out, "Next" on
  what is coming): the axis only read quickly to someone who already knew what its five marks meant.
  Labels are plain words, the command wall is the everyday handful with the rest behind a disclosure,
  and the webhook/health footer is gone. `slots()` now carries a `kind` and a whole sentence per slot;
  the calendar matches on `kind` instead of on the old label text.
- Style originally dealt by tasteskill: `framed-sheet`, seed 531914447, kind `smb-admin`. Its
  frame and sheet were deliberately discarded; its type scale, density and tokens remain.

## The Messages screen

Rebuilt as a WhatsApp/Interakt inbox rather than a log:

- A chat list on the left (avatar, name, last line, time, a dot on anyone who owes today's
  status) and the conversation on the right. On a phone it is one region at a time: the list,
  then the thread, with a back arrow.
- Incoming on the left in a plain bubble, outgoing on the right in WhatsApp's green, the time
  and a tick inside the bubble, date chips between days, newest at the foot. The pane opens at
  the newest message with no script: it is a `column-reverse` scroller.
- WhatsApp's `*bold*` and `_italic_` markup is rendered, so a check-in reads as it does on the
  phone instead of printing asterisks.
- In the merged "Everyone" thread each sender's name carries a stable colour, and outgoing
  bubbles name their recipient.
- **Two honest departures from WhatsApp.** There is one tick, not two: the bot knows a message
  was accepted for delivery and nothing more, so a read receipt would be invented. And anything
  the schedule sent rather than Ankit is marked "sent by the schedule".

### What this needed in the backend

The bot never stored what it sent — `messages` was an inbound-only log and all 32 outgoing
sends went straight to the Meta API. `Bot` now wraps its WhatsApp client once in the
constructor and records every send to a new `messages_out` collection. Nothing else in the send
path changed, `messages` is untouched, and a failure to log can never cost a delivered message.
Messages to Ankit himself (his brief, his command replies) are not recorded.

## What each screen answers

| Screen | Its one question |
|---|---|
| Today | Is anything waiting on me, and which board do I open? |
| Needs attention | What is stuck, and what is waiting on me? |
| Mine | What of my own is still open, and what did I close today? |
| Messages | What did the team actually say, and who still owes an update? |
| A business tab | Who in this business is behind? |
| A team board | What is my team behind on? |

The lead figure on each screen is the one its title sentence names.

## Design system

- Tokens: `app/globals.css` (`:root`, with the dark counterpart under
  `prefers-color-scheme: dark`) — ground, surface, raised, active, border, rule, control, three
  text tiers, accent, positive/negative/warning, four pill pairs, radii, spacing, three easing
  curves. `tailwind.config.js` only names them.
- Type: IBM Plex Sans 400/500/600, self-hosted by `next/font` at build. IBM Plex Mono for task
  ids, WhatsApp commands and env names only. Sizes 12 / 13 / 14 / 16 / 22 / 28.
- Components: `components/Chat.js` (the WhatsApp thread and its chat list),
  `components/Shell.js` (sidebar, top bar, phone nav, page head),
  `components/ui.js` (icons, mark, status chip, P1 mark, KPI strip, section, empty state, the
  day strip), `components/TaskCard.js` (task row), `components/Board.js` (both boards),
  `components/CopyLink.js`.
- Icons are drawn here — 16px, 1.5px stroke, `currentColor`. No icon library was added; no new
  dependency of any kind was added.

## Motion

Feedback only — nothing performs an entrance. `scale(0.97)` on press (140ms), hover and focus
on every control (120ms), the remark chevron (160ms), the tick's check fading in on hover
(150ms), the phone's nav sheet (`nav-in`, 180ms, entry only). Every curve is a custom
`cubic-bezier`; nothing runs past 240ms; `prefers-reduced-motion` drops all of it.

## What was deliberately preserved

Backend, database, API routes, the WhatsApp flow, the scheduler, board-key privacy, role
behaviour (the master key acts, a team key gets 403), `people.yaml`, every endpoint name.

`lib/` changed in three ways, none of which alters what the team receives:
- `card()` also returns the task's age in days (read-only).
- The Messages board returns both message streams and today's check-in states (read-only).
- `Bot` records outgoing messages to the new `messages_out` collection (an added write; the
  `msgs` WhatsApp command and the `messages` collection behave exactly as before).

## Checks run

- `npm test` — 10/10 pass.
- `npm run build` — clean.
- tasteskill `inspect --app` on the **production** build at 1440 / 768 / 390, light and dark:
  **0 FAIL, 0 WARN** on every screen. Three rules are allowed on the chat and named here: the
  emoji (the bot's own P1 messages contain 🔴, so it is message content, not decoration), the
  colour share (green bubbles), and below-fold blocks (a thread is a scroller).
- tasteskill `lint --app` — 0 FAIL.
- Actions re-tested against the production build: P1/P2 toggle, tick done, 303 redirect, CSV
  download, team key POSTing to `/act` → 403, team board exposing no other board's link.

## Known issues / left for you

1. **`/` is unauthenticated and lists every board link, the master one included.** This is
   pre-existing behaviour, not something the redesign introduced, but it means anyone who
   reaches the site's root gets the master board. Worth putting behind a key or a login.
2. The person filter on Messages scrolls sideways on a phone, so the last chip meets the screen
   edge. That is the intended mobile pattern; the inspector flags it as a WARN.
3. The demo seed now also writes today's check-in rows and a plausible outgoing history (the
   check-ins, P1 pushes and four replies Ankit typed), so the chat has both sides in
   `DEMO=1 STORE=memory`. Demo-only; it cannot run against MongoDB.
4. **Outgoing history starts from the deploy.** `messages_out` is a new collection, so on your
   MongoDB it is empty until the bot sends something. That is why a thread can show only the
   team's side: nothing the bot sent before now was ever stored, anywhere. The thread says so in
   one quiet line at the top rather than looking broken.

   **One kind is recoverable.** Every reply you forward onto a task is kept in `task_notes` with
   its exact text and time, and `replyToTask()` builds the sent message from the task
   deterministically, so those can be rebuilt word for word:

   ```bash
   npm run backfill            # reports what it would add, writes nothing
   npm run backfill -- --write # applies it
   ```

   It is idempotent and needs `MONGODB_URI`. Check-ins, batches and P1 pushes sent before the log
   existed are **not** recoverable — their text was built at send time from a task list that is
   not kept, and `checkin_items` is overwritten on every run. I have not reconstructed those,
   because the result would be invented messages with invented timestamps sitting in your record
   as if they were real.
5. The one-tick-only and "sent by the schedule" marks are deliberate (see above). If you want
   real delivered/read ticks, that needs Meta's status webhook subscribed and stored; say so
   and I will wire it.
6. Screenshots are in `.taste-skill/` (git-ignored): `before-*` is the original look, `L-*` the
   light theme and `D-*` the dark one.
