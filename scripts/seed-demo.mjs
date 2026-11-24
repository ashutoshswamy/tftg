// Demo data for the existing admin (Ashutosh Swamy) and dispatcher (John Wick).
// Run once: node --env-file=.env.local scripts/seed-demo.mjs
// Refuses to run if the directory already has parties.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ok = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const token = () =>
  randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = () => "TFTG-" + [...randomBytes(6)].map((b) => ALPHA[b % ALPHA.length]).join("");
const ago = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600e3).toISOString();
const day = (offset) => new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10);

const members = ok(await db.from("memberships").select("clerk_user_id, full_name, role"), "memberships");
const admin = members.find((m) => m.role === "admin");
const dispatcher = members.find((m) => m.role === "dispatcher");
if (!admin || !dispatcher) throw new Error("Need one admin and one dispatcher membership");

const existing = ok(await db.from("parties").select("id").limit(1), "parties check");
if (existing.length) throw new Error("Directory is not empty; refusing to seed twice.");

// ---- tax + company ---------------------------------------------------
const taxes = ok(
  await db.from("tax_rates").insert([
    { name: "GST 18%", rate_pct: 18 },
    { name: "GST 5%", rate_pct: 5 },
    { name: "Zero rated", rate_pct: 0 },
  ]).select("id, name, rate_pct"),
  "tax_rates"
);
const gst18 = taxes.find((t) => t.name === "GST 18%");
ok(
  await db.from("company_settings").update({
    legal_name: "OBL Logistics Private Limited",
    tax_id: "27AABCO1234F1Z5",
    address: "Unit 4, Harbour Industrial Estate, Navi Mumbai 400703",
    bank_details: "Bank: Coastal Union Bank\nA/C: 0048 2291 7731\nIFSC: CUBL0000048",
    default_tax_rate_id: gst18.id,
  }).eq("id", true),
  "company_settings"
);

// ---- directory -------------------------------------------------------
const partyDefs = [
  ["Northwind Traders", ["customer"], "ops@northwind.example", "+91 22 4012 8841"],
  ["Harbor & Co", ["customer", "consignee"], "dispatch@harborco.example", "+91 22 6678 3320"],
  ["Meridian Foods", ["customer"], "logistics@meridianfoods.example", "+91 20 2711 4409"],
  ["Atlas Manufacturing", ["shipper"], "shipping@atlasmfg.example", "+91 79 4003 9912"],
  ["Kestrel Textiles", ["shipper"], "export@kestreltextiles.example", "+91 261 288 4417"],
  ["Bluewater Retail", ["consignee"], "receiving@bluewater.example", "+91 80 4120 7765"],
  ["Summit Pharma", ["consignee", "customer"], "supply@summitpharma.example", "+91 40 6611 0928"],
  ["Redline Freight", ["carrier"], "bookings@redlinefreight.example", "+91 22 5509 1180"],
  ["SkyBridge Air Cargo", ["carrier"], "cargo@skybridge.example", "+91 11 4466 2203"],
  ["Pacific Ocean Lines", ["carrier"], "agency@pacificocean.example", "+91 44 3098 5516"],
  ["Quickdrop Couriers", ["carrier"], "hello@quickdrop.example", "+91 22 7100 3345"],
];
const parties = ok(
  await db.from("parties").insert(partyDefs.map(([name, , email, phone]) => ({ name, email, phone }))).select("id, name"),
  "parties"
);
const P = Object.fromEntries(parties.map((p) => [p.name, p.id]));
ok(
  await db.from("party_roles").insert(
    partyDefs.flatMap(([name, roles]) => roles.map((role) => ({ party_id: P[name], role })))
  ),
  "party_roles"
);

