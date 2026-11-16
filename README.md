# Ankit Desk – WhatsApp task bot (Next.js + MongoDB + Tailwind, JavaScript)

Ankit gives tasks by WhatsApp voice note or text. The team gets them on WhatsApp, replies once a day, and the bot follows up automatically. Live web boards show the status of every business.

**Stack:** Next.js 15 (App Router, JavaScript) · MongoDB (Atlas) · Tailwind CSS · Node 20 · node-cron · WhatsApp Cloud API · OpenAI (Whisper for voice, GPT for understanding messages).

`npm test` runs 8 end-to-end scenarios with simulated WhatsApp and AI. All pass.

> **It is a WhatsApp chatbot.** WhatsApp itself is the chat screen, so there is no chat page in this code. Meta sends every message to `POST /api/webhook`; the bot replies through the WhatsApp Cloud API. Until the webhook is connected to Meta you will only see the web boards.

---

## What it does

| When | What happens |
|---|---|
| Any time | Ankit sends a voice note or text. AI turns it into tasks (several per message are fine) and confirms with task numbers |
| Instantly | **P1** tasks ("P1", "urgent", "aaj", "abhi") go to the person straight away |
| 12:00 PM, 4:00 PM | **P2** tasks (default) go as ONE combined message per person |
| 6:00 PM | ONE check-in per person listing all their open tasks. They reply once, by text or voice: "1 done, 2 working, 3 stuck – need sir's approval" |
| 7:00 PM | One reminder, only to people who haven't replied |
| 8:30 AM | Ankit's brief: yesterday's score, pending on Ankit, P1 not done, each business, who didn't reply, notes |

Messages go out only when there is something to deliver. Unfinished tasks carry forward.

**Every team message is saved word for word** (voice notes as text), and every status reply is kept as a remark on its task.

### Ankit's commands (sent to the bot)

| Command | Effect |
|---|---|
| `help` · `brief` · `list` | Commands · summary now · all open tasks |
| `done 12` · `cancel 12` · `reopen 12` | Close / cancel / reopen |
| `p1 12` · `p2 12` | Change priority |
| `move 12 EPC` · `assign 12 Narendra` | Fix business / person |
| `Himanshu 16 – approved` | Reply on a task (forwarded; a task stuck on Ankit goes back to working) |
| `msgs Himanshu` · `msgs` | Last messages word for word (one person / whole team) |
| `reminder off Narendra` · `checkin Narendra mon thu` | Per-person settings |
| `pause Narendra till 25 nov` · `resume Narendra` | Leave mode (only P1 gets through) |
| `settings` · `boards` · `newlink EPC` | Show settings · board links · replace a leaked link |

### Boards

| Board | Who | What |
|---|---|---|
| One per business (EPC, Ryan, PHMG, Minenii, HoldPoint, Pulkit) | That team | View only. Needs attention first, tasks by person, done this week. Ankit's own tasks never shown |
| Master | Ankit only | Tabs: Needs attention · Mine · **Messages** · each business. Tick to close, P1/P2, remark history per task, CSV backup |

---

## Project layout

