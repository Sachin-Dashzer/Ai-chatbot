---
version: 1
slug: "app-board-key-page-js"
primary_target: "app/board/[key]/page.js"
related_targets: ["app/calendar/page.js","components/Board.js","components/Shell.js","components/ui.js"]
---

## Scope

Love's web boards, phone-first (390px is the primary design, desktop secondary). Visitor mode:
Operate. Five screens: Needs attention (also all open tasks and completed), Mine, Chats, People,
Calendar, plus the view-only team board last. Ankit is the only visitor, on his phone, several
glances a day. The Today page at `/` is retired and redirects.

## Direction contract

THESIS: These boards are the counterfoil book of a telegraph office. Love takes a dictation, sets it
exactly, routes it to an address, delivers it and keeps the counterfoil as proof — so every row on
screen is the counterfoil of a message that went out, and the screen refuses the category's floating
white cards with a status pill repeated down every row.

OWN-WORLD: Ground is a postal-green board `#DCE3DC`; records sit on white form paper; printed
furniture is postal green `#1D5B45`; text ink `#141310`; one stamp vermilion `#A82A22`, text-safe and
never under 11px; quoted words sit on carbon pink `#F3E3E0`. Archivo with Archivo Narrow for form
furniture; tabular figures on every number. Flat unmodulated colour, no grain, no paper texture.
Surfaces divide by a 1px seam, never a shadow. The signature move is the datestamp: a dated vermilion
stamp whose wording is the state (ACCEPTED 12:04, HELD no reply 24 h, ANSWERED 15:22), struck
slightly off-square on the record. Done work is struck through; today is ringed. Every track is drawn
at its true ratio, with no stub at zero.

STORY: He glances at his phone between meetings and learns, in one screen, what is waiting on him and
what happened to each thing he sent — then taps one stamp to read the words, verbatim, that came back.

FIRST VIEWPORT (390x844): a 48px bar on the ground carrying the Love stamp-ring mark, the wordmark
and the screen's name, with the menu at the right. Under it the screen's question in postal green,
then its one figure at 40px that no other figure on the screen touches, then the finding in one
sentence naming what it is measured against. Below that the sheet: form rows on white paper, each
with the person in narrow green, the whole instruction in ink, its number right-aligned, and its
stamp struck at the row's right. The day's track closes the screen. Signature interaction: tapping a
record's stamp opens its counterfoil — every status and remark word for word with its time, on carbon
pink. Motion grammar: a stamp lands in a 90ms two-frame step with no easing curve, as a stamp
strikes; nothing else on the screen moves, and reduced motion drops the step.

FORM: The Counterfoil Book — Indian P&T inland telegram forms and money-order counterfoil books.
Candidate 4 of my ordered list of 7, assigned by the roll; raised by five named donations from the
challengers it beat (full-strength colour owning a region, state as a hand mark, a mark's length is
its quantity, flat colour with no grain, hairline seams with the destructive act isolated).
seed:8c0a4f03dec6bb45

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

No login: an unguessable board key is the whole access control. Plain JavaScript, Tailwind v3,
Next.js 15 App Router, React 19; `npm test` (25 scenarios) must keep passing. Every grey that carries
words reaches 4.5:1; nothing under 11px; touch targets 44px or more. No invented data of any kind —
the screens render from the real store, or from `lib/demo.js` under `DEMO=1`.

## Unresolved

Whether the team board keeps its own look or inherits this one wholesale — decided when it is built,
last.
