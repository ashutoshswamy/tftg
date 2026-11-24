import { one } from "@/lib/relation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FleetMap, type FleetPoint } from "@/components/fleet-map";

// Active = on its way. Pending has no driver yet, delivered is done.
const ACTIVE = ["assigned", "in_transit"] as const;

export default async function MapPage() {
  const supabase = createAdminClient();
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, tracking_code, status, customer:customer_id(name), carrier:carrier_id(name), stops(sequence, kind, address_snapshot, location:location_id(lat, lng))"
    )
    .in("status", ACTIVE)
    .limit(200);

  const ids = (shipments ?? []).map((s) => s.id);
  const { data: pings } = ids.length
    ? await supabase
        .from("location_pings")
        .select("shipment_id, lat, lng, recorded_at")
        .in("shipment_id", ids)
        .order("recorded_at", { ascending: false })
        .limit(2000)
    : { data: [] };

  // ponytail: newest-first scan; the first ping seen per shipment is its latest.
  // Shipments quiet for a long time can fall outside the 2000-ping window.
  const latest = new Map<string, { lat: number; lng: number; recorded_at: string }>();
  for (const p of pings ?? []) {
    if (p.lng != null && !latest.has(p.shipment_id)) latest.set(p.shipment_id, p as never);
  }

  const points: FleetPoint[] = (shipments ?? []).flatMap((s) => {
    const ping = latest.get(s.id);
    if (!ping) return [];
    const stops = [...(s.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
    const last = stops.length > 1 ? stops[stops.length - 1] : undefined;
    const loc = last ? one(last.location) : undefined;
    return [
      {
        id: s.id,
        code: s.tracking_code,
        status: s.status as FleetPoint["status"],
        party: one(s.customer)?.name ?? "No customer",
        carrier: one(s.carrier)?.name ?? "Unassigned",
        lat: ping.lat,
        lng: ping.lng,
        recordedAt: ping.recorded_at,
        dest:
          loc?.lat != null && loc?.lng != null
            ? { lat: loc.lat, lng: loc.lng, label: last?.address_snapshot ?? "Drop-off" }
            : null,
      },
    ];
  });

  const waiting = (shipments?.length ?? 0) - points.length;
  const stats = [
    ["In transit", points.filter((p) => p.status === "in_transit").length],
    ["Assigned", points.filter((p) => p.status === "assigned").length],
    ["Not reporting", waiting],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Live map</h1>
        <ul className="flex flex-wrap gap-2 text-sm">
          {stats.map(([label, n]) => (
            <li key={label} className="rounded-lg bg-panel px-3 py-1.5">
              <span className="font-semibold tabular-nums">{n}</span>{" "}
              <span className="text-muted">{label.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </div>
      <FleetMap points={points} />
    </div>
  );
}
