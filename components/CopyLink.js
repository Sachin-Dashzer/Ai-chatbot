"use client";
import { useState } from "react";
import { Icon } from "./ui";

// Copies a board's full link so Ankit can paste it into WhatsApp. The origin
// is read in the browser, so it is right on localhost and on the real domain.
export default function CopyLink({ path, label }) {
  const [state, setState] = useState("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setState("done");
      setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={state === "failed" ? "Could not copy. Select the link and copy it by hand." : label}
      className="press inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-control border border-[var(--control)] px-2 text-meta text-muted hover:border-ink hover:text-ink"
    >
      {state === "done" ? <Icon.check width={13} height={13} /> : <Icon.copy width={13} height={13} />}
      <span className="hidden sm:inline">
        {state === "done" ? "Copied" : state === "failed" ? "Copy failed" : "Copy link"}
      </span>
    </button>
  );
}
