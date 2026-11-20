---
name: Love
description: A telegraph office's counterfoil book — green printed furniture, one vermilion datestamp, and records on white form paper.
colors:
  board: "#dce3dc"
  surface: "#ffffff"
  raised: "#edf1ec"
  active: "#d5ded4"
  edge: "#e4e9e3"
  sheet-edge: "#c6d1c5"
  rule: "#e9eee8"
  control: "#aebcac"
  ink: "#141310"
  muted: "#41514a"
  faint: "#4f5e56"
  furniture: "#1d5b45"
  stamp: "#a82a22"
  carbon: "#f3e3e0"
  carbon-rule: "#e4cdc9"
  hue: "#1d5b45"
  hue-soft: "#e3ece7"
  chat-ground: "#d5ded4"
  chat-out-bg: "#f3e3e0"
  chat-meta: "#55635b"
typography:
  kpi:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: "38px"
    letterSpacing: "-0.026em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.016em"
  fig:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.012em"
  section:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.004em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  furniture:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.005em"
  stamp:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "1.15"
    letterSpacing: "0.055em"
rounded:
  sheet: "8px"
  card: "4px"
  control: "4px"
  chip: "2px"
spacing:
  sheet-inset: "8px"
  sidebar: "236px"
  topbar: "48px"
  gutter: "24px"
  card: "16px"
  gap: "16px"
  section: "32px"
  row: "44px"
components:
  stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp}"
    rounded: "0px"
    padding: "3px 7px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.stamp}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  mini-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  record-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "0px"
    padding: "12px 0"
  counterfoil-remark:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "0px"
    padding: "8px 12px"
  tag-due:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    typography: "{typography.small}"
    rounded: "0px"
    padding: "1px 6px"
  nav-row-active:
    backgroundColor: "{colors.active}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "44px"
---

# Design System: Love

## Overview

**Creative North Star: "The Counterfoil Book"**

Love is a telegraph office. Ankit dictates, the office sets the message exactly, routes it to an address, delivers it and keeps the counterfoil as proof. Every row on these screens is the counterfoil of a message that went out — so the screens are not a dashboard of a system, they are the office's own book: a tinted board, white form paper lying on it, green printed furniture, and one vermilion datestamp struck where something needs the boss.

The system is paper-flat and hue-poor on purpose. Exactly two hues carry meaning and nothing else on the screen is ever coloured: the office's green (`furniture`) is what the form arrives printed with — labels, a person's name, the one data track, the ring around today — and the stamp pad's vermilion (`stamp`) is the state that needs Ankit. There is no third hue; a due clock time is a stamp matter, not an amber one. Every grey that carries words is tinted off the green rather than left neutral, because a neutral grey on a coloured ground reads as dirt.

Phone is the primary viewport, not the fallback. Ankit reads this standing up, several times a day, one-handed. On the phone the board shows in every gap down the whole scroll and the head of each screen sits on a bled field of board; at `lg` the board becomes a frame around a white sheet and the paper containers inside it flatten away, because a bordered white card on a white sheet is a box in a box.

**Key Characteristics:**
- Two hues with one job each, and no third
- Paper and board: tonal layering, zero shadow on content surfaces
- Mark only where there is news; an ordinary record carries plain text
- Tabular figures everywhere a column exists
- Square-ish form corners (8/4/2px) and a 0px stamp
- Phone-first; containers flatten on the desktop sheet
- Nothing under 11px

## Colors

A green-tinted office palette: a soft board, true white form paper, one printed green and one stamped vermilion, with a pink carbon duplicate for quoted words.

### Primary
- **Stamp Vermilion** (`{colors.stamp}`): the datestamp's ink. It appears on the stamp, on a lead figure whose answer is bad, on a due clock time, on the brand mark, and nowhere else. It means *this needs Ankit*. Dark mode lifts it to a warmer coral so it still clears 4.5:1.

### Secondary
- **Office Green** (`{colors.furniture}`): printed form furniture — the small narrow labels a form arrives with, a person's name on a record, the one progress track, the ring around today, the caret, the focus ring, the hover tick. It doubles as `positive`, because in this world "the office did it" and "it is done" are the same fact. `hue-soft` is its pale field, used for the calendar's own-event count and the bot-day *now* line.

