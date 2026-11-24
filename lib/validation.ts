import * as z from "zod";

export const MODES = ["road", "rail", "air", "ocean", "courier"] as const;
export const STATUSES = [
  "pending",
  "assigned",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export const PARTY_ROLES = [
  "customer",
  "shipper",
  "consignee",
  "carrier",
  "supplier",
  "agent",
  "notify_party",
] as const;

const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const shipmentSchema = z.object({
  mode: z.enum(MODES),
  customerId: optionalUuid,
  shipperId: optionalUuid,
  consigneeId: optionalUuid,
  carrierId: optionalUuid,
  driverId: optionalUuid,
  vehicleId: optionalUuid,
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  currency: z
    .union([z.string().trim().length(3).toUpperCase(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  roles: z.array(z.enum(PARTY_ROLES)).min(1, "Pick at least one role"),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().trim().max(50).optional(),
});

export type PartyInput = z.infer<typeof partySchema>;
