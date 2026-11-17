
import fs from "node:fs";

const token = process.env.WA_TOKEN, waba = process.env.WA_WABA_ID, v = process.env.GRAPH_VERSION || "v23.0";
if (!token || !waba) { console.error("Set WA_TOKEN and WA_WABA_ID first."); process.exit(1); }
for (const t of JSON.parse(fs.readFileSync(new URL("../templates.json", import.meta.url)))) {
  const r = await fetch(`https://graph.facebook.com/${v}/${waba}/message_templates`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(t),
  });
  console.log(t.name, r.status, await r.text());
}
