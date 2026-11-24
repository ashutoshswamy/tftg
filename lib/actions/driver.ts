"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

async function findShipmentByDriverToken(token: string) {
  const supabase = createAdminClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, status, tokens_expire_at")
    .eq("driver_token", token)
    .maybeSingle();

  if (!shipment || isExpired(shipment.tokens_expire_at)) {
    return null;
  }
  return shipment;
}

function isExpired(tokensExpireAt: string | null) {
  return Boolean(tokensExpireAt && new Date(tokensExpireAt) < new Date());
}

const MAX_POD_BYTES = 10 * 1024 * 1024; // 10MB

/** Validates and stores the photo; redirects back with an error otherwise. */
async function storePhoto(
  token: string,
  shipmentId: string,
  file: FormDataEntryValue | null,
  kind: "pod" | "photo"
) {
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/d/${token}?error=A photo is required`);
  }
  if (!file.type.startsWith("image/")) {
    redirect(`/d/${token}?error=Only photos can be uploaded`);
  }
  if (file.size > MAX_POD_BYTES) {
    redirect(`/d/${token}?error=File too large (max 10MB)`);
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${shipmentId}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type || "image/jpeg" });
  if (uploadError) {
    redirect(`/d/${token}?error=${encodeURIComponent(uploadError.message)}`);
  }

  await supabase.from("documents").insert({
    shipment_id: shipmentId,
    kind,
    storage_path: path,
    uploaded_by: "driver",
  });
}

/**
 * Picked up / Delivered. A photo is compulsory for both: the status only
 * changes after the photo is stored (pickup photo, or proof of delivery).
 */
export async function updateDriverStatusWithPhoto(token: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  if (status !== "in_transit" && status !== "delivered") return;

  const shipment = await findShipmentByDriverToken(token);
  if (!shipment) {
    redirect(`/d/${token}?error=Link expired`);
  }

  await storePhoto(token, shipment.id, formData.get("file"), status === "delivered" ? "pod" : "photo");

  const supabase = createAdminClient();
  await supabase.from("shipments").update({ status }).eq("id", shipment.id);
  await supabase.from("status_events").insert({
    shipment_id: shipment.id,
    status,
    note: status === "delivered" ? "Delivered, photo attached" : "Picked up, photo attached",
    created_by: "driver",
  });

  revalidatePath(`/d/${token}`);
  redirect(`/d/${token}`);
}
