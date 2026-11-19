// The People screen's writes: add, save, remove. Only the master link may do this, like every
// other action on that board. Every rule lives in lib/people.js, so this route decides nothing —
// it reads the form, calls the same method the WhatsApp command calls, and redirects with the
// answer. A POST and a 303 back, so the screen works with no JavaScript at all.
import { getBot } from "../../../../lib/runtime.js";
import { MASTER } from "../../../../lib/boards.js";

export const dynamic = "force-dynamic";

// The replies are written for WhatsApp, where *this* is bold. On the page they are plain text.
const plain = (s) => String(s || "").replace(/\*/g, "");

export async function POST(req, { params }) {
  const { key } = await params;
  const bot = getBot();
  if ((await bot.boards.scopeOf(key)) !== MASTER) return new Response("forbidden", { status: 403 });

  const f = await req.formData();
  const get = (k) => (f.get(k) == null ? "" : String(f.get(k)));
  const action = get("action");
  const who = get("who");
  let r;

  if (action === "add") {
    r = await bot.team.add({ name: get("name"), phone: get("phone"), aliases: get("aliases"), does: get("does") });
  } else if (action === "save") {
    r = await bot.team.save(who, { name: get("name"), phone: get("phone"), alias: get("aliases"), does: get("does") });
  } else if (action === "remove") {
    r = await bot.team.remove(who);
  } else {
    r = { error: "That form did not say what to do." };
  }

  const q = new URLSearchParams({ tab: "people" });
  if (r.error) {
    q.set("err", plain(r.error));
    if (who) q.set("who", who); // keep the panel open on the person who failed to save
  } else {
    q.set("ok", plain(r.ok));
  }
  return new Response(null, { status: 303, headers: { Location: `/board/${key}?${q}` } });
}