const loc = (party, label, line, city, state, postal, lat, lng) => ({
  party_id: P[party], label, address_line1: line, city, state, postal_code: postal, country: "India", lat, lng,
});
const locations = ok(
  await db.from("locations").insert([
    loc("Atlas Manufacturing", "Atlas Plant", "Plot 22, GIDC Vatva", "Ahmedabad", "Gujarat", "382445", 22.96, 72.65),
    loc("Kestrel Textiles", "Kestrel Mill", "14 Textile Market Road", "Surat", "Gujarat", "395002", 21.19, 72.83),
    loc("Bluewater Retail", "Bluewater DC", "Survey 88, Hoskote Logistics Park", "Bengaluru", "Karnataka", "562114", 13.07, 77.8),
    loc("Summit Pharma", "Summit Cold Store", "Genome Valley, Shameerpet", "Hyderabad", "Telangana", "500078", 17.59, 78.58),
    loc("Harbor & Co", "Harbor Warehouse", "Gate 3, JNPT Road", "Navi Mumbai", "Maharashtra", "400707", 18.95, 72.95),
    loc("Meridian Foods", "Meridian Kitchen", "Baner Road", "Pune", "Maharashtra", "411045", 18.56, 73.78),
  ]).select("id, label, address_line1, city, lat, lng"),
  "locations"
);
const L = Object.fromEntries(locations.map((l) => [l.label, l]));
const addr = (l) => `${l.label}, ${l.address_line1}, ${l.city}`;

const drivers = ok(
  await db.from("drivers").insert([
    { carrier_id: P["Redline Freight"], name: "Ravi Kulkarni", phone: "+91 98200 11452", license_no: "MH0420190012345" },
    { carrier_id: P["Redline Freight"], name: "Imran Sheikh", phone: "+91 98334 80921", license_no: "MH0120180067890" },
    { carrier_id: P["Quickdrop Couriers"], name: "Priya Nair", phone: "+91 99870 33128", license_no: "KA0520210054321" },
  ]).select("id, name, carrier_id"),
  "drivers"
);
const vehicles = ok(
  await db.from("vehicles").insert([
    { carrier_id: P["Redline Freight"], type: "truck", plate: "MH 04 KL 2291", capacity: "18 t" },
    { carrier_id: P["Redline Freight"], type: "truck", plate: "MH 43 BX 7014", capacity: "12 t" },
    { carrier_id: P["Quickdrop Couriers"], type: "van", plate: "KA 05 MN 3306", capacity: "1.2 t" },
  ]).select("id, carrier_id"),
  "vehicles"
);
const D = Object.fromEntries(drivers.map((d) => [d.name, d]));