### Tertiary
- **Carbon Pink** (`{colors.carbon}`, ruled with `{colors.carbon-rule}`): the carbon duplicate. Reserved for words quoted verbatim — a record's remarks, and the outbound side of a transcript. It is a material, not a status.

### Neutral
- **Book Board** (`{colors.board}`): the frame. The one place a colour owns a whole region: the sidebar, the top bar, the phone's head band, `html`/`body`, and the browser theme colour.
- **Form Paper** (`{colors.surface}`): every record sits on it.
- **Well** (`{colors.raised}`): a recess inside the paper — a track's bed, a note strip, a hovered row, a skeleton bar.
- **Selected** (`{colors.active}`): the open record, the active nav pill, text selection, and the transcript's ground.
- **Sheet Edge** (`{colors.sheet-edge}`): the one edge that has to read against the board — the desktop sheet's own 1px line.
- **Panel Edge / Row Rule** (`{colors.edge}`, `{colors.rule}`): a whisper on paper (1.15:1) and one step off white for row rules.
- **Control Edge** (`{colors.control}`): input and button borders, scrollbar thumb, the empty-value dash.
- **Ink / Muted / Faint** (`{colors.ink}`, `{colors.muted}`, `{colors.faint}`): the record itself, sentences about the data, and meta/times/counts. Measured: muted 6.6:1 on board and 8.4:1 on paper; faint 4.9:1 board, 5.9:1 paper, 4.7:1 on a selected row.

### Named Rules
**The Two Hues Rule.** Green is the office's furniture; vermilion is the state that needs Ankit. There is no third hue — a due time is stamped, not ambered — and nothing else on the screen is ever coloured.

**The One Pad Rule.** A stamp has one ink. The green and grey stamp tones were deleted during the build; a closed record is struck through and carries no second mark.

**The 11px Floor Rule.** Nothing is set under 11px, and vermilion is text-safe at 11px (4.6:1 on board, 5.9:1 on paper). Below that it falls under 4.5:1 and stops being readable ink.

**The Tinted Grey Rule.** Every grey that carries words is tinted off the green. A neutral grey on a coloured ground reads as dirt.

## Typography

**Display / Body Font:** Archivo (400/500/600, self-hosted via `next/font`, falling back to `system-ui`)
**Label Font:** Archivo Narrow (500/600) — one job only: the printed furniture of a form, and the stamp.

**Character:** A workhorse grotesk drawn for signage and forms, with true tabular figures that every column on these screens depends on. The narrow cut is set tighter than the hand that fills the form in, which is exactly how a form's printed labels behave.

### Hierarchy
- **KPI** (400, 36px/38px, -0.026em, tabular): the one figure that answers a screen's question, in a `Lead`.
- **Title** (600, 24px/30px, -0.016em): a screen's `h1` on the desktop sheet.
- **Fig** (600, 20px/24px, -0.012em): the same `h1` on a phone, and a `Stats` cell value.
- **Section** (600, 16px/22px, Archivo Narrow): every panel and section heading.
- **Body** (400, 14px/20px): the record itself; a finding sentence caps at 68ch.
- **Meta** (400, 13px/18px): who it sits with, notes, remarks, times.
- **Small** (400, 12px/16px): counts, captions, labels, legends.
- **Furniture** (600, 12px, Archivo Narrow, +0.005em, green): the labels a form is printed with.
- **Stamp** (600, 11px, Archivo Narrow, +0.055em, vermilion): the datestamp's first line; its second line is 500/11px at 0.85 opacity.

### Named Rules
**The Tabular Column Rule.** Every figure keeps its width. `.num`, `table`, `time` and `.tabular` all carry `font-variant-numeric: tabular-nums`, because a form's columns depend on it.

**The Six Sizes Rule.** Seven steps exist and no more (36/24/20/16/14/13/12, plus the 11px stamp). A new size is a redraw, not a decision.

## Layout

Two layouts, one system, with the phone as the primary.

