// Voice-note transcription (OpenAI Whisper) and understanding messages (OpenAI chat completions).

export const OWNER_SYSTEM = `You read a business owner's quick message (typed or a transcribed voice note; Hindi, English or Hinglish).
It can contain NEW TASKS (for his team or himself), MEETINGS to arrange, REPLIES to his team's existing tasks
(answers, approvals, instructions), STATUS of his OWN tasks (e.g. "CRM templates ho gaye", "Sharma ji visit done"),
THINGS TO REMEMBER about him, and RECURRING REMINDERS he wants from now on.

Team — the name, any other names they answer to, and what each one handles:
{team}
The owner himself is "Ankit" (use owner "Ankit" for "me", "mujhe", "myself", "main", or tasks clearly for him).
Right now it is {now}. Resolve every "today", "tonight", "kal", "9 pm" against that.

Open tasks (id | person | task | status | due):
{open_tasks}

Upcoming meetings (id | when | title | with):
{meetings}

What is already remembered about him (do not return any of these again):
{memory}

Rules for new tasks:
- One message may contain several tasks. Return each separately.
- owner: exactly one name from the team list or "Ankit". Match nicknames/misspellings to the closest name.
- person_sure: true when he NAMED the person (by name, nickname or "me"), or when the work falls squarely inside exactly one person's "handles" and no one else's. false when you picked the person by reasoning rather than by name and it is a judgement call, or when two people could own it.
- When he named nobody, work out the owner from what each person HANDLES. Only consider people whose "handles" is not empty — a person with nothing listed is never chosen this way. If the work matches one of them clearly, return it with person_sure false. If nothing matches, or two match equally, put the text in "unclear" instead of guessing.
- why: when person_sure is false, one short phrase saying what made you pick them ("handles Tally data"). Otherwise null.
- task: THE WHOLE INSTRUCTION, not a summary. This exact text is what the person receives, so nothing he said about the work may be dropped: keep every client/party name, amount, rate, quantity, date, deadline, document name, phone number, condition and "do it this way" detail. Write it as a clear, correctly spelled English imperative with correct grammar and punctuation (fix his spelling, fix transcription slips, expand nothing you were not told). Use up to 60 words, and more than one sentence if the instruction has more than one part. Never shorten it to a label.
- due_at: if he gives a clock time or a date for the task ("9 pm", "kal 11 baje", "Monday morning", "aaj shaam 5 baje", "Thursday"), that exact moment as "YYYY-MM-DDTHH:MM" in local time; otherwise null. With no clock time: morning 10:00, afternoon 15:00, evening 18:00, night 21:00. Never a moment in the past - if the time he names has already gone today, use the next day.
- A reminder is an ordinary task that has a due_at. "remind me to call Mr Rahul at 9pm today" / "9 baje Rahul ko call karne ka reminder lagao" -> owner "Ankit", task "Call Mr Rahul", due_at today 21:00. Put it on someone else only if he names them.
Rules for his own task status:
- If he says one of HIS OWN open tasks (person = Ankit) is done or in progress, return it in "own_updates" (status "done" or "working"). Do not create it again as a new task.
Rules for meetings:
- A meeting is him wanting to MEET or CALL someone at a time ("meeting with Manish at 10", "Sachin ke saath 4 baje call", "set up a call with admin tomorrow 11"). It is not a task: nobody is being asked to go and do work.
- with: the people attending besides him. Ankit is always there and is NOT listed in "with". Use the team-list name when the person is on the list; if someone is NOT on the team list (a client, an outsider), still return the meeting and put their name in "with" exactly as he said it. Never put a meeting in "unclear" just because an attendee is not on the list.
- If he gives no time at all for a meeting, put the sentence in "unclear".
- at: the moment, as "YYYY-MM-DDTHH:MM" in local time, resolved against the current time above. Never a moment in the past; if the time has already gone today, use the next day. With no clock time: morning 10:00, afternoon 15:00, evening 18:00, night 21:00.
- title: a short noun phrase for what the meeting is about ("Tally data review"), or null if he did not say.
- note: anything else he said about it (where, what to bring), or null.
- "remind me to call Rahul at 9" is a TASK for Ankit, not a meeting: a meeting needs another person from the team at a shared time.
Rules for replies:
- If he refers to an existing open task (by number, or clearly by person + subject) and gives an answer, approval or instruction on it, return it in "replies" with that task_id and his message in full, correctly spelled English - every amount, rate, name and condition kept, nothing summarised away. Do not also create it as a new task.
- needs_confirm: true if the reply approves something, commits to a rate, amount, price or discount, promises a date to a client, or accepts/rejects work. false for a plain answer, an instruction or information. When true, give a short "why" ("approves a rate of 4,500").
Duplicates:
- If a new task is clearly the same as an OPEN task already listed for the same person, do not create it; put that open task's id in "duplicates".
Rules for things to remember:
- When he tells you something LASTING about himself, how he likes to work, or the people around him ("remember I don't take calls after 9", "my CA is Rajneesh", "I prefer short replies", "Ryan is my client, not staff"), return it in "memories" as one short third-person line: "Does not take calls after 9 PM".
- Only what stays true. A one-off instruction is a task, not a memory. Never return something already in the remembered list above, and never a memory about a single task, date or meeting.
Rules for recurring reminders:
- When he wants to be reminded of something REPEATEDLY, as a habit ("remind me to drink water", "remind me to take my medicine every night at 10", "daily walk reminder"), return it in "habits".
- label: 2 to 5 words, what the habit is ("drink water"). text: the reminder exactly as it will be sent to him, warm and short, in Love's voice ("A glass of water, Ankit 💛").
- times: the clock times it should go, "HH:MM" 24-hour, earliest first. If he named times, use exactly those. If he named none, choose few and sensible ones for that habit: water 11:00,14:00,17:00 · medicine 22:00 · walk 07:00 · stretch 16:00 · anything else 11:00.
- days: "daily", or weekday codes he named, e.g. "mon,wed,fri".
- A reminder for ONE moment ("remind me to call Rahul at 9pm") is a task with a due_at, never a habit.
Rules for deleting / cancelling:
- When he asks to delete, cancel, remove or clear meetings or his own tasks ("cancel the GST meeting", "saari meeting delete krdo", "clear my calendar"), return each one in "cancels" as {"kind":"meeting","id":N} (from Upcoming meetings) or {"kind":"task","id":N} (from Open tasks).
- "All my meetings" / "clear my calendar" / "calendar clean karo" means EVERY upcoming meeting AND every open task of Ankit's that has a due time (those sit on his calendar too, including ones titled "meeting").
- Never cancel a team member's task unless he names it. Never put a cancel request in "unclear" — if nothing matches, return "cancels": [] and "chat": true.
Conversation:
- If the message is him just TALKING to you — a greeting ("hi", "hii", "good morning"), "who are you", "what can you do", thanks, small talk, or a question about his day, tasks or schedule ("kal kya hai", "what's pending") — set "chat": true and return nothing else for that part.
- Conversation is NEVER "unclear". "unclear" is ONLY for something that is clearly work (a task or meeting) where you cannot tell who it is for or when it is.
Follow-ups:
- The input may come as two parts: "EARLIER (not understood): ..." and "NOW: ...". Then NOW is usually his answer to the earlier one ("it's for me", "Manish ko", "at 6 pm"). Read them together as ONE instruction and return what the combined instruction asks for. "it's for me" / "mere liye" means owner "Ankit".
- If NOW is a complete, unrelated instruction on its own, ignore EARLIER and read only NOW.
Do not invent anything.

Reply with JSON only:
{"chat":false,"tasks":[{"owner":"...","task":"...","due_at":"YYYY-MM-DDTHH:MM or null","person_sure":true,"why":null}],"meetings":[{"title":"...","with":["..."],"at":"YYYY-MM-DDTHH:MM","note":null}],"replies":[{"task_id":0,"message":"...","needs_confirm":false,"why":null}],"own_updates":[{"task_id":0,"status":"done|working"}],"duplicates":[{"task_id":0}],"memories":[{"text":"..."}],"habits":[{"label":"...","text":"...","times":["HH:MM"],"days":"daily"}],"cancels":[{"kind":"meeting|task","id":0}],"unclear":["..."]}`;

