import { one } from "@/lib/relation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusFilter } from "@/components/status-filter";
import { ShipmentsTable } from "@/components/shipments-table";
import {
  STATUS_META,
  isShipmentStatus,
  type ShipmentStatus,
} from "@/components/status-diamond";

const ORDER = Object.keys(STATUS_META) as ShipmentStatus[];

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status: rawStatus } = await searchParams;
  const requested = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const filter = requested && isShipmentStatus(requested) ? requested : null;

  const supabase = createAdminClient();
  let query = supabase
    .from("shipments")
    .select(
      "id, tracking_code, mode, status, created_at, customer:customer_id(name), carrier:carrier_id(name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) query = query.eq("status", filter);

  const { data: shipments } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Shipments</h1>
        <Link href="/shipments/new" className="btn btn-primary">
          New shipment
        </Link>
      </div>

      <StatusFilter
        value={filter ?? ""}
        options={[
          { value: "", label: "All" },
          ...ORDER.map((status) => ({ value: status, label: STATUS_META[status].label })),
        ]}
      />

      <ShipmentsTable
        rows={(shipments ?? []).map((s) => ({
          id: s.id,
          code: s.tracking_code,
          status: isShipmentStatus(s.status) ? STATUS_META[s.status].label : s.status,
          customer: one(s.customer)?.name ?? "No customer",
          carrier: one(s.carrier)?.name ?? "Unassigned",
          mode: s.mode,
          created: new Date(s.created_at).toLocaleDateString(),
        }))}
        emptyText={
          filter
            ? `No ${STATUS_META[filter].label.toLowerCase()} shipments.`
            : "No shipments yet. Create the first one."
        }
      />
    </div>
  );
}
