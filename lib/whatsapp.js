// Thin client for the WhatsApp Business Cloud API (Meta Graph API).

const cleanParam = (text) => String(text).split(/\s+/).filter(Boolean).join(" ").slice(0, 900) || "-";

export class WhatsApp {
  constructor(settings) {
    this.s = settings;
    this.base = `https://graph.facebook.com/${settings.graphVersion}`;
  }

  get headers() {
    return { Authorization: `Bearer ${this.s.waToken}`, "Content-Type": "application/json" };
  }

  async _send(payload) {
    const r = await fetch(`${this.base}/${this.s.waPhoneNumberId}/messages`, {
      method: "POST", headers: this.headers, body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!r.ok) console.error("WhatsApp send failed", r.status, await r.text());
    return r;
  }

  async sendText(to, body) {
    for (let i = 0; i < body.length; i += 4000) {
      await this._send({ to, type: "text", text: { body: body.slice(i, i + 4000) } });
    }
  }

  async sendTemplate(to, name, bodyParams = [], buttonPayloads = []) {
    const components = [];
    if (bodyParams.length) {
      components.push({ type: "body", parameters: bodyParams.map((p) => ({ type: "text", text: cleanParam(p) })) });
    }
    buttonPayloads.forEach((payload, i) => components.push({
      type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload }],
    }));
    return this._send({ to, type: "template", template: { name, language: { code: this.s.templateLang }, components } });
  }

  async downloadMedia(mediaId) {
    const meta = await (await fetch(`${this.base}/${mediaId}`, { headers: this.headers })).json();
    const r = await fetch(meta.url, { headers: this.headers });
    if (!r.ok) throw new Error(`media download failed ${r.status}`);
    return { bytes: Buffer.from(await r.arrayBuffer()), mime: meta.mime_type || "audio/ogg" };
  }
}