// ---- shipments -------------------------------------------------------
// [mode, status, customer, shipper, consignee, carrier, driver, ref, from, to, ageDays, createdBy, note]
const A = admin.clerk_user_id, J = dispatcher.clerk_user_id;
const defs = [
  ["road", "in_transit", "Northwind Traders", "Atlas Manufacturing", "Bluewater Retail", "Redline Freight", "Ravi Kulkarni", "PO-88421", "Atlas Plant", "Bluewater DC", 2, A, "Palletised auto parts, 22 pallets"],
  ["road", "in_transit", "Meridian Foods", "Kestrel Textiles", "Harbor & Co", "Redline Freight", "Imran Sheikh", "PO-88437", "Kestrel Mill", "Harbor Warehouse", 1, J, "Fabric rolls, keep dry"],
  ["road", "assigned", "Harbor & Co", "Atlas Manufacturing", "Summit Pharma", "Redline Freight", "Ravi Kulkarni", "PO-88460", "Atlas Plant", "Summit Cold Store", 1, J, "Temperature controlled, 2-8 C"],
  ["road", "pending", "Northwind Traders", "Kestrel Textiles", "Bluewater Retail", null, null, "PO-88502", "Kestrel Mill", "Bluewater DC", 0, A, "Awaiting carrier quote"],
  ["courier", "in_transit", "Summit Pharma", "Summit Pharma", "Harbor & Co", "Quickdrop Couriers", "Priya Nair", "AWB-QD-5531", "Summit Cold Store", "Harbor Warehouse", 0, J, "Sample kits, signature required"],
  ["air", "assigned", "Meridian Foods", "Atlas Manufacturing", "Bluewater Retail", "SkyBridge Air Cargo", null, "AWB-176-48203391", "Atlas Plant", "Bluewater DC", 1, A, "Urgent, 140 kg"],
  ["ocean", "in_transit", "Harbor & Co", "Kestrel Textiles", "Northwind Traders", "Pacific Ocean Lines", null, "MSCU 482911 / BL PO-7720", "Kestrel Mill", "Harbor Warehouse", 9, A, "1 x 40ft container"],
  ["road", "delivered", "Northwind Traders", "Atlas Manufacturing", "Bluewater Retail", "Redline Freight", "Imran Sheikh", "PO-88102", "Atlas Plant", "Bluewater DC", 18, J, "Delivered in full"],
  ["road", "delivered", "Meridian Foods", "Kestrel Textiles", "Harbor & Co", "Redline Freight", "Ravi Kulkarni", "PO-88133", "Kestrel Mill", "Harbor Warehouse", 15, A, "Delivered in full"],
  ["road", "delivered", "Summit Pharma", "Atlas Manufacturing", "Summit Pharma", "Redline Freight", "Imran Sheikh", "PO-88190", "Atlas Plant", "Summit Cold Store", 12, J, "Delivered, POD signed"],
  ["courier", "delivered", "Harbor & Co", "Summit Pharma", "Harbor & Co", "Quickdrop Couriers", "Priya Nair", "AWB-QD-5412", "Summit Cold Store", "Harbor Warehouse", 8, J, "Delivered to reception"],
  ["air", "delivered", "Northwind Traders", "Atlas Manufacturing", "Bluewater Retail", "SkyBridge Air Cargo", null, "AWB-176-48201877", "Atlas Plant", "Bluewater DC", 6, A, "Delivered, 60 kg"],
  ["road", "cancelled", "Meridian Foods", "Kestrel Textiles", "Harbor & Co", "Redline Freight", null, "PO-88301", "Kestrel Mill", "Harbor Warehouse", 5, J, "Cancelled by customer"],
  ["rail", "pending", "Harbor & Co", "Atlas Manufacturing", "Northwind Traders", null, null, "RR-30145", "Atlas Plant", "Harbor Warehouse", 0, A, "Rake booking requested"],
];

const FLOW = { pending: ["pending"], assigned: ["pending", "assigned"], in_transit: ["pending", "assigned", "in_transit"], delivered: ["pending", "assigned", "in_transit", "delivered"], cancelled: ["pending", "cancelled"] };
const NOTE = { pending: "Shipment created", assigned: "Carrier assigned", in_transit: "Picked up, on the way", delivered: "Delivered, POD received", cancelled: "Cancelled" };

