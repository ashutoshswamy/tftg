"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { generateTrackingCode, generateLinkToken } from "@/lib/tokens";
import { shipmentSchema, STATUSES } from "@/lib/validation";
import { currencyExponent } from "@/lib/money";

const UNIQUE_VIOLATION = "23505";

function parseShipmentForm(formData: FormData) {
  return shipmentSchema.safeParse({
    mode: formData.get("mode"),
    customerId: formData.get("customerId") ?? "",
    shipperId: formData.get("shipperId") ?? "",
    consigneeId: formData.get("consigneeId") ?? "",
    carrierId: formData.get("carrierId") ?? "",
    driverId: formData.get("driverId") ?? "",
    vehicleId: formData.get("vehicleId") ?? "",
    reference: formData.get("reference") ?? "",
    notes: formData.get("notes") ?? "",
    currency: formData.get("currency") ?? "",
  });
}

/** Replace a shipment's order lines with the repeated item* form fields. */
async function saveItems(shipmentId: string, formData: FormData, currencyOverride: string | null) {
  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("company_settings")
    .select("default_currency")
    .single();
  const exponent = currencyExponent(currencyOverride ?? company?.default_currency ?? "USD");

  const descriptions = formData.getAll("itemDescription");
  const qtys = formData.getAll("itemQty");
  const prices = formData.getAll("itemUnitPrice");
  const taxes = formData.getAll("itemTaxRatePct");

  const rows = descriptions.flatMap((d, i) => {
    const description = String(d).trim();
    const qty = Number(qtys[i] ?? 1);
    const price = Number(prices[i] ?? 0);
    const tax = Number(taxes[i] ?? 0) || 0;
    if (!description || !(qty > 0) || !Number.isFinite(price) || price < 0) return [];
    return [
      {
        shipment_id: shipmentId,
        position: i,
        description,
        qty,
        unit_price_minor: Math.round(price * 10 ** exponent),
        tax_rate_pct: tax,
      },
    ];
  });

  await supabase.from("shipment_items").delete().eq("shipment_id", shipmentId);
  if (rows.length) await supabase.from("shipment_items").insert(rows);
}

export async function createShipment(formData: FormData) {
  const parsed = parseShipmentForm(formData);
  if (!parsed.success) {
    redirect(
      `/shipments/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid shipment")}`
    );
  }

  const user = await getCurrentUser();
  const supabase = createAdminClient();
  const { mode, customerId, shipperId, consigneeId, carrierId, driverId, vehicleId, reference, notes, currency } =
    parsed.data;

  // ponytail: generate-then-insert and retry on a unique-token collision,
  // rather than pre-checking for one. Collisions are astronomically rare
  // with a 24-byte token; a retry loop is simpler than a reservation table.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("shipments")
      .insert({
        mode,
        tracking_code: generateTrackingCode(),
        customer_token: generateLinkToken(),
        driver_token: generateLinkToken(),
        customer_id: customerId,
        shipper_id: shipperId,
        consignee_id: consigneeId,
        carrier_id: carrierId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        currency,
        details: reference ? { reference } : {},
        notes: notes || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!error && data) {
      await saveItems(data.id, formData, currency ?? null);
      revalidatePath("/shipments");
      redirect(`/shipments/${data.id}`);
    }

    if (error && error.code !== UNIQUE_VIOLATION) {
      redirect(`/shipments/new?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/shipments/new?error=Could not generate a unique tracking code, try again");
}

export async function updateShipment(shipmentId: string, formData: FormData) {
  const parsed = parseShipmentForm(formData);
  if (!parsed.success) {
    redirect(
      `/shipments/${shipmentId}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid shipment")}`
    );
  }

  const supabase = createAdminClient();
  const { mode, customerId, shipperId, consigneeId, carrierId, driverId, vehicleId, reference, notes, currency } =
    parsed.data;

  const { error } = await supabase
    .from("shipments")
    .update({
      mode,
      customer_id: customerId,
      shipper_id: shipperId,
      consignee_id: consigneeId,
      carrier_id: carrierId,
      driver_id: driverId,
      vehicle_id: vehicleId,
      currency,
      details: reference ? { reference } : {},
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", shipmentId);

  if (error) {
    redirect(`/shipments/${shipmentId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await saveItems(shipmentId, formData, currency ?? null);
  revalidatePath(`/shipments/${shipmentId}`);
  redirect(`/shipments/${shipmentId}`);
}

export async function regenerateToken(shipmentId: string, which: "customer" | "driver") {
  const supabase = createAdminClient();
  const column = which === "customer" ? "customer_token" : "driver_token";

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("shipments")
      .update({ [column]: generateLinkToken() })
      .eq("id", shipmentId);

    if (!error) break;
    if (error.code !== UNIQUE_VIOLATION) break;
  }

  revalidatePath(`/shipments/${shipmentId}`);
}

export async function updateShipmentStatus(shipmentId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return;
  }

  const user = await getCurrentUser();
  const supabase = createAdminClient();

  await supabase.from("shipments").update({ status }).eq("id", shipmentId);
  await supabase.from("status_events").insert({
    shipment_id: shipmentId,
    status,
    note: note || null,
    created_by: user.id,
  });

  revalidatePath(`/shipments/${shipmentId}`);
}

export async function addStop(shipmentId: string, formData: FormData) {
  const kind = String(formData.get("kind") ?? "stop");
  const addressSnapshot = String(formData.get("address") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "");

  if (!addressSnapshot) return;

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("stops")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId);

  await supabase.from("stops").insert({
    shipment_id: shipmentId,
    sequence: (count ?? 0) + 1,
    kind,
    address_snapshot: addressSnapshot,
    scheduled_at: scheduledAt || null,
  });

  revalidatePath(`/shipments/${shipmentId}`);
}

/** Dispatch board drop: same status change as the shipment page, no redirect. */
export async function moveShipment(shipmentId: string, status: string) {
  const formData = new FormData();
  formData.set("status", status);
  await updateShipmentStatus(shipmentId, formData);
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
}
