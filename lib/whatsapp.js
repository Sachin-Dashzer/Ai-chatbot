
export const PARAM_MAX = 900;
// Meta rejects a template parameter that carries newlines, tabs or runs of spaces, so the
// text has to be flattened to ride in one. Exported because the caller has to know whether
// anything was lost: a flattened body is not the message, and the full text must still go
// out as plain text the moment the window opens.
export const cleanParam = (text) => String(text).split(/\s+/).filter(Boolean).join(" ").slice(0, PARAM_MAX) || "-";

// An interactive message's body is capped lower than a plain text message's, and Meta allows
// at most three reply buttons of 20 characters each.
export const BODY_MAX = 1024;
export const BUTTON_MAX = 3;

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
    // Throw, never swallow: a send that quietly fails (expired token, template not Active, number
    // not on WhatsApp) used to leave the task marked "notified" and the person never heard about it.
    // Callers that must not lose the task catch this and leave it for the next pending round.
    if (!r.ok) {
      const detail = await r.text();
      console.error("[ankit-desk] WhatsApp send failed", r.status, detail);
      throw new Error(`WhatsApp send failed ${r.status}: ${detail.slice(0, 300)}`);
    }
    return r;
  }

  async sendText(to, body) {
    let r;
    for (let i = 0; i < body.length; i += 4000) {
      r = await this._send({ to, type: "text", text: { body: body.slice(i, i + 4000) } });
    }
    return r;
  }

  // Tappable reply buttons under the message. Only inside the 24-hour window, like any
  // free-form message, and only for a body that fits BODY_MAX - the caller sends anything
  // longer as text first, so nothing is ever cut to make room for the buttons.
  async sendButtons(to, body, buttons) {
    return this._send({
      to, type: "interactive",
      interactive: {
        type: "button",
        body: { text: body.slice(0, BODY_MAX) },
        action: {
          buttons: buttons.slice(0, BUTTON_MAX).map(({ id, title }) => ({
            type: "reply", reply: { id, title: title.slice(0, 20) },
          })),
        },
      },
    });
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