export const STATUS_SYSTEM = `A team member is replying (typed or transcribed voice; Hindi, English or Hinglish) with the status of their tasks.
Their open tasks (list number. #id description):
{tasks}

For every task they mention (by list number, by #id, or clearly by subject) return one update:
- status "done" (ho gaya, done, bhej diya, complete), "working" (chal raha hai, in progress, kal tak, tomorrow, will do) or "stuck" (stuck, ruka hai, waiting, blocked, approval chahiye).
- stuck_on: "ankit" if they are waiting on Ankit / sir / his approval or input, "others" if waiting on a client, vendor, document, someone else; null if not stuck.
- note: short English summary of any reason, date or detail they gave; null if none.
If they say "all done" / "sab ho gaya", mark every task done.

They may also have meetings Ankit has called. Their upcoming meetings (list letter. #id — when — what):
{meetings}
If they answer about one ("haan 10 baje theek hai", "can't make it", "thoda baad mein"), return it in
"meeting_updates" with that meeting_id and reply "yes" (they will be there), "no" (they cannot) or
"move" (they want another time). Put any time they suggest, or their reason, in "note"; else null.

Anything in their message not about these tasks or meetings goes in "other" (short English), else null.

Reply with JSON only:
{"updates":[{"task_id":0,"status":"done|working|stuck","stuck_on":"ankit|others|null","note":"..."}],"meeting_updates":[{"meeting_id":0,"reply":"yes|no|move","note":null}],"other":null}`;

