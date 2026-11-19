# UI redesign — round two

The first redesign dressed the app in WhatsApp's colours. This round took that off. Everything
below describes what is in the code now; the previous direction is gone, not layered over.

## Why it was redone

The brief was that the result looked generic, badly spaced and inconsistent. Audited against the
rendered screens, almost all of it traced to one decision — *the app wears the colours of the app
it is a record of* — and to three layout habits:

| Problem | What it actually was |
|---|---|
| A saturated green band on every screen | 48px of brand chrome holding a wordmark and a page name the `h1` repeated 54px below. 0 of 23 studied products put a saturated bar on a light screen. |
| The accent was entirely on chrome | Green band, green nav badges, teal active pill, green bubbles — and every number in grey. Exactly inverted. |
| Three numbers labelled "Needs attention" on one screen | Menu badge 14, view pill 20, figure strip 14. Two definitions of one word, 40px apart. A real bug. |
| A ~540px void on every task row | A five-column table stretched to 1150px with short content. |
| 2,508px of blank inside the calendar's month card | It was stretched to the height of the day column beside it. |
| The same status chip on all five rows | Under a heading that already said it, and it pushed every description 110px right. |
| Row pitch jittering 42px → 90px | Notes and the remark disclosure each added a line. |
| Five identical full-width panels down the dashboard | The screen's question framed exactly like the WhatsApp help manual. |
| The transcript failed its checks | Violet `#6d4ad0` sender names, a cream `#efeae2` ground, 4.2:1 meta text, a sticky date chip sitting on top of a bubble. |

## Direction

Dealt by tasteskill, not invented: **`achromatic-ledger`**, seed 1939230577, kind `support`,
shell **open plane**. Its one move is *no colour anywhere in the chrome*, which is the direct
answer to the audit above.

- **Shell.** A 256px labelled sidebar on the page ground with one hairline beside the canvas, and
  **no desktop top bar**. The phone keeps a 48px bar (menu + screen name) on the same ground.
- **Colour.** Under 1% of the screen, and only where it carries a fact:
  `--negative` on the figure that answers a screen's question when the answer is bad and on an age
  past a week; `--warning` on a task due at a clock time; `--hue` (`#1d5fbf`) on the live marks —
  *now* on the bot's day, today on the calendar; `--positive` on closed work. The one filled button
  is near-black. Selection, everywhere, is a neutral grey pill.
- **Face.** The ground is a low-chroma blue-grey `#f2f4f7` — the sheet's "ledger" face, which is
  what these boards are. Cards are white one tone step above it.
- **Type.** Six sizes: 12 / 13 / 14 / 16 / 24 / 30. Title 24/600, figures 30, body 14.
- **Signature element.** *The bot's day*: the four or five fixed moments the bot chases the team,
  read as a vertical track with the clock on the left, filled dots behind you, hollow dots ahead
  and a single hue line for *now* between them. Live from `BRIEF_TIME` / `PENDING_TIMES` /
  `REVIEW_TIME` / `NUDGE_TIME`.
- **Typeface kept, deliberately.** The sheet dealt Geist; the code keeps IBM Plex Sans / Plex Mono.
  Geist on an off-white ground is named in the skill's own registry as the generated-dashboard kit
  face, and Plex is a characterful grotesk with true tabular figures, already self-hosted by
  `next/font`. The inspector is run with `--allow font-not-dealt` for this reason.

### Greys, measured

Three tiers, each ≥4.5:1 on **every** surface it can land on — white, the ground, `--raised`, and
the `--active` fill of a selected row — and 1.8× apart in luminance so they read as three:

| Token | Value | Worst case |
|---|---|---|
| `--text` | `#0a0a0a` | 15.4:1 |
| `--muted` | `#444954` | 7.0:1 |
| `--faint` | `#5b6170` | 4.8:1 |

## What changed, screen by screen

| Screen | Change |
|---|---|
| **Shell** | Green band deleted. Sidebar on the ground, neutral active pill, counts as plain tabular figures instead of filled discs, product and scope named at the top, the freshness line moved to the sidebar foot (it used to repeat at the bottom of every page). |
| **Today** | Two balanced bands of two instead of five stacked panels. The lead figure and its sentence head the block that owns it. The bot's day gets its own column. The team board becomes a real summary with its two figures, not a one-row table. The memory-store warning is a quiet notice, not a full-width slab. |
| **Needs attention** | Underline tabs replace filled black pills. The duplicate four-cell figure strip is gone — each section leads with its own count. The list pairs with a sticky "Closed in the last 7 days" rail. |
| **All open tasks** | Pairs with a new **Open per person** rail (name, *n* behind, total, and a 2px proportional bar), which both fills the void and answers the question the list raises. |
| **Completed** | Pairs with **Closed per person**. |
| **Mine** | Open list, with "Done in the last 7 days" as the rail. |
| **People** | Identity column no longer the narrowest; each other column sized to its content; one pitch; `Open` right-aligned with zeros in grey; last message as recency (`10:48 AM`, `Yesterday`, `17 Nov`) instead of nine rows each repeating the date. Forms follow the settings two-column pattern; Remove is last, in its own section, with its consequence in words. The reference material moved to a rail. |
| **Calendar** | The month keeps its own height. One mark per cell: the assigned figure, red when some of that day's work is behind — the separate red dot fired on nearly every past day and had become a texture. A legend whose swatches *are* the marks replaces the "left figure / middle figure" caption. Three-letter weekday headers (`M T W T F S S` had two T's and two S's). Neutral filter pills. |
| **Messages** | No green, no cream wallpaper, no per-person hue. The two sides are told apart by alignment and one tone step. Sender names in ink; the date chip is no longer sticky, so it cannot sit on a bubble. Bubbles capped at a readable measure. |
| **Team board** | Leads with a **Behind** panel and its figure. Product named by a masthead, since there is no sidebar here. |
| **Invalid link** | A centred card rather than three sentences adrift on a 1440px ground. |

