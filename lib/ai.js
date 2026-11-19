// Voice-note transcription (OpenAI Whisper) and understanding messages (OpenAI chat completions).

export const OWNER_SYSTEM = `You read a business owner's quick message (typed or a transcribed voice note; Hindi, English or Hinglish).
It can contain NEW TASKS (for his team or himself), REPLIES to his team's existing tasks (answers, approvals, instructions),
and/or STATUS of his OWN tasks (e.g. "CRM templates ho gaye", "Sharma ji visit done").

Team:
{team}
The owner himself is "Ankit" (use owner "Ankit" for "me", "mujhe", "myself", "main", or tasks clearly for him).
Right now it is {now}. Resolve every "today", "tonight", "kal", "9 pm" against that.

Open tasks (id | person | task | status):
{open_tasks}

Rules for new tasks:
- One message may contain several tasks. Return each separately.
- owner: exactly one name from the team list or "Ankit". Match nicknames/misspellings to the closest name. If no person can be identified, put the text in "unclear".
- task: THE WHOLE INSTRUCTION, not a summary. This exact text is what the person receives, so nothing he said about the work may be dropped: keep every client/party name, amount, rate, quantity, date, deadline, document name, phone number, condition and "do it this way" detail. Write it as a clear, correctly spelled English imperative with correct grammar and punctuation (fix his spelling, fix transcription slips, expand nothing you were not told). Use up to 60 words, and more than one sentence if the instruction has more than one part. Never shorten it to a label.
- due_at: if he gives a clock time or a date for the task ("9 pm", "kal 11 baje", "Monday morning", "aaj shaam 5 baje", "Thursday"), that exact moment as "YYYY-MM-DDTHH:MM" in local time; otherwise null. With no clock time: morning 10:00, afternoon 15:00, evening 18:00, night 21:00. Never a moment in the past - if the time he names has already gone today, use the next day.
- A reminder is an ordinary task that has a due_at. "remind me to call Mr Rahul at 9pm today" / "9 baje Rahul ko call karne ka reminder lagao" -> owner "Ankit", task "Call Mr Rahul", due_at today 21:00. Put it on someone else only if he names them.
Rules for his own task status:
- If he says one of HIS OWN open tasks (person = Ankit) is done or in progress, return it in "own_updates" (status "done" or "working"). Do not create it again as a new task.
Rules for replies:
- If he refers to an existing open task (by number, or clearly by person + subject) and gives an answer, approval or instruction on it, return it in "replies" with that task_id and his message in full, correctly spelled English - every amount, rate, name and condition kept, nothing summarised away. Do not also create it as a new task.
Duplicates:
- If a new task is clearly the same as an OPEN task already listed for the same person, do not create it; put that open task's id in "duplicates".
Do not invent anything.

Reply with JSON only:
{"tasks":[{"owner":"...","task":"...","due_at":"YYYY-MM-DDTHH:MM or null"}],"replies":[{"task_id":0,"message":"..."}],"own_updates":[{"task_id":0,"status":"done|working"}],"duplicates":[{"task_id":0}],"unclear":["..."]}`;

export const STATUS_SYSTEM = `A team member is replying (typed or transcribed voice; Hindi, English or Hinglish) with the status of their tasks.
Their open tasks (list number. #id description):
{tasks}

For every task they mention (by list number, by #id, or clearly by subject) return one update:
- status "done" (ho gaya, done, bhej diya, complete), "working" (chal raha hai, in progress, kal tak, tomorrow, will do) or "stuck" (stuck, ruka hai, waiting, blocked, approval chahiye).
- stuck_on: "ankit" if they are waiting on Ankit / sir / his approval or input, "others" if waiting on a client, vendor, document, someone else; null if not stuck.
- note: short English summary of any reason, date or detail they gave; null if none.
If they say "all done" / "sab ho gaya", mark every task done.
Anything in their message not about these tasks goes in "other" (short English), else null.

Reply with JSON only:
{"updates":[{"task_id":0,"status":"done|working|stuck","stuck_on":"ankit|others|null","note":"..."}],"other":null}`;

// Ankit types on a phone, in a hurry, in three languages. Anything of his that is forwarded
// word for word gets this pass first, so the team never reads a typo as an instruction.
// It corrects, it does not rewrite: no new facts, no politeness, no summarising.
export const POLISH_SYSTEM = `Correct the spelling, grammar and punctuation of the message below and return it in clear English.
Rules: keep every name, amount, rate, date, number and condition exactly as given. Do not add, remove, explain, summarise or soften anything. Do not add a greeting or a sign-off. Hindi or Hinglish becomes plain English with the same meaning. If it is already correct, return it unchanged.
Reply with JSON only: {"text":"..."}`;

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

  async parseOwner(text, openTasks, now = "") {
    const team = this.d.people.map((p) => `- ${p.name}${p.aliases.length ? ` (also: ${p.aliases.join(", ")})` : ""}`).join("\n");
    const ot = openTasks.map((t) => `${t.id} | ${t.owner} | ${t.description} | ${t.status}`).join("\n") || "(none)";
    const system = OWNER_SYSTEM.replace("{team}", team)
      .replace("{open_tasks}", ot).replace("{now}", now);
    const data = await this._chat(system, text);
    for (const k of ["tasks", "replies", "own_updates", "duplicates", "unclear"]) data[k] ||= [];
    return data;
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

  async parseStatus(text, items) {
    const listing = items.map(([i, t]) => `${i}. #${t.id} ${t.description}`).join("\n");
    const data = await this._chat(STATUS_SYSTEM.replace("{tasks}", listing), text);
    data.updates ||= [];
    data.other ??= null;
    return data;
  }
}