```
app/api/webhook/route.js        WhatsApp webhook (GET verify, POST messages)
app/api/admin/run/[job]/route.js  trigger batch|checkin|nudge|brief manually (testing)
app/api/cron/route.js           one URL for the whole schedule, for serverless hosts
app/api/health/route.js         uptime check
app/board/[key]/page.js         boards (Tailwind)        components/  Board.js, TaskCard.js, AutoRefresh.js
app/board/[key]/act/route.js    master board tick / P1 / P2
app/board/[key]/export/route.js CSV backup
instrumentation.js              starts the daily scheduler when the server boots
lib/bot.js                      all behaviour (tasks, replies, check-in, nudge, brief, commands)
lib/ai.js  lib/whatsapp.js      AI and WhatsApp clients
lib/boards.js lib/settings.js   board data · per-person settings
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

The console prints board links (master + each business) with sample tasks. Open them in a browser.

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

### 5. Templates
```bash
WA_TOKEN=... WA_WABA_ID=... npm run templates
```
`task_reminder` must be **Active** in WhatsApp Manager. It is the only template the bot sends, and the only way to reach anyone outside the 24-hour window - including the very first message. If it is rejected, reword the body in `templates.json` (keep the name and the three `{{n}}` params) and resubmit.

### 6. Hosting on Railway (~₹450/month)
- Push to a **private** GitHub repo (people.yaml has phone numbers).
- Railway → New project from the repo (it uses the Dockerfile) → Variables: paste all `.env` values → Generate domain → set `BASE_URL` to it.
- **Railway (or any always-on server) is the simple path**: node-cron runs the daily schedule in-process, nothing else to set up.
- Meta → WhatsApp → Configuration → Callback URL `BASE_URL/api/webhook`, verify token = `WA_VERIFY_TOKEN`, subscribe to **messages**.
- UptimeRobot (free): monitor `BASE_URL/api/health` every 5 minutes, email alerts.

### 6b. On Vercel or another serverless host
A serverless host freezes the process between requests, so node-cron can never fire; `instrumentation.js` detects the host and switches itself off. Two things are then needed:

- **The schedule.** Point any external cron (cron-job.org, UptimeRobot, GitHub Actions) at `GET BASE_URL/api/cron?token=WA_VERIFY_TOKEN` **every 5 minutes**. One URL covers all five slots: it reads `BATCH_TIMES`, `CHECKIN_TIME`, `NUDGE_TIME`, `BRIEF_TIME`, `WORK_DAYS` and `TIMEZONE`, runs whatever is due, and claims each slot in the database so a retry can never send the same message twice. A slot is still picked up up to 59 minutes late. Vercel's own `vercel.json` crons work too (set `CRON_SECRET`), but Hobby allows only 2 cron jobs at once-a-day granularity, which is not enough for five slots — use an external cron there.
- **`BASE_URL`.** Set it in the host's variables. On Vercel it falls back to `VERCEL_PROJECT_PRODUCTION_URL` if unset, so board links keep working, but a deployment-specific URL changes on every deploy — set it explicitly to the production domain.

Voice notes are transcribed after the webhook replies to Meta, which on a frozen process means the work must be kept alive: the webhook uses `after()` and `maxDuration = 60`. Still expect a few seconds of cold start on the first message after an idle spell.

---

## Acceptance tests (with Ankit, ~45 min)

Trigger jobs instantly: `curl -X POST "BASE_URL/api/admin/run/{batch|checkin|nudge|brief}?token=WA_VERIFY_TOKEN"`

- [ ] `/api/health` ok; Ankit sends `help` → command list
- [ ] Voice note with 3 tasks (1 P1) → "Assigned (3)"; P1 arrives at once; nothing else yet
- [ ] `batch` → each person ONE combined message
- [ ] `checkin` → each person ONE list; voice reply → "Updated" with each task
- [ ] `nudge` → only non-repliers
- [ ] `brief` → stuck item under "Pending on you"; Ankit replies "Himanshu 3 – approved" → Himanshu receives it
- [ ] `msgs Himanshu` → his messages word for word; master board → Messages tab shows them
- [ ] `boards` → links; team board view-only; master tick and P1/P2 work; CSV downloads
- [ ] `pause Pulkit today` → P2 held, P1 still delivered; `resume Pulkit`
- [ ] Someone who has never messaged the bot gets the `task_reminder` template with the task in it; their reply releases the full text
- [ ] Before go-live: drop the `ankit_desk` database in Atlas (clears test data)

---

## Problems we expect, and the fixes

| Problem | Fix |
|---|---|
| Display name / template rejected | Use the owner's name; reword the template, keep its name |
| Webhook won't verify | Token must match `WA_VERIFY_TOKEN`; URL must be https and end in `/api/webhook` |
| Bot silent | Check Railway logs; sender's number must be in people.yaml (unknown numbers are ignored) |
| Wrong business / person | `move 12 Ryan` / `assign 12 Narendra` |
| Same task twice | Bot replies "Already open" |
| Ticked by mistake | `reopen 12` |
| Board link leaked | `newlink EPC` |
| Someone stops replying | "No update yesterday" in brief; 7 PM reminder |
| Server down | UptimeRobot email; missing 8:30 brief |
| Bill surprise | $10 limits on both AI accounts |
| Bot SIM lapses | Keep it recharged; losing it can lose the WhatsApp number |
| Adding a person | Add to people.yaml, push (Railway redeploys), they send "Hi" |

**WhatsApp 24-hour rule:** free-form messages only reach people who messaged the bot in the last 24 hours, so the very first message to a new person can only be a template. The bot handles it: outside the window it sends `task_reminder` with the task itself in it, and releases any held text the moment the person replies. No one has to send "Hi" first.