## Task row

One component, used on every screen, rebuilt around three rules:

1. Every description starts on **one left edge** — the status chip moved out of the text's way.
2. State + owner in one fixed right slot, age in another, so states read as a column and ages line
   up digit for digit.
3. The note and the remark toggle **share line two**, so a row with history is no taller than a row
   with a note.

## Motion

Feedback only — nothing performs an entrance, because these screens are opened many times a day.
Press `scale(0.97)` at 140ms; rows answer with their fill rather than a scale, which would wobble
the text; hover gated behind `(hover: hover) and (pointer: fine)` so a tap does not stick it; the
remark chevron at 160ms; the tick's check fading in at 150ms; input borders at 150ms; the phone's
nav sheet at 180ms scaling from the menu button, not from its own centre. Every curve is a custom
`cubic-bezier`, nothing runs past 240ms, and `prefers-reduced-motion` drops every transform while
keeping opacity and colour.

**Loading** is new: `app/loading.js` and one per dynamic route render the final layout with each
value replaced by a flat grey bar at its real size, so nothing shifts when the data lands. No
shimmer sweep — it holds still under reduced motion.

## Backend changes

Three, all read-only or bug fixes; nothing the team receives changed.

- `Boards.attentionLists()` is new and is now the single source for the Needs attention screen's
  contents. The menu count, the view pill and the sections all read from it, so the three cannot
  disagree. **It also de-duplicates:** a task that was both Ankit's own and stuck on Ankit matched
  both halves of the old expression and was drawn twice.
- `Boards.recency()` formats a timestamp as recency for the People table.
- The attention head also returns `recent`, `load` and `closedLoad` — tallies derived from rows
  already read, for the rails.

## Checks run

- `npm test` — **17/17 pass**.
- `npm run build` — clean.
- tasteskill `inspect --app` on the **production** build at 1440 / 768 / 390 across 13 screens:
  **0 FAIL everywhere.** Two rules are allowed and named: `font-not-dealt` (above) and `emoji`
  (the bot's own messages contain 📌 and ✅, so in a transcript they are message content, not
  decoration).
- Dark theme built and inspected separately (home, attention, thread): 0 FAIL. It is true neutral —
  no navy, no slate — and elevation is lightness alone.
- Behaviour re-tested against the production build: tick done → 303; team key POSTing to `/act`
  → 403; CSV download; people add → 303 and remove → 303; the team board contains 0 occurrences of
  the master key.

### Warnings left, and why

| Screen | Warning | Why it stands |
|---|---|---|
| attention, open, closed, mine, people | `ragged-row` | A sticky right rail beside a list that can run to 37 rows. `app-screens.md` §3.4 sanctions exactly this; the rail travels with the scroll, so the uneven bottom edge is never on screen. |
| people | `numeric-align` (9 of 18 cells) | The phone-number column. These are fixed-length identifiers in a monospace face, not quantities — the digits already line up. |
| team | `below-fold` (2 of 7 blocks) | Block one is *Behind*, which is the board's whole question. The rest are one section per person. |
| badlink | empty space | A stale-link page with three sentences. Filling 1440px would mean inventing content. |

## Known issues / left for you

1. **`/` is unauthenticated and lists every board link, the master one included.** Pre-existing,
   not introduced here, but anyone reaching the site root gets the master board. Worth a key or a
   login.
2. **Outgoing history starts from the deploy.** `messages_out` is empty on your MongoDB until the
   bot sends something; `npm run backfill` rebuilds the one recoverable kind (replies forwarded
   onto a task). Unchanged by this round.
3. The one-tick-only and "sent by the schedule" marks are still deliberate. Real delivered/read
   ticks need Meta's status webhook subscribed and stored.
4. Dark mode is written and verified but **off**: `app/layout.js` pins `data-theme="light"`. Change
   it to `"dark"`, or remove the attribute to follow the device.
5. Screenshots are in `.taste-skill/` (git-ignored): `v2-before-*` is what this round started from,
   `final2-*` is where it ended, `dark-*` is the dark theme.