const shipments = [];
for (const [mode, status, cust, shp, con, car, drv, ref, from, to, age, by, notes] of defs) {
  const created = ago(age, 3);
  const driver = drv ? D[drv] : null;
  const vehicle = driver ? vehicles.find((v) => v.carrier_id === driver.carrier_id) : null;
  const row = ok(
    await db.from("shipments").insert({
      tracking_code: code(), customer_token: token(), driver_token: token(),
      mode, status,
      customer_id: P[cust], shipper_id: P[shp], consignee_id: P[con], carrier_id: car ? P[car] : null,
      driver_id: driver?.id ?? null, vehicle_id: vehicle?.id ?? null,
      details: { reference: ref }, notes, created_by: by,
      created_at: created, updated_at: status === "pending" ? created : ago(Math.max(age - 1, 0), 1),
    }).select("id, tracking_code").single(),
    "shipment"
  );
  shipments.push({ ...row, status, mode, cust, age, from, to });

  ok(
    await db.from("stops").insert([
      { shipment_id: row.id, sequence: 1, kind: "pickup", location_id: L[from].id, address_snapshot: addr(L[from]),
        scheduled_at: ago(age, 1), arrived_at: status === "pending" || status === "assigned" ? null : ago(age, 0) },
      { shipment_id: row.id, sequence: 2, kind: "dropoff", location_id: L[to].id, address_snapshot: addr(L[to]),
        scheduled_at: ago(age - 2), arrived_at: status === "delivered" ? ago(Math.max(age - 2, 0)) : null },
    ]),
    "stops"
  );

  const steps = FLOW[status];
  ok(
    await db.from("status_events").insert(
      steps.map((s, i) => ({
        shipment_id: row.id, status: s, note: NOTE[s],
        created_by: i % 2 ? J : A,
        created_at: new Date(new Date(created).getTime() + i * 6 * 3600e3).toISOString(),
      }))
    ),
    "status_events"
  );

  if (status === "in_transit") {
    const a = L[from], b = L[to];
    const pings = [0.25, 0.4, 0.55, 0.7].map((t, i) => ({
      shipment_id: row.id,
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
      speed: 52 + i * 3,
      recorded_at: ago(0, 4 - i),
    }));
    ok(await db.from("location_pings").insert(pings), "pings");
  }
}

// ---- invoices --------------------------------------------------------
const RATE = 18;
async function invoice(s, items, state, { due, paid } = {}) {
  const sub = items.reduce((n, i) => n + i.qty * i.price, 0);
  const tax = Math.round((sub * RATE) / 100);
  const number = state === "draft" ? null : ok(await db.rpc("next_invoice_number"), "invoice number");
  const inv = ok(
    await db.from("invoices").insert({
      number, shipment_id: s.id, customer_id: P[s.cust],
      status: state === "paid" ? "paid" : state, currency: "USD",
      issue_date: state === "draft" ? null : day(-s.age + 1), due_date: state === "draft" ? null : due,
      subtotal_minor: sub, tax_total_minor: tax, total_minor: sub + tax,
      invoice_token: token(), // explicit: the DB default still needs migration 0004
    }).select("id, total_minor").single(),
    "invoice"
  );
  ok(
    await db.from("invoice_items").insert(
      items.map((i) => ({
        invoice_id: inv.id, description: i.d, qty: i.qty, unit_price_minor: i.price,
        tax_rate_pct: RATE, tax_name: "GST 18%", amount_minor: i.qty * i.price,
      }))
    ),
    "invoice_items"
  );
  if (paid) {
    ok(await db.from("payments").insert({ invoice_id: inv.id, amount_minor: paid === "full" ? inv.total_minor : Math.round(inv.total_minor / 2), paid_at: day(-2), method: "Bank transfer", reference: "NEFT-" + randomBytes(3).toString("hex").toUpperCase() }), "payment");
  }
}
const byRef = (i) => shipments[i];
await invoice(byRef(7), [{ d: "Linehaul, Ahmedabad to Bengaluru", qty: 1, price: 184000 }, { d: "Loading and unloading", qty: 22, price: 1200 }], "paid", { due: day(-3), paid: "full" });
await invoice(byRef(8), [{ d: "Linehaul, Surat to Navi Mumbai", qty: 1, price: 96000 }, { d: "Detention (4 h)", qty: 4, price: 2500 }], "sent", { due: day(-6) }); // overdue
await invoice(byRef(9), [{ d: "Temperature controlled linehaul", qty: 1, price: 238000 }], "sent", { due: day(6), paid: "part" });
await invoice(byRef(10), [{ d: "Courier, same day", qty: 1, price: 18500 }], "paid", { due: day(2), paid: "full" });
await invoice(byRef(11), [{ d: "Air freight, 60 kg", qty: 60, price: 1450 }, { d: "Handling", qty: 1, price: 9000 }], "draft");

console.log(`Seeded for ${admin.full_name} (admin) and ${dispatcher.full_name} (dispatcher): ${parties.length} parties, ${shipments.length} shipments, 5 invoices.`);
