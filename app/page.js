// "/" is no longer a screen. The Today page it used to hold repeated what the
// boards and the 6 PM overview already say, so it was retired; the root now
// sends Ankit to his own board, which is where every link in the product and
// every bookmark on his phone already pointed.
import { redirect } from "next/navigation";
import { getBot } from "../lib/runtime.js";
import { MASTER } from "../lib/boards.js";

export const dynamic = "force-dynamic";

export default async function Root() {
  const bot = getBot();
  redirect(`/board/${await bot.boards.keyFor(MASTER)}?tab=attention`);
}
