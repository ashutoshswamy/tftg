import "server-only";
import { randomBytes } from "crypto";

// Unambiguous alphabet: no 0/O, 1/I/L.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short human-typeable tracking code, e.g. "TFTG-7K3M9Q". */
export function generateTrackingCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `TFTG-${code}`;
}

/** Long unguessable token for /t/[token], /d/[token], /i/[token] links. */
export function generateLinkToken(): string {
  // ponytail: plain base64 + manual URL-safe swap; the "base64url" encoding
  // is unrecognized by some runtimes ("unrecognized encoding: base64url").
  return randomBytes(24)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