**The frame (lg and up).** One tinted L of board holds the sidebar (`{spacing.sidebar}`, sticky, full-height) and the top bar with **no rule between them**. The work lies on a white sheet inset `{spacing.sheet-inset}` from the window's right and bottom, with a 1px `sheet-edge` line, `{rounded.sheet}` corners and **no shadow**. Sheet content is padded `{spacing.gutter}` and capped at 1240px; a `flush` screen (the transcript) drops the padding and takes the full height.

**The phone (below lg).** The sheet becomes the screen under a 48px board-tinted bar carrying the brand mark, the screen name and at most one action, with the nav behind a `details` sheet. The **Band** restores the world: it bleeds `-mx-4` / `sm:-mx-6` into a board-tinted field that holds the title, the question and its figure, then ends where the records begin — a form laid on the board. At `lg` the Band turns itself off, because the frame is already there.

**Rhythm.** 16px gap, 24px gutter, 32px between sections; cards pad 16–20px; rows sit on a 44px pitch and 12px vertical padding. Control heights are fixed: 44px tap targets and 32px nav rows on the phone, 40px fields, 36px buttons, 28px mini-links. Record lists fold to two lines below `lg` — identity on line one with the mark holding the right edge away from the thumb, the same facts in grey on line two — and at `lg` the mark moves into a fixed 104px right-aligned slot so the stamps read down the page as one column.

### Named Rules
**The Flatten-On-Sheet Rule.** Panels, rails and record groups are paper with a 1px edge and `{rounded.card}` corners on the phone, and flatten at `lg` (`lg:rounded-none lg:border-0`, often `lg:bg-transparent`). A bordered white card on a white sheet is a box in a box.

**The Board-In-Every-Gap Rule.** On the phone the board must show down the whole scroll: the bar, the Band and the inter-section gaps are all board. A phone screen that is white from edge to edge has lost the world.

**The Phone-First Rule.** The phone layout is the design; desktop is the secondary viewport. A decision that improves the sheet at the phone's expense is the wrong decision.

## Elevation & Depth

Flat. There are no shadows on content: the sheet has a 1px edge and explicitly no shadow, panels have one edge and one tone step, the stamp is ink rather than a lifted chip, and depth is carried entirely by tonal layering — board, then paper, then a `raised` well, then an `active` selection. Dark mode keeps the same rule: elevation is lightness alone, with no navy and no slate.

### Shadow Vocabulary
- **Overlay only** (`box-shadow: 0 12px 32px rgba(20,19,16,0.16)`): the phone's navigation sheet, which genuinely floats above the page. It is the single shadow in the system and it is marked as a deliberate exception in the source.
- **Ring, not shadow** (`box-shadow: inset 0 0 0 1.5px var(--furniture)` as `.ringed`): today in the calendar is ringed in pen, not filled.

### Named Rules
**The One Shadow Rule.** Only a true overlay casts a shadow. A panel, a card, a row, a stamp and the sheet itself never do.

## Shapes

A form has square corners, so the radii are tight and stepped down from the dealt sheet's 16px: `{rounded.sheet}` for the sheet, `{rounded.card}` for cards and controls, `{rounded.chip}` for a chip, and **0px for the stamp** — letterpress register cannot carry a soft corner. Borders do the work radii would: 1px edges everywhere, 1.5px around the stamp, a 2px carbon-ruled left bar on a quoted remark, a 2px underline on an active tab. The one rotation in the system is the stamp's `-3.4deg`, struck far enough off-square to read as a blow rather than a mistake; the brand mark is drawn at `-8deg` for the same reason. Nothing else tilts, and the only circles are the 7px bot-day dots and a 6px status dot.

## Components

### Buttons
- **Shape:** tight form corners (`{rounded.control}`), 36px high, all variants sharing one height in a row.
- **Primary:** one filled, near-black button per screen — ink ground, paper label; hover drops to 90% opacity.
- **Secondary:** paper with a 1px `control` border; hover fills with the `raised` well.
- **Ghost:** muted text only; hover takes the well and the full ink.
- **Danger:** paper with a vermilion 1px border and vermilion label; hover fills with the pale negative field.
- **Press feedback:** `.press` scales to 0.97 on `:active` over 140ms on `--ease-out`, with colour under 120ms. Focus is a 2px green outline offset 2px.

