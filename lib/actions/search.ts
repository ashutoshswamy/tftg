"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/lib/relation";

export type SearchIndex = {
  shipments: { id: string; code: string; status: string; customer: string; reference: string }[];
  invoices: { id: string; number: string; status: string; customer: string }[];
  parties: { id: string; name: string; roles: string; contact: string }[];
  drivers: { id: string; name: string; phone: string }[];
  vehicles: { id: string; plate: string; type: string }[];
};

// ponytail: ship the whole (small) index once and let the palette filter it in
// the browser. One company's data is a few hundred rows. Move to a server
// query per keystroke if a table passes a few thousand.
const CAP = 1000;

export async function searchIndex(): Promise<SearchIndex> {
  await getCurrentUser(); // staff only
  const db = createAdminClient();

  const [s, i, p, d, v] = await Promise.all([
    db
      .from("shipments")
      .select("id, tracking_code, status, details, customer:customer_id(name)")
      .order("created_at", { ascending: false })
      .limit(CAP),
    db
      .from("invoices")
      .select("id, number, status, customer:customer_id(name)")
      .order("created_at", { ascending: false })
      .limit(CAP),
    db.from("parties").select("id, name, email, phone, party_roles(role)").order("name").limit(CAP),
    db.from("drivers").select("id, name, phone").eq("active", true).order("name").limit(CAP),
    db.from("vehicles").select("id, plate, type").eq("active", true).order("plate").limit(CAP),
  ]);

  return {
    shipments: (s.data ?? []).map((r) => ({
      id: r.id,
      code: r.tracking_code,
      status: r.status,
      customer: one(r.customer)?.name ?? "",
      reference: (r.details as { reference?: string } | null)?.reference ?? "",
    })),
    invoices: (i.data ?? []).map((r) => ({
      id: r.id,
      number: r.number ?? "Draft",
      status: r.status,
      customer: one(r.customer)?.name ?? "",
    })),
    parties: (p.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      roles: r.party_roles.map((x) => x.role.replace("_", " ")).join(", "),
      contact: [r.email, r.phone].filter(Boolean).join(" "),
    })),
    drivers: (d.data ?? []).map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? "" })),
    vehicles: (v.data ?? []).map((r) => ({ id: r.id, plate: r.plate ?? r.type, type: r.type })),
  };
}
