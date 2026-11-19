# Ankit Desk – WhatsApp task bot (Next.js + MongoDB + Tailwind, JavaScript)

Ankit gives tasks by WhatsApp voice note or text. The team gets them on WhatsApp, replies once a day, and the bot follows up automatically. Live web boards show the status of every task.

**Stack:** Next.js 15 (App Router, JavaScript) · MongoDB (Atlas) · Tailwind CSS · Node 20 · node-cron · WhatsApp Cloud API · OpenAI (Whisper for voice, GPT for understanding messages).

`npm test` runs 15 end-to-end scenarios with simulated WhatsApp and AI. All pass.

> **It is a WhatsApp chatbot.** WhatsApp itself is the chat screen, so there is no chat page in this code. Meta sends every message to `POST /api/webhook`; the bot replies through the WhatsApp Cloud API. Until the webhook is connected to Meta you will only see the web boards.

---

## What it does

| When | What happens |
|---|---|
| Any time | Ankit sends a voice note or text. AI turns it into tasks (several per message are fine) and confirms with task numbers |
| Instantly | **Every task goes straight to the person**, in full, with **Done / Working / Remark** buttons under it. No ranking, no queue, no waiting for a slot |
| 12:00 PM, 4:00 PM | ONE message per person listing everything still pending on them, and asking where each one stands. They reply once, by text or voice: "1 done, 2 working, 3 stuck – need sir's approval", or tap the buttons. This is the only list the team gets, and it is also the retry: a task WhatsApp rejected goes out here |
| 6:00 PM | **Ankit's overview**, his alone: everything he assigned today, per person, each one's status, the score, and what nobody has touched |
| 6:00 PM | One reminder, only to people who owe an answer today and haven't given one |
| 7:00 PM | Ankit's brief: yesterday's score, pending on Ankit, anything open a week or more, each person, who didn't reply, notes |

Messages go out only when there is something to deliver. Unfinished tasks carry forward.

### The bot picks the person, and asks when it is guessing

Ankit does not have to name anyone. Each person has a **`does`** line — what they handle — set in
`people.yaml`, on the People screen, or over WhatsApp (`edit Pulkit does GST refunds, TDS filings`).
"File the GST refund" then finds whoever handles GST refunds.

**The bot works these out by itself.** It watches the tasks Ankit assigns *by name* and, once a
person has five or more, drafts their line from those tasks and offers it after the evening brief:
**✅ Yes, save it / ✍️ I’ll write it / ✖️ Not now**. One person per evening at most. It never writes
one unasked, and if the tasks show no pattern it proposes nothing rather than inventing something
— a wrong line silently misroutes real work, which is worse than a blank one. “Not now” leaves it
blank for two months; ignored, it asks again in a week.

It acts on its own only when the step is mechanical, and asks first when it is a judgement:

| The bot does it itself | The bot asks Ankit first |
|---|---|
| A task where he named the person | A task where it worked the person out from their `does` |
| A reply that answers, instructs or informs | A reply that **approves** something, commits to a **rate, amount or price**, or promises a **date to a client** |
| Status updates, reminders, the daily lists | — |

When it asks, Ankit gets the message it wants to send with **Send / Someone else / Cancel** under it.
Nothing reaches the team until he taps. **A person whose `does` is empty is never picked by guess** —
the bot asks instead, so a blank line is a safe default, not a broken one.

### Meetings

"Meeting with Manish at 10" is not a task — nobody is being asked to go and do work — so it is its
own thing:

- everyone invited gets the time, what it is about and **who else is coming**, with
  **I'll be there / Can't make it / Another time** buttons (there is nothing to mark "Done" on a
  meeting, so a meeting never shows the task buttons);
- they can also just reply in words — "haan 10 baje theek hai" — and Ankit hears either way;
- it goes **on the calendar**, with who has answered and who has not;
- **everyone is reminded 5 minutes before, Ankit included.** A task reminder goes to one person;
  a meeting reminder goes to the room.

Outside WhatsApp's 24-hour window Meta allows only an approved template, so an invite to someone
who has not messaged in a day rides the template first and the full invitation follows the moment
they reply. The bot uses a `meeting_invite` template for this, so the invitation reads as an invitation
rather than "a reminder regarding…". **While that template is still in review — or if Meta ever
rejects it — the bot falls back to `task_reminder` automatically**, so nobody is left unheard
waiting on an approval, and nothing has to be switched on the day it is approved. Either way the
full invitation and its buttons arrive the moment they reply, and Ankit is told which attendees
were outside the window. Create it with `npm run templates`; `MEETING_TEMPLATE=""` turns it off.