### Chips
- **Status dot chip:** one neutral chip at 12px, the state carried by a 6px dot inside it (faint, hollow, warning, negative, positive or hue). Neutral because a section where most rows share a state would otherwise become a stripe of colour. Rendered only where it tells the reader something the heading has not.
- **Due tag:** a narrow 12px semibold tabular label in a 1px `currentColor` box, vermilion, square. Reserved for a fact that needs a decision — the clock time a task is due at.

### Cards / Containers
- **Corner Style:** `{rounded.card}` on the phone, square-flat at `lg`.
- **Background:** paper, with a `raised` note strip under a panel header when one is present.
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** one 1px `edge` line, removed at `lg`. Never nested inside another panel — where a frame would be a fourth nesting level, use a bare `Section` heading instead.
- **Internal Padding:** 20px for a panel body, 16–20px for a cell, 12px vertical for a row.

### Inputs / Fields
- **Style:** 40px high, paper ground, 1px `control` border, `{rounded.control}`, 14px ink, faint placeholder.
- **Focus:** the border goes to full ink over 150ms; the global 2px green `:focus-visible` outline handles everything that is not a text field. Caret is green.
- **Empty value:** a 24px `control` rule rather than placeholder prose, labelled for screen readers.

### Navigation
- **Sidebar (lg):** board-tinted, part of the frame, no rule between it and the bar. Rows are 32px, 14px, muted, with a 16px drawn icon that turns green when active; the active row is an `active`-filled 4px pill with full ink. A count sits only on a queue that needs doing and is a plain tabular figure, never a badge. A foot note sits above a 1px top edge in 12px faint.
- **Phone:** a 48px board bar; the nav lives in a `details` sheet that opens with `nav-in` (180ms, `--ease-drawer`, from 0.97 scale and -6px). Tap targets are 44px.
- **Tabs:** underline tabs on a full-width rule, the 2px ink indicator exactly as wide as the label. This replaced a row of filled black pills, which read louder than the data they filtered.

### The Datestamp (signature)
The one authored moment in the system. A vermilion, square, 1.5px-bordered box rotated `-3.4deg`, stacking what happened over when it happened, struck with `stamp-strike`: 90ms, `steps(2, end)`, from 1.22 scale — two frames, no easing curve, because a stamp either has landed or has not.

It is struck **only where the state is news**: waiting on Ankit himself ("With you" / "With Ankit"), held on someone outside the team ("Held"), nothing moving for a week ("No movement"), or a person WhatsApp has no open window to ("No window"). An ordinary open record carries its age as plain text in 12px faint tabular, and a closed one carries **nothing but a struck-through line** (`line-through`, 1px, in faint). Where a section heading already names the state, only an age past a week is news.

### The Counterfoil (signature)
A record's remarks open in place under the row on the carbon duplicate: a `carbon` field with a 2px `carbon-rule` left bar and 1px rules between entries, the person's name in green furniture, the status and time in faint tabular, and the words that came back verbatim in 14px ink. This is the one place quoted words live, and the reason the pink exists.

### The True-Ratio Track (signature)
An 8px bar in the `raised` well, filled in office green at its exact ratio with both ends labelled in 12px tabular faint. At zero it renders **no bar at all**.

### The Bot's Day (signature)
A vertical track with the clock on the left, a 7px dot on a 1px rule, and one sentence per slot: filled `control` dots behind you, hollow paper dots ahead, and a single green `now` line between the two. An earlier build drew this as a horizontal axis and it failed, because five unlabelled marks on a line only read quickly to someone who already knew what they meant.

### Loading
The final layout with each value replaced by a still, flat `raised` bar at its real size, so nothing shifts when the data lands. No shimmer, no pulse: the layout appearing in grey already says "this is arriving", and saying it twice only makes the wait louder.

### Named Rules
**The News-Only Stamp Rule.** A stamp strikes only where the state is news. An ordinary open record carries its age as plain text; a closed one carries only a struck-through line. A mark on every row is the status pill this world exists to refuse, whatever shape it is cut in.

