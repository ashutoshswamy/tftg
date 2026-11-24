import { one } from "@/lib/relation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { DispatchBoard } from "@/components/dispatch-board";
import { STATUS_META, type ShipmentStatus } from "@/components/status-diamond";

const COLUMNS: ShipmentStatus[] = ["pending", "assigned", "in_transit", "delivered"];

export default async function DispatchPage() {
  const supabase = createAdminClient();
  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, tracking_code, mode, status, updated_at, customer:customer_id(name), carrier:carrier_id(name)"
    )
    .in("status", COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(200);

  // ponytail: delivered shows only the latest 8 so the board stays about open work.
  const columns = COLUMNS.map((status) => ({
    id: status,
    title: STATUS_META[status].label,
    cards: (shipments ?? [])
      .filter((s) => s.status === status)
      .slice(0, status === "delivered" ? 8 : undefined)
      .map((s) => ({
        id: s.id,
        title: s.tracking_code,
        description: `${one(s.customer)?.name ?? "No customer"} · ${one(s.carrier)?.name ?? "Unassigned"}`,
        tag: s.mode,
      })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Dispatch</h1>
        <Link href="/shipments/new" className="btn btn-primary">
          New shipment
        </Link>
      </div>
      <p className="text-sm text-muted">
        Drag a shipment to another column to change its status. Open a shipment from the
        Shipments list for details.
      </p>
      <DispatchBoard columns={columns} />
    </div>
  );
}