**Every task message is checked before it leaves**: the parser writes the description in corrected, fully spelled English keeping every name, amount and date Ankit gave (it no longer shortens his instruction to a label), the message is laid out the same way every time, and the three reply buttons ride under it. A tap on **Done** or **Working** updates the task exactly as typing "1 done" would, and counts as that day's answer; **Remark** asks for words and sends them to Ankit at once.

**Every team message is saved word for word** (voice notes as text), and every status reply is kept as a remark on its task.

### Ankit's commands (sent to the bot)

| Command | Effect |
|---|---|
| `help` · `brief` · `list` | Commands · summary now · all open tasks |
| `done 12` · `cancel 12` · `reopen 12` | Close / cancel / reopen |
| `today` | Everything assigned today and its status (the 6 PM overview, on demand) |
| `assign 12 Narendra` | Hand a task to someone else |
| `Himanshu 16 – approved` | Reply on a task (forwarded; a task stuck on Ankit goes back to working) |
| `msgs Himanshu` · `msgs` | Last messages word for word (one person / whole team) |
| `reminder off Narendra` · `checkin Narendra mon thu` | Per-person settings (`checkin` sets the days an answer is expected; the pending list itself still goes out every work day) |
| `pause Narendra till 25 nov` · `resume Narendra` | Leave mode (nothing gets through; held until they are back) |
| `settings` · `boards` · `newlink team` | Show settings · board links · replace a leaked link |
| `people` | The team with every number |
| `add Rahul 919812345678 Ryan` | Add someone — reachable from that second, no deploy |
| `edit Rahul phone 919…` · `edit Rahul name …` · `edit Rahul alias CA Rahul` | Change one part |
| `remove Rahul` | Stop everything reaching them; their history stays |

### Boards

| Board | Who | What |
|---|---|---|
| Team | The team | View only. Needs attention first, tasks by person, done this week. Ankit's own tasks never shown |
| Master | Ankit only | Tabs: Needs attention · Mine · **Messages** · **People**. Tick to close, remark history per task, CSV backup. **Needs attention is also the whole task list**: the row of filters at the top switches between what needs chasing, **All open tasks** (every open task, oldest first) and **Completed** (every finished task, newest first, with the date it closed and how long it took). Ticking a task keeps you in the filter you were in. The Messages screen lists the whole team, with one merged thread or one person at a time. The People screen adds, edits and removes team members |

---

## Project layout

```
app/api/webhook/route.js        WhatsApp webhook (GET verify, POST messages)
app/api/admin/run/[job]/route.js  trigger pending|review|nudge|brief manually (testing)
app/api/cron/route.js           one URL for the whole schedule, for serverless hosts
app/api/health/route.js         uptime check
app/board/[key]/page.js         boards (Tailwind)        components/  Board.js, TaskCard.js, AutoRefresh.js
app/board/[key]/act/route.js    master board tick
app/board/[key]/export/route.js CSV backup
instrumentation.js              starts the daily scheduler when the server boots
lib/bot.js                      all behaviour (tasks, buttons, replies, pending round, nudge, review, brief, commands)
lib/ai.js  lib/whatsapp.js      AI and WhatsApp clients
lib/boards.js lib/settings.js   board data · per-person settings
lib/people.js                   the team list: seed, validate, add, edit, remove (one set of rules for the screen and the chat)
app/board/[key]/people/route.js master board People screen writes      components/People.js
lib/store/mongo.js  memory.js   MongoDB store · in-memory store (tests/demo)
lib/scheduler.js lib/runtime.js lib/time.js lib/config.js lib/demo.js
people.yaml  templates.json  scripts/create-templates.js  tests/
```

---

## See it running in 2 minutes (no WhatsApp, no database)

```bash
npm install
npm run build
DEMO=1 STORE=memory npm start
```

The console prints board links (master + team) with sample tasks. Open them in a browser.

---

## Setup (about 4–5 hours + Meta review time)