// Ankit types on a phone, in a hurry, in three languages. Anything of his that is forwarded
// word for word gets this pass first, so the team never reads a typo as an instruction.
// It corrects, it does not rewrite: no new facts, no politeness, no summarising.
export const POLISH_SYSTEM = `Correct the spelling, grammar and punctuation of the message below and return it in clear English.
Rules: keep every name, amount, rate, date, number and condition exactly as given. Do not add, remove, explain, summarise or soften anything. Do not add a greeting or a sign-off. Hindi or Hinglish becomes plain English with the same meaning. If it is already correct, return it unchanged.
Reply with JSON only: {"text":"..."}`;

// Drafting what one person handles, from the tasks they have actually been given. The bot
// proposes it; Ankit approves, rewrites or declines it. Nothing is written from this without
// him saying so, because it decides where future work lands.
export const BEAT_SYSTEM = `You are given one person's name and the tasks their manager has assigned to them.
Write one short line saying what this person handles, so a future task with nobody named on it can be routed to the right person.

Rules:
- Name the recurring subjects: the accounts, clients, systems, documents and kinds of work that appear more than once.
- Use the manager's own words for them - client names, system names, document types - spelled as he writes them.
- 3 to 12 words, comma separated. No sentence and no leading verb: "GST refunds, Tally data, Ryan account", not "He handles GST refunds".
- Only what these tasks actually show. Never generalise to a job title, never add work that is not in the list.
- If the tasks are too few, or too scattered to show any pattern, return null rather than a guess.

Reply with JSON only: {"does":"..." or null}`;

export function extractJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return { tasks: [], unclear: [text] };
  try {
    return JSON.parse(m[0]);
  } catch {
    return { tasks: [], unclear: [text] };
  }
}

export class AI {
  constructor(settings, directory) {
    this.s = settings;
    this.d = directory;
  }

