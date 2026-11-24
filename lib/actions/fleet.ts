"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const back = (error?: string) =>
  redirect(error ? `/fleet?error=${encodeURIComponent(error)}` : "/fleet");

// carrier_id null means the company's own fleet; a party id means a third-party carrier's.
const owner = (formData: FormData) => text(formData, "ownerId") || null;

export async function createDriver(formData: FormData) {
  const name = text(formData, "name");
  if (!name) back("Driver name is required");

  const { error } = await createAdminClient()
    .from("drivers")
    .insert({
      carrier_id: owner(formData),
      name,
      phone: text(formData, "phone") || null,
      license_no: text(formData, "licenseNo") || null,
    });
  if (error) back(error.message);

  revalidatePath("/fleet");
  back();
}

const VEHICLE_TYPES = ["truck", "van", "rail_car", "container", "other"];

export async function createVehicle(formData: FormData) {
  const plate = text(formData, "plate");
  const type = text(formData, "type") || "truck";
  if (!plate) back("Plate or vehicle number is required");
  if (!VEHICLE_TYPES.includes(type)) back("Pick a vehicle type");

  const { error } = await createAdminClient()
    .from("vehicles")
    .insert({
      carrier_id: owner(formData),
      type,
      plate,
      capacity: text(formData, "capacity") || null,
    });
  if (error) back(error.message);

  revalidatePath("/fleet");
  back();
}

/** Quick-add from the new shipment page: no redirect, returns the new row. */
export async function createDriverInline(input: {
  name: string;
  phone?: string;
  ownerId: string;
}): Promise<{ id: string; name: string } | { error: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Driver name is required" };
  const { data, error } = await createAdminClient()
    .from("drivers")
    .insert({ name, phone: input.phone?.trim() || null, carrier_id: input.ownerId || null })
    .select("id, name")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add driver" };
  revalidatePath("/fleet");
  return data;
}

export async function createVehicleInline(input: {
  plate: string;
  ownerId: string;
}): Promise<{ id: string; plate: string } | { error: string }> {
  const plate = input.plate.trim();
  if (!plate) return { error: "Plate or vehicle number is required" };
  const { data, error } = await createAdminClient()
    .from("vehicles")
    .insert({ plate, type: "truck", carrier_id: input.ownerId || null })
    .select("id, plate")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add vehicle" };
  revalidatePath("/fleet");
  return data;
}