### 1. Meta / WhatsApp
1. Bot number must **not** be on the WhatsApp app (Ankit's second number has never been – nothing to delete).
2. business.facebook.com → business portfolio in Ankit's or Minenii's name. **Business verification is not needed** (unverified accounts can message 250 people a day).
3. developers.facebook.com → Create App (type Business) → add WhatsApp.
4. **Test first, today:** WhatsApp → API Setup gives a free **test number + temporary token**. Add Ankit's number as a recipient, use these in `.env`, connect the webhook (step 6) and test end to end. Then register the real number.
5. Real number: API Setup → Add phone number → display name e.g. "Ankit Choudhary" → verify by SMS.
6. Business Settings → System users → Admin → assign the app + WhatsApp account → **Generate token** (`whatsapp_business_messaging`, `whatsapp_business_management`) = permanent `WA_TOKEN`.
7. Note Phone number ID, WhatsApp Business Account ID, App Secret. Add a payment method in WhatsApp Manager.

### 2. API keys
- OpenAI (platform.openai.com). Buy $5 credit; set a $10 monthly limit. This is separate from the ChatGPT app subscription.

### 3. Database
- MongoDB Atlas → free M0 cluster (Mumbai region) → database user → Network Access: allow `0.0.0.0/0` (or Railway's IPs) → copy the connection string into `MONGODB_URI`.
- Turn on Atlas backups if available on your tier; Ankit also downloads the CSV from the master board weekly.

### 4. Config
- `cp .env.example .env` and fill every value.
- `people.yaml`: team numbers are filled. **Add Ankit's main WhatsApp number as `owner`** (the number he sends commands from, not the bot number).

  The file is the **seed**: the first run copies its people into the database, and from then on the team is edited from the People screen or from WhatsApp, with no redeploy. The file stays the record of the **owner** (never editable from a phone or a browser — a wrong number there locks him out of his own bot).

### 5. Templates
```bash
WA_TOKEN=... WA_WABA_ID=... npm run templates
```
`task_reminder` must be **Active** in WhatsApp Manager. It is the only template the bot sends, and the only way to reach anyone outside the 24-hour window - including the very first message. Its body takes **three** params, the person's name, the work itself and a due date, and carries no button: the person reads the task in the template, with nothing to tap. Text too long for the parameter is cut there, and that row still arrives in full as plain text once the window opens.

If your approved template has another name, set `FIRST_TEMPLATE`; it must take exactly three body params, or Meta rejects the send - 132001 for a name that does not exist in your WABA, 132000 for the wrong number of params. To see what is actually approved:
```bash
curl -s "https://graph.facebook.com/v23.0/$WA_WABA_ID/message_templates?fields=name,language,status,components" \
  -H "Authorization: Bearer $WA_TOKEN"
```

### 6. Hosting on Railway (~₹450/month)
- Push to a **private** GitHub repo (people.yaml has phone numbers).
- Railway → New project from the repo (it uses the Dockerfile) → Variables: paste all `.env` values → Generate domain → set `BASE_URL` to it.
- **Railway (or any always-on server) is the simple path**: node-cron runs the daily schedule in-process, nothing else to set up.
- Meta → WhatsApp → Configuration → Callback URL `BASE_URL/api/webhook`, verify token = `WA_VERIFY_TOKEN`, subscribe to **messages**.
- UptimeRobot (free): monitor `BASE_URL/api/health` every 5 minutes, email alerts.

### 6b. On Vercel or another serverless host
A serverless host freezes the process between requests, so node-cron can never fire; `instrumentation.js` detects the host and switches itself off. Two things are then needed:

- **The schedule.** `vercel.json` already carries it: one cron entry per slot, each once a day, hitting `/api/cron`. **Set `CRON_SECRET` in the Vercel project** — Vercel only sends the `Authorization: Bearer` header when that variable exists, and without it the endpoint answers 403 and nothing is sent. Entries are **UTC** and the slots are IST (+5:30), so `30 6` = 12:00, `30 10` = 16:00, `30 12` = 18:00, `30 13` = 19:00. Hobby fires within 59 minutes *after* the scheduled minute and `/api/cron` claims a slot up to 59 minutes late, so the jitter is absorbed on every plan; a test fails if a configured time has no entry covering it. Any external cron (cron-job.org, UptimeRobot) works the same way against `GET BASE_URL/api/cron?token=WA_VERIFY_TOKEN` — one URL covers all five slots (two pending rounds, review, reminder, brief), reading `PENDING_TIMES`, `REVIEW_TIME`, `NUDGE_TIME`, `BRIEF_TIME`, `WORK_DAYS` and `TIMEZONE` (`BATCH_TIMES`/`CHECKIN_TIME` are still read as their old names), and claiming each slot in the database so a retry can never send twice. `.github/workflows/cron.yml` is a backup for the due-time reminders only: GitHub throttles scheduled workflows hard (observed: 3 runs in 12 hours, not the `*/10` asked for), so do not rely on it for the fixed slots. It needs a `CRON_URL` secret and skips itself when that is missing.
- **`BASE_URL`.** Set it in the host's variables. On Vercel it falls back to `VERCEL_PROJECT_PRODUCTION_URL` if unset, so board links keep working, but a deployment-specific URL changes on every deploy — set it explicitly to the production domain.

Voice notes are transcribed after the webhook replies to Meta, which on a frozen process means the work must be kept alive: the webhook uses `after()` and `maxDuration = 60`. Still expect a few seconds of cold start on the first message after an idle spell.

---

## Acceptance tests (with Ankit, ~45 min)

Trigger jobs instantly: `curl -X POST "BASE_URL/api/admin/run/{pending|review|nudge|brief}?token=WA_VERIFY_TOKEN"`

- [ ] `/api/health` ok; Ankit sends `help` → command list
- [ ] Voice note with 3 tasks → "Assigned (3)"; all three arrive at once, each with Done / Working / Remark under it
- [ ] Tap **Working** on one → the board shows it working within a minute; tap **Remark**, type a line → Ankit gets it at once
- [ ] A long instruction with names, amounts and dates arrives whole, not summarised
- [ ] `pending` → each person ONE list of what is still on them, asking for status; voice reply → "Updated" with each task; nobody gets a second list that evening
- [ ] `review` → Ankit alone gets the day's overview, with every person and status
- [ ] `today` → the same overview on demand
- [ ] `nudge` → only non-repliers
- [ ] `brief` → stuck item under "Pending on you"; Ankit replies "Himanshu 3 – approved" → Himanshu receives it
- [ ] Master board → Messages → pick a person; only their thread is shown
- [ ] Master board → People → add someone; they appear on the list, can be assigned a task at once, and `people` in WhatsApp shows them. Edit their number, then remove them: the removal is refused while they still have an open task
- [ ] `msgs Himanshu` → his messages word for word; master board → Messages tab shows them
- [ ] `boards` → links; team board view-only; master tick works; CSV downloads
- [ ] `pause Pulkit today` → nothing reaches him, everything is held; `resume Pulkit` → the next pending round delivers it
- [ ] Someone who has never messaged the bot gets the `task_reminder` template with the task named in it, and their reply does not repeat it
- [ ] `start Narendra` sends that template on demand; `start all` does the whole team
- [ ] Before go-live: drop the `ankit_desk` database in Atlas (clears test data)

---

## Problems we expect, and the fixes

| Problem | Fix |
|---|---|
| Display name / template rejected | Use the owner's name; reword the template, keep its name |
| Webhook won't verify | Token must match `WA_VERIFY_TOKEN`; URL must be https and end in `/api/webhook` |
| Bot silent | Check Railway logs; sender's number must be in people.yaml (unknown numbers are ignored) |
| Wrong person | `assign 12 Narendra` (reassigning delivers it to the new person at once) |
| Same task twice | Bot replies "Already open" |
| Ticked by mistake | `reopen 12` |
| Board link leaked | `newlink team` |
| Someone stops replying | "No update yesterday" in brief; 6 PM reminder |
| Server down | UptimeRobot email; missing 7 PM brief |
| Bill surprise | $10 limits on both AI accounts |
| Bot SIM lapses | Keep it recharged; losing it can lose the WhatsApp number |
| Adding a person | Master board → People → Add, or send `add Rahul 919812345678 Ryan`. Live in seconds, no deploy |

**WhatsApp 24-hour rule:** free-form messages only reach people who messaged the bot in the last 24 hours, so the very first message to a new person can only be a template. The bot handles it: outside the window it holds the task, sends the approved `task_reminder` template with the task text as its second param, and on the person's reply releases only what the template could not carry - so nothing arrives twice. No one has to send "Hi" first. To open the window before there is a task to send, Ankit sends `start Narendra` (or `start all`).

**Which template opens the window.** Four are approved, in two shapes: `task_reminder` and
`meeting_invite` carry the content in their body, while `task_update` and `daily_task_update` say
only that something is waiting and carry a **View tasks** button that opens the window when tapped.
The bot picks by what is actually held — a meeting gets `meeting_invite`; the twice-daily list gets
`daily_task_update` before the second round and `task_update` after it, because a numbered list run
onto one line is not a list; anything long enough to be cut at WhatsApp’s 900-character parameter
limit gets `task_update`, since a truncated instruction reads as a complete one; everything else
gets `task_reminder`, so the work is read without anyone having to tap. If a template is rejected
or still in review it falls through to the next, ending at `task_reminder`. Only `task_reminder`
ever counts as having delivered the message, so the full text still arrives on reply in every other
case. Override any of them with `MEETING_TEMPLATE`, `DAILY_TEMPLATE`, `TASK_TEMPLATE` or
`FIRST_TEMPLATE`.
