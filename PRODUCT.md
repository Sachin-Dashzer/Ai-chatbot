# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Ankit** is the primary and effectively the only user of the web app. He owns six small
businesses, gives work by WhatsApp voice note between meetings, and **opens these boards on his
phone** — a glance several times a day, rarely a sitting at a laptop. Confirmed with the user: the
phone layout is the primary design and desktop is secondary.

**His team** (four people in the seeded roster, editable from the app or from WhatsApp) never open
the web app. Their entire surface is WhatsApp: a task message with three reply buttons, a twice-daily
list of what is still on them, and plain replies in words. A view-only team board exists at its own
link and, confirmed with the user, nobody opens it; it is designed last.

## Product Purpose

**Love** is Ankit's assistant. She takes tasks and meetings from his voice notes, hands the work to
the right person, chases it twice a day, keeps his calendar, remembers what he tells her, and reports
at 18:00 and 19:00. The web boards are the record she keeps: what is waiting on him, who is behind,
what the team actually said, and what is ahead. Success is that he can answer "what is pending" in
one glance on a phone, and that nothing he said by voice is lost.

## Positioning

The team installs nothing, logs into nothing, and never talks to a model. Love is an assistant to one
person; to everyone else she is three buttons under a task in the chat app they already have open.
Every instruction arrives as a voice note in Hindi, English or Hinglish and leaves as corrected
English with every name, amount and date intact.

## Operating Context

- Instructions arrive as WhatsApp voice notes or text, in Hindi, English or Hinglish; transcription
  and parsing turn them into tasks, meetings, replies, memories and habits.
- A fixed day in IST: pending lists at 12:00 and 16:00 (to the team and to Ankit), his overview at
  18:00, his brief at 19:00, task and meeting reminders five minutes before, and the habits Love
  holds for him at the times she set.
- WhatsApp's 24-hour rule governs delivery: outside the window only an approved Meta template may go,
  so messages are held and released. Four templates are approved and chosen by what is waiting.
- The boards carry no login. An unguessable key in the URL is the whole of the access control, and a
  leaked link is replaced with `newlink`.
- Statuses arrive by button tap or in words and are relayed to Ankit the moment they land.

## Capabilities and Constraints

- Next.js 15 App Router, **plain JavaScript (no TypeScript)**, Tailwind CSS v3, React 19.
- MongoDB Atlas in production; an in-memory store for tests and local development only.
- Screens: Calendar, Needs attention (also the full task list and completed work), Mine, Messages,
  People, and the view-only team board. **The Today page at `/` is retired** (confirmed with the
  user); `/` redirects to the master board.
- `npm test` is 25 end-to-end scenarios with a simulated WhatsApp and AI; they must keep passing.
- `npm start` does not work on Windows as written (the script's `${PORT:-3000}` is not expanded by
  cmd); use `next start -p <port>`.
- Terminology, as Ankit and Love use it: a **task** is work handed to one person and is done or not;
  a **meeting** is a moment people have to be at and has attendees, not an owner; a **remark** is
  words a person sent about a task; **pending on you** is what is waiting on Ankit himself; a
  **habit** is a recurring reminder Love holds; **M3** numbers a meeting and **#14** a task.

## Brand Commitments

- The product is called **Love** (confirmed with the user this round; the boards were previously
  branded "Ankit Desk"). The sidebar carries a Love mark and name.
- Love's voice, warm and calm and completely professional, is written in `lib/love.js` and is
  **only ever used toward Ankit**. The team's messages stay plain and direct. The WhatsApp side is
  not part of this redesign.
- The assistant is referred to as "she" in the code and its comments, following the user's own words.

## Evidence on Hand

- Real team names and phone numbers in `people.yaml` — **sensitive**, and the repo must stay private.
- The measured record of the previous two design rounds in `REDESIGN_PROGRESS.md`, and screenshots
  of the current screens in `.taste-skill/before-r3/`.
- There are no customers, no metrics, no logos, no testimonials and no growth figures. None may be
  invented on any screen.

## Product Principles

1. **WhatsApp is the team's surface; the web is Ankit's alone.** Nothing on a board asks the team to
   go anywhere.
2. **It is read on a phone, standing up, one-handed.** Anything that needs a laptop to be legible has
   failed.
3. **The record is the product.** Every status, remark and message is kept word for word, voice notes
   as text.
4. **Love acts on the mechanical and asks on the judgement.** An approval, a rate or a promised date
   is shown to Ankit before it leaves.
5. **The board and the bot never disagree.** A figure on a screen says exactly what the 18:00
   overview says.

## Accessibility & Inclusion

- One-handed phone use: touch targets of 44px or more, no hover-only affordance.
- Every grey that carries words reaches 4.5:1 on the surface it sits on (the measured tiers in
  `REDESIGN_PROGRESS.md` are kept as a floor, whatever the new direction).
- Content is in English with Hindi and Hinglish inside quoted messages; nothing may assume Latin-only
  text or clip it.
