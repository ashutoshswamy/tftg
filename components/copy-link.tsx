"use client";

import { useEffect } from "react";
import { CopyButton } from "@ashutoshswamy/smoui";

// navigator.clipboard only exists on https and localhost. Over plain http
// (a LAN address on a phone) smoui's button would throw and do nothing, so
// shim writeText with a hidden textarea and execCommand.
function ensureClipboard() {
  if (typeof navigator.clipboard?.writeText === "function") return;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
      },
    },
  });
}

/** Copies the absolute URL (current origin + path) to the clipboard. */
export function CopyLink({ path }: { path: string }) {
  // The URL is never rendered into the markup, only handed to the click
  // handler, so reading window during render cannot cause a hydration diff.
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  useEffect(ensureClipboard, []);

  return (
    <CopyButton
      text={url}
      label="Copy link"
      copiedLabel="Copied"
      style={{
        height: 36,
        padding: "0 14px",
        border: 0,
        borderRadius: 8,
        background: "var(--color-fill)",
        color: "var(--color-ink)",
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        justifyContent: "center",
      }}
    />
  );
}
