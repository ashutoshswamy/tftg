import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

// One company, one logo: a fixed object in the private "documents" bucket,
// replaced on upload. No column or migration needed.
export const LOGO_BUCKET = "documents";
export const LOGO_PATH = "company/logo";
/** Uploaded logos are normalised to a LOGO_SIZE square PNG. */
export const LOGO_SIZE = 240;

/**
 * Uploaded logo if there is one, otherwise the bundled TFTG logo. The bundled
 * logo comes in two shapes: wide (default) for headers, square for the 240 x 240
 * slot in Settings, where the wide one would shrink to a thin strip.
 */
export async function getLogo(
  shape: "wide" | "square" = "wide",
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const { data, error } = await createAdminClient().storage.from(LOGO_BUCKET).download(LOGO_PATH);
  if (!error && data) {
    return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "image/png" };
  }
  const bytes = await readFile(path.join(process.cwd(), shape === "square" ? "public/tftg-logo-square.png" : "public/tftg-logo.png"));
  return { bytes: new Uint8Array(bytes), contentType: "image/png" };
}

/** Last-modified stamp of an uploaded logo (null when the default is in use), used to bust the browser cache. */
export async function getLogoVersion(): Promise<string | null> {
  const { data } = await createAdminClient()
    .storage.from(LOGO_BUCKET)
    .list("company", { search: "logo", limit: 1 });
  const file = data?.find((f) => f.name === "logo");
  return file ? (file.updated_at ?? file.created_at ?? "1") : null;
}
