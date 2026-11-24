"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth";
import sharp from "sharp";
import { LOGO_BUCKET, LOGO_PATH, LOGO_SIZE } from "@/lib/logo";

export async function updateCompanySettings(formData: FormData) {
  await requireAdminUser();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("company_settings")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      legal_name: String(formData.get("legalName") ?? "").trim() || null,
      tax_id: String(formData.get("taxId") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      default_currency: String(formData.get("defaultCurrency") ?? "USD")
        .trim()
        .toUpperCase(),
      default_tax_rate_id: String(formData.get("defaultTaxRateId") ?? "") || null,
      prices_include_tax: formData.get("pricesIncludeTax") === "on",
      invoice_prefix: String(formData.get("invoicePrefix") ?? "INV").trim(),
      payment_terms_days: Number(formData.get("paymentTermsDays") ?? 15),
      bank_details: String(formData.get("bankDetails") ?? "").trim() || null,
    })
    .eq("id", true);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings");
}

export async function createTaxRate(formData: FormData) {
  await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const ratePct = Number(formData.get("ratePct") ?? 0);

  if (!name || !Number.isFinite(ratePct)) {
    redirect("/settings?error=Invalid tax rate");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tax_rates").insert({ name, rate_pct: ratePct });

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings");
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
// pdf-lib can embed PNG and JPEG only, so those are the accepted formats.
const LOGO_TYPES = ["image/png", "image/jpeg"];

export async function uploadLogo(formData: FormData) {
  await requireAdminUser();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings?error=Choose a logo file first");
  }
  if (!LOGO_TYPES.includes(file.type)) {
    redirect("/settings?error=Logo must be a PNG or JPEG image");
  }
  if (file.size > MAX_LOGO_BYTES) {
    redirect("/settings?error=Logo is too large (max 2MB)");
  }

  // Every logo is stored as a 240x240 PNG: scaled to fit, centred, transparent
  // padding. The settings preview and the invoice then draw the same square.
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(LOGO_SIZE, LOGO_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    redirect("/settings?error=That file could not be read as an image");
  }

  const { error } = await createAdminClient()
    .storage.from(LOGO_BUCKET)
    .upload(LOGO_PATH, png, { contentType: "image/png", upsert: true });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/settings");
  redirect("/settings");
}

export async function removeLogo() {
  await requireAdminUser();
  await createAdminClient().storage.from(LOGO_BUCKET).remove([LOGO_PATH]);
  revalidatePath("/settings");
  redirect("/settings");
}