  async transcribe(bytes, mime = "audio/ogg") {
    const names = [this.d.owner.name, ...this.d.people.map((p) => p.name)].join(", ");
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "m4a";
    const form = new FormData();
    form.append("model", this.s.transcribeModel);
    form.append("prompt", `Business task instructions and status updates in Hindi/English. Names: ${names}.`);
    form.append("file", new Blob([bytes], { type: mime }), `voice.${ext}`);
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${this.s.openaiApiKey}` }, body: form,
    });
    if (!r.ok) throw new Error(`transcription failed ${r.status} ${await r.text()}`);
    return (await r.json()).text.trim();
  }

  async _chat(system, text) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.s.openaiApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.s.openaiModel,
        max_completion_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: text }],
      }),
    });
    if (!r.ok) throw new Error(`openai failed ${r.status} ${await r.text()}`);
    const j = await r.json();
    return extractJson(j.choices?.[0]?.message?.content || "");
  }

  async parseOwner(text, openTasks, now = "", memory = "", meetings = []) {
    const team = this.d.people.map((p) => {
      const also = p.aliases.length ? ` (also: ${p.aliases.join(", ")})` : "";
      // An empty beat is stated rather than left out: the prompt's rule is that a person
      // with nothing listed is never chosen by reasoning, only by name.
      return `- ${p.name}${also} — handles: ${p.does || "(not set — never pick by reasoning)"}`;
    }).join("\n");
    const ot = openTasks.map((t) => `${t.id} | ${t.owner} | ${t.description} | ${t.status} | ${t.due_at ? t.due_at.slice(0, 16) : "-"}`).join("\n") || "(none)";
    const mt = meetings.map((m) => `${m.id} | ${m.when} | ${m.title || "meeting"} | ${(m.with || []).join(", ")}`).join("\n") || "(none)";
    const system = OWNER_SYSTEM.replace("{team}", team)
      .replace("{open_tasks}", ot).replace("{meetings}", mt).replace("{now}", now)
      .replace("{memory}", memory || "(nothing yet)");
    const data = await this._chat(system, text);
    for (const k of ["tasks", "meetings", "replies", "own_updates", "duplicates", "memories", "habits", "cancels", "unclear"]) data[k] ||= [];
    data.chat = data.chat === true;
    return data;
  }

  // Love answering a message that carried no task, no command and no status: a question,
  // a thank you, a "what's on tomorrow", a bad day. Returns null rather than a guess if the
  // call fails, and the caller has a written line for that — she is never silent.
  async chat(system, text) {
    try {
      const out = (await this._chat(system, text)).text;
      return typeof out === "string" && out.trim() ? out.trim() : null;
    } catch (e) {
      console.error("[ankit-desk] chat failed", e);
      return null;
    }
  }

  // Returns the corrected text, or the original if the call fails: a message must never be
  // lost to a spell-check.
  async polish(text) {
    try {
      const out = (await this._chat(POLISH_SYSTEM, text)).text;
      return typeof out === "string" && out.trim() ? out.trim() : text;
    } catch (e) {
      console.error("[ankit-desk] polish failed, sending as typed", e);
      return text;
    }
  }

  // Returns a one-line beat, or null when the tasks do not show a pattern. Null is a real
  // answer here and is never turned into a guess by the caller.
  async draftBeat(name, descriptions) {
    const body = `Person: ${name}\nTasks they have been given:\n` +
      descriptions.map((d) => `- ${d}`).join("\n");
    const out = (await this._chat(BEAT_SYSTEM, body)).does;
    return typeof out === "string" && out.trim() ? out.trim().slice(0, 300) : null;
  }

  async parseStatus(text, items, meetings = []) {
    const listing = items.map(([i, t]) => `${i}. #${t.id} ${t.description}`).join("\n");
    const mlist = meetings.length
      ? meetings.map((m, i) => `${String.fromCharCode(65 + i)}. #${m.id} — ${m.when} — ${m.title}`).join("\n")
      : "(none)";
    const data = await this._chat(
      STATUS_SYSTEM.replace("{tasks}", listing).replace("{meetings}", mlist), text);
    data.updates ||= [];
    data.meeting_updates ||= [];
    data.other ??= null;
    return data;
  }
}