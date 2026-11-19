
import { isoLocal } from "./time.js";
import { MASTER, TEAM } from "./boards.js";

export async function seedDemo(bot) {
  const tz = bot.s.timezone;
  const ago = (days, hours = 0) => isoLocal(new Date(Date.now() - days * 86400000 - hours * 3600000), tz);
  const p = bot.d.people;
  // Demo data only: the label is a seed, not a group — it just spreads the sample tasks and
  // messages over whoever is on the list, the same way on every run.
  const who = (seed, n = 0) => {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return p[(h + n) % p.length]?.name;
  };
  const owner = bot.d.owner.name;

  // owner, description, status, stuck_on, note, age in days
  const rows = [
    // --- EPC ---
    [who("EPC"), "October GSTR-2B reconciliation", "working", null, "80% matched, 12 invoices left", 4],
    [who("EPC"), "Draft KRAs for EPC accounts staff", "stuck", "others", "Waiting for vendor data", 4],
    [who("EPC", 1), "File TDS return for Q2", "stuck", "ankit", "Need DSC and sign-off", 9],
    [who("EPC", 1), "Renew labour licence for Sonipat site", "new", null, null, 1],
    [who("EPC"), "Share October P&L with Ankit", "working", null, "By Friday evening", 2],

    // --- HoldPoint ---
    [who("HoldPoint"), "Galaxy Royal AMC quotation", "stuck", "ankit", "Needs rate approval", 2],
    [who("HoldPoint"), "Fix Sector 76 society site visit", "working", null, "Visit on Wednesday", 1],
    [who("HoldPoint"), "Send final invoice to Galaxy Royal", "new", null, null, 0],
    [who("HoldPoint"), "Replace 2 faulty pumps at Palm Grove", "stuck", "others", "Vendor says stock on 20th", 8],

    // --- Ryan ---
    [who("Ryan"), "Match October collections vs billing", "new", null, null, 0],
    [who("Ryan"), "Close 26AS mismatch for FY24-25", "working", null, "Two parties to confirm", 5],
    [who("Ryan", 1), "Follow up on Sharma ji pending payment", "stuck", "others", "Client asked for 10 more days", 11],
    [who("Ryan", 1), "Update fee register for November", "working", null, null, 1],

    // --- PHMG ---
    [who("PHMG"), "Finalise audit checklist for PHMG", "working", null, "Draft ready, reviewing", 3],
    [who("PHMG"), "Reply to GST notice for FY23-24", "stuck", "ankit", "Need last year's working papers", 6],
    [who("PHMG", 1), "Register new partner on portal", "new", null, null, 0],

    // --- Pulkit ---
    [who("Pulkit"), "Close November salary sheet", "working", null, "Attendance pending for 3 staff", 2],
    [who("Pulkit"), "Negotiate courier rates for Q4", "new", null, null, 1],

    // --- Minenii ---
    [who("Minenii"), "Ship website copy for landing page", "working", null, "Hero and pricing done", 3],
    [who("Minenii"), "Set up payment gateway KYC", "stuck", "ankit", "Needs company PAN and bank letter", 7],

    // --- Ankit's own ---
    [owner, "GST and TDS working templates", "new", null, null, 2],
    [owner, "Shortlist mediclaim policies", "new", null, null, 1],
    [owner, "Approve Galaxy Royal AMC rate", "working", null, "Comparing with last year", 2],
    [owner, "Call Sharma ji about pending dues", "new", null, null, 0],
    [owner, "Book Dehradun trip tickets", "new", null, null, 5],

    // --- older ones, so the red (7+ days) and amber (3+ days) ages show up ---
    [who("EPC", 1), "Close FY24-25 fixed asset register", "working", null, "Depreciation workings left", 14],
    [who("HoldPoint"), "Get lift AMC renewed at Orchid Tower", "new", null, null, 12],
    [who("Ryan", 1), "Chase 3 clients for GST data", "working", null, "1 of 3 received", 9],
    [who("PHMG", 1), "Verify partner KYC documents", "stuck", "others", "Two partners yet to send Aadhaar", 10],
    [who("Pulkit"), "Settle courier vendor October bill", "stuck", "ankit", "Needs your approval on the deduction", 8],
    [who("Minenii"), "Finalise pricing page copy", "new", null, null, 6],
    [who("EPC"), "Prepare vendor ageing report", "new", null, null, 3],
    [who("HoldPoint"), "Collect security deposit from Palm Grove", "working", null, "Cheque promised Friday", 5],
    [who("Ryan"), "Reconcile TDS receivable ledger", "new", null, null, 2],
    [owner, "Send PHMG working papers to Praveen", "new", null, null, 6],
    [owner, "Arrange company PAN and bank letter", "working", null, "Bank letter requested", 7],
    [owner, "Renew car insurance", "new", null, null, 9],
  ];

  for (const [o, desc, st, on, note, days] of rows) {
    const t = await bot.store.insert("tasks", { owner: o, description: desc, status: st, stuck_on: on,
      note, notified: 1, source_text: "demo", created_at: ago(days), updated_at: ago(0), last_update_date: null, done_at: null });
    if (note) await bot.store.insert("task_notes", { task_id: t.id, person: o, status: st === "stuck" ? "Stuck" : "Working", text: note, created_at: ago(0, 1) });
  }

  // a few closed tasks so the Done column and history are not empty
  // owner, description, created days ago, done days ago
  const done = [
    [who("EPC"), "TDS challans for October", 3, 1],
    [who("HoldPoint"), "Galaxy Royal final invoice", 4, 2],
    [who("Ryan"), "Upload October bank statements", 5, 2],
    [who("PHMG"), "Collect signed engagement letters", 6, 3],
    [who("Pulkit"), "October stock count", 7, 4],
    [who("Minenii"), "Buy domain and mail setup", 8, 6],
    [owner, "Pay advance tax instalment", 4, 3],
    [who("EPC", 1), "Share September GST summary", 6, 5],
    [who("HoldPoint"), "Sector 76 society quotation revision", 5, 3],
    [who("Ryan", 1), "Issue October fee receipts", 4, 1],
    [who("PHMG", 1), "Portal password reset for PHMG", 3, 2],
    [who("Minenii"), "Hero section copy review", 4, 2],
    [who("Pulkit"), "Courier rate comparison sheet", 6, 5],
    [owner, "Approve EPC staff KRA draft", 5, 4],
    [owner, "Call Galaxy Royal about renewal", 3, 1],
  ];
  for (const [o, desc, made, closed] of done) {
    const t = await bot.store.insert("tasks", { owner: o, description: desc, status: "done", stuck_on: null,
      note: null, notified: 1, source_text: "demo", created_at: ago(made), updated_at: ago(closed), done_at: ago(closed) });
    await bot.store.insert("task_notes", { task_id: t.id, person: o, status: "Done", text: "Done", created_at: ago(closed) });
  }

  // every message that came in, word for word – the Messages tab and the "msgs" command.
  // Oldest first, so the ids run in the same order as the clock and the tab reads newest at the top.
  // person, kind, text, days ago, hours ago
  const msgs = [
    // --- 12 days ago ---
    [who("EPC"), "text", "Good morning sir, aaj GSTR-2B pe baithta hoon", 12, 11],
    [who("HoldPoint"), "text", "Orchid Tower ka lift AMC expire ho raha hai, renew karwa doon?", 12, 9],
    [who("Ryan", 1), "voice", "Sharma ji ka payment follow up kiya, accounts wale se baat karni padegi", 12, 6],
    [who("Pulkit"), "text", "Courier vendor ne October ka bill bhej diya hai", 12, 4],
    // --- 11 days ago ---
    [who("PHMG", 1), "text", "Partner KYC ke liye sabko message kar diya hai", 11, 10],
    [who("EPC", 1), "text", "Fixed asset register purana data verify kar raha hoon", 11, 8],
    [who("Minenii"), "voice", "Pricing page ka structure decide kar liya, copy likh raha hoon", 11, 5],
    [who("Ryan"), "text", "26AS nikal liya hai sir, mismatch dekh raha hoon", 11, 3],
    // --- 10 days ago ---
    [who("HoldPoint"), "text", "Galaxy Royal wale AMC ka rate pooch rahe hain", 10, 11],
    [who("PHMG"), "text", "Audit checklist pe kaam shuru kar diya", 10, 7],
    [who("EPC"), "voice", "Sir vendor ageing report ke liye purchase data chahiye hoga", 10, 5],
    [who("Pulkit"), "text", "Stock count ho gaya, sheet bana raha hoon", 10, 2],
    // --- 9 days ago ---
    [who("EPC", 1), "text", "TDS Q2 ke challans aur workings ready hain, DSC chahiye", 9, 10],
    [who("Ryan", 1), "text", "Teen client ko GST data ke liye reminder bhej diya", 9, 8],
    [who("Minenii"), "text", "Domain available hai, book kar doon?", 9, 6],
    [who("HoldPoint"), "voice", "Palm Grove ke do pump kharab hain, vendor ko bula raha hoon", 9, 3],
    // --- 8 days ago ---
    [who("PHMG"), "text", "GST notice aaya hai FY23-24 ka, dekh liya hai", 8, 11],
    [who("Pulkit"), "voice", "Courier wale se rate negotiate kar raha hoon, Monday tak batata hoon", 8, 9],
    [who("EPC"), "text", "October ka P&L banana shuru kiya hai", 8, 6],
    [who("PHMG", 1), "text", "Portal ka password reset ho gaya sir", 8, 4],
    [who("Ryan"), "text", "Bank statements upload ho gaye", 8, 2],
    // --- 7 days ago ---
    [who("Minenii"), "text", "Domain aur mail dono book ho gaye", 7, 10],
    [who("EPC", 1), "voice", "Sir labour licence Sonipat site ka renewal due hai is month", 7, 7],
    [who("HoldPoint"), "text", "Sector 76 society ko quotation revise kar ke bhej diya", 7, 5],
    [who("Ryan", 1), "text", "Ek client ka GST data aa gaya, do baaki", 7, 2],
    // --- 6 days ago ---
    [who("PHMG"), "text", "Engagement letters sign hoke aa gaye sabke", 6, 11],
    [who("EPC"), "text", "GSTR-2B mein kuch invoice match nahi ho rahe, party se maang raha hoon", 6, 8],
    [who("Pulkit"), "text", "Rate comparison sheet bhej di hai, dekh lijiye", 6, 6],
    [who("Minenii"), "voice", "Gateway KYC form fill kar diya, documents chahiye", 6, 3],
    // --- 5 days ago ---
    [who("HoldPoint"), "text", "Galaxy Royal ka final invoice bhej diya sir", 5, 10],
    [who("EPC", 1), "text", "September ka GST summary bhej diya hai", 5, 8],
    [who("Ryan"), "voice", "26AS mein paanch entry mismatch hai, party se confirm karwa raha hoon", 5, 6],
    [who("PHMG", 1), "text", "Do partner ke Aadhaar nahi aaye, baaki ho gaye", 5, 3],
    [who("Minenii"), "text", "Hero section ki copy ready hai, review kar lijiye", 5, 1],
    // --- 4 days ago ---
    [who("PHMG", 1), "text", "Naya partner portal pe register ho gaya sir", 4, 11],
    [who("EPC"), "text", "October P&L Friday shaam tak bhej dunga", 4, 8],
    [who("HoldPoint"), "voice", "Orchid Tower ka lift AMC wala kal aayega", 4, 6],
    [who("Pulkit"), "text", "Salary ke liye teen staff ki attendance pending hai", 4, 4],
    [who("Ryan", 1), "text", "October ke fee receipts issue kar diye", 4, 2],
    // --- 3 days ago ---
    [who("Ryan"), "text", "26AS mismatch mein do party ka confirmation pending hai", 3, 10],
    [who("PHMG"), "text", "Audit checklist ka draft ready hai, review kar lijiye", 3, 7],
    [who("Ryan", 1), "voice", "Sharma ji se baat hui, payment next week bol rahe hain", 3, 5],
    [who("EPC", 1), "text", "Fixed asset register mein depreciation workings baaki hai", 3, 3],
    [who("Minenii"), "text", "Pricing page ki copy kal tak final kar dunga", 3, 1],
    // --- 2 days ago ---
    [who("Pulkit"), "text", "Salary sheet kal tak final kar dunga", 2, 11],
    [who("HoldPoint"), "text", "Sector 76 ki visit Wednesday fix ho gayi sir", 2, 8],
    [who("Minenii"), "text", "Domain aur mail set up ho gaya, login details bhej diye", 2, 6],
    [who("EPC", 1), "voice", "Labour licence renewal ke documents Sonipat office se aa gaye", 2, 4],
    [who("PHMG"), "text", "GST notice ka reply draft kar raha hoon, purane papers chahiye", 2, 2],
    // --- yesterday ---
    [who("EPC"), "text", "GSTR-2B mein 12 invoice match nahi ho rahe, party se maang liya hai", 1, 11],
    [who("Pulkit"), "voice", "Courier wale ne rate kam karne se mana kar diya, doosra vendor dekhun?", 1, 9],
    [who("Ryan", 1), "text", "Fee register November ka kal tak update kar dungi", 1, 7],
    [who("Minenii"), "text", "Gateway KYC ke liye company PAN bhej dijiye", 1, 5],
    [who("PHMG"), "voice", "GST notice ka reply draft ready hai, aapke papers chahiye", 1, 2],
    [who("HoldPoint"), "text", "Galaxy Royal ko quote bhej doon ya rate confirm karenge?", 1, 1],
    // --- today ---
    [who("HoldPoint"), "text", "Palm Grove ka cheque Friday ko milega confirm hua hai", 0, 8],
    [who("PHMG", 1), "text", "Do partner ke Aadhaar abhi tak nahi aaye, reminder bhej diya", 0, 7],
    [who("Minenii"), "voice", "Landing page ka hero aur pricing done hai, baaki kal", 0, 6],
    [who("EPC", 1), "text", "Sir TDS return ke liye DSC chahiye, aap office aa rahe ho?", 0, 5],
    [who("Ryan"), "text", "Sir Sharma ji ne 10 din ka time maanga hai, theek hai?", 0, 4],
    [who("Pulkit"), "text", "Vendor bill mein deduction kar doon? aapki approval chahiye", 0, 3],
    [who("EPC"), "text", "1 working, 2 stuck – vendor data nahi aaya", 0, 2],
    [who("HoldPoint"), "voice", "Sir AMC rate pe baat karni hai, call kar lena", 0, 1],
  ];
  for (const [person, kind, text, d, h] of msgs) {
    await bot.store.insert("messages", { person, kind, text, created_at: ago(d, h) });
  }

  // what the bot sent back, so the chat shows both sides. The pending list is built
  // from each person's real open tasks, the way runPending() builds it.
  const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = (d) => WEEKDAY[new Date(Date.now() - d * 86400000).getDay()];
  for (const person of p) {
    const theirs = await bot.store.find("tasks", { owner: person.name, status: { $nin: ["done", "cancelled"] } }, { sort: { id: 1 } });
    if (!theirs.length) continue;
    for (const d of [0, 1, 2, 4, 5]) {
      const lines = theirs.map((t, i) => `${i + 1}. #${t.id} ${t.description}`);
      await bot.store.insert("messages_out", {
        person: person.name, auto: 1, created_at: ago(d, 4),
        text: `📌 *Pending with you (${lines.length})*\n_${dayName(d)}_\n\n${lines.join("\n")}\n\nReply in ONE message (text or voice) with where each one stands, e.g.\n"1 done, 2 working, 3 stuck Ankit – need approval"`,
      });
      if (d % 2 === 0) {
        const u = theirs[0];
        await bot.store.insert("messages_out", {
          person: person.name, auto: 1, created_at: ago(d, 12),
          text: `📋 *New task from Ankit*\n\n${u.description}\n\n_#${u.id}_\n[ ✅ Done ] [ ⏳ Working ] [ ✍️ Remark ]`,
        });
      }
    }
  }

  // the few Ankit typed himself, answering a task someone was stuck on
  const replies = [
    ["Galaxy Royal AMC quotation", "Rate approved at 4,500. Send the quote today.", 0, 2],
    ["File TDS return for Q2", "I will bring the DSC to the office tomorrow morning.", 1, 6],
    ["Settle courier vendor October bill", "Deduct the 2,400 and settle the rest.", 1, 3],
    ["Set up payment gateway KYC", "PAN and the bank letter are with Narendra, collect from him.", 2, 5],
  ];
  for (const [desc, text, d, h] of replies) {
    const t = await bot.store.findOne("tasks", { description: desc });
    if (!t) continue;
    await bot.store.insert("messages_out", {
      person: t.owner, auto: 0, created_at: ago(d, h),
      text: `Ankit on #${t.id} (${t.description}):\n${text}`,
    });
  }

  // Who has messaged the bot, which is what decides whether a plain message can reach them at
  // all. Everyone who sent anything above has, bar the last person, so the People screen shows
  // both states rather than a column of identical warnings.
  const quiet = p[p.length - 1]?.name;
  for (const person of p) {
    if (person.name === quiet) continue;
    const last = (await bot.store.find("messages", { person: person.name }, { sort: { id: -1 }, limit: 1 }))[0];
    await bot.store.upsert("inbound", { phone: person.phone }, { last_at: last ? last.created_at : ago(0, 2) });
  }

  // today's list, so the Messages board shows who still owes an update
  const replied = new Set([who("EPC"), who("Ryan"), who("Minenii"), who("PHMG"), who("HoldPoint")]);
  for (const person of p) {
    await bot.store.insert("checkins", { date: bot.today(), owner: person.name, replied: replied.has(person.name) ? 1 : 0 });
  }

  // a few tasks with several remarks, so the history on the master board is not a single line
  // description, [[status, text, days ago, hours ago], ...]
  const history = [
    ["October GSTR-2B reconciliation", [
      ["Working", "Started matching, about half done", 2, 3],
      ["Working", "40 invoices matched, 12 left", 1, 4],
      ["Working", "80% matched, 12 invoices left", 0, 2],
    ]],
    ["Galaxy Royal AMC quotation", [
      ["Working", "Quote drafted at last year's rate", 1, 6],
      ["Stuck", "Needs rate approval", 0, 1],
    ]],
    ["File TDS return for Q2", [
      ["Working", "Challans and workings ready", 5, 2],
      ["Stuck", "Waiting for DSC", 3, 5],
      ["Stuck", "Need DSC and sign-off", 0, 3],
    ]],
    ["Set up payment gateway KYC", [
      ["Working", "Form filled, documents pending", 4, 4],
      ["Stuck", "Needs company PAN and bank letter", 1, 2],
    ]],
  ];
  for (const [desc, notes] of history) {
    const t = await bot.store.findOne("tasks", { description: desc });
    if (!t) continue;
    await bot.store.remove("task_notes", { task_id: t.id });
    for (const [status, text, d, h] of notes) {
      await bot.store.insert("task_notes", { task_id: t.id, person: t.owner, status, text, created_at: ago(d, h) });
    }
  }

  // Two meetings, so the calendar and the day panel can be seen with real shapes in them:
  // one later today that nobody has answered yet, one tomorrow that is half answered.
  const at = (days, h, mi = 0) => {
    const d = new Date(Date.now() + days * 86400000);
    return isoLocal(d, tz).slice(0, 11) + String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0") +
      ":00" + bot.nowIso().slice(19);
  };
  const names = p.map((x) => x.name);
  if (names.length >= 2) {
    const now = bot.nowIso();
    await bot.store.insert("meetings", {
      title: "Tally data review", with: [names[0], names[1]], at: at(0, 17),
      status: "called", note: null, responses: {}, reminded: 0, source_text: "demo",
      created_at: now, updated_at: now,
    });
    await bot.store.insert("meetings", {
      title: "Month-end close planning", with: [names[1], names[2] || names[0]], at: at(1, 11),
      status: "called", note: "Bring the October workings.",
      responses: { [names[1]]: "yes" }, reminded: 0, source_text: "demo",
      created_at: now, updated_at: now,
    });
  }

  const base = (bot.s.baseUrl || "http://localhost:3000").replace(/\/$/, "");
  console.log(`[ankit-desk] DEMO data loaded. Master board: ${base}/board/${await bot.boards.keyFor(MASTER)}`);
  console.log(`[ankit-desk]   Team board: ${base}/board/${await bot.boards.keyFor(TEAM)}`);
}