**The True Ratio Rule.** Every track is drawn at its real ratio, with no stub at zero and no padded range.

**The No-Invented-Data Rule.** Every figure on every screen comes from the store or `lib/demo.js`. A number is never written to make a layout look finished.

**The Drawn-Icon Rule.** One 16px icon set, 1.5px stroke, `currentColor`, drawn in `components/ui.js`. No emoji, no glyph fonts, no icon packages; the brand mark is a drawn struck ring, never a letter in a box.

## Do's and Don'ts

### Do:
- **Do** strike a stamp only where the state is news — with you, held, no movement, no window — and let an ordinary open record carry its age as plain text (12px faint tabular) and a closed one carry only a struck-through line.
- **Do** keep two hues with one job each: green (`#1d5b45`) for printed furniture, names, the track and the ring; vermilion (`#a82a22`) for the state that needs Ankit.
- **Do** keep the 11px floor; vermilion is text-safe at 11px and nothing is set smaller.
- **Do** give panels, rails and record groups a 1px edge on the phone and flatten them at `lg` (`lg:rounded-none lg:border-0`).
- **Do** keep the board visible in every gap down the whole phone scroll, and keep the Band under every screen head below `lg`.
- **Do** draw every track at its true ratio, with no bar at all at zero.
- **Do** take every figure from the store or `lib/demo.js`.
- **Do** set every figure tabular, and set form labels in Archivo Narrow green furniture.
- **Do** keep the stamp-strike as the only authored motion: 90ms, `steps(2, end)`, and honour `prefers-reduced-motion`, which disables it, the nav sheet and the press scale.

### Don't:
- **Don't** mark every row. A tinted pill repeated down a list is the exact device this world was built to replace.
- **Don't** introduce a third hue. A due clock time is a stamp matter; `warning` is deliberately the same vermilion as `negative`.
- **Don't** add a second stamp ink. Green and grey stamp tones were deleted; a closed line is struck through instead.
- **Don't** put a shadow on a card, a panel, a row, the sheet or the stamp. The phone nav sheet is the only shadow in the system.
- **Don't** nest a panel inside a panel, or leave a bordered white card on the white desktop sheet.
- **Don't** round the stamp. It is 0px, rotated `-3.4deg`, and square because a form has no soft corners.
- **Don't** use emoji, glyph fonts or an icon package; extend the drawn 16px set instead.
- **Don't** animate an entrance on a screen opened twenty times a day, and don't shimmer or pulse a skeleton.
- **Don't** leave a grey untinted on a coloured ground, and don't reach for navy or slate in dark mode — elevation there is lightness alone.
- **Don't** add a font size outside the seven steps, or a radius outside 8/4/2/0.

## Inspection notes

Recorded because they are standing decisions, not open defects.

**Standing inspector WARNs (both accepted).** Phone numbers on the People screen are set tabular but are identifiers, not magnitudes, so the detector's figure rule does not apply to them. The desktop `Mine` screen shows a void beside its lists — eight open rows against three closed ones on the secondary viewport — and it is left as it falls, because the phone is the primary viewport and padding the desktop column would cost the phone its rhythm.

**Detector ignores** (`.impeccable/config.json`): `nested-cards` scoped to `components/Chat.js`, because the "nested cards" are the transcript's own message bubbles — the correct and universal form for a record this product keeps word for word — and the identity tabs in the list register the same way the circular avatars they replaced did. Three further ignores (`overused-font`, `cramped-padding`, `cream-palette`) are scoped to the throwaway decision fixtures under `.impeccable/mocks/decision/`, which depict the category default and the dealt challenger worlds on purpose. The messages screen is inspected with `--allow emoji`, because the emoji are inside verbatim stored WhatsApp messages and are the record, not decoration.

**Residues the finish reviewer accepted:** the transcript's bubbles use a 10px radius, outside the 8/4/2 band; a stamped row can wrap its title at 390px; the desktop sheet ends on an empty foot; and the WhatsApp template caps are unclaimed on screen. None of these is a system rule — a new surface follows the radii and rules above, not these four.
