"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@ashutoshswamy/smoui";

export type ShipmentRow = {
  id: string;
  code: string;
  status: string;
  customer: string;
  carrier: string;
  mode: string;
  created: string;
};

const TONES = {
  Pending: "info",
  Assigned: "info",
  "In transit": "warn",
  Delivered: "good",
  Cancelled: "bad",
} as const;

// smoui DataTable has no row links, so a click on a row opens its shipment.
// Rows are matched by tracking code (first column, unique).
export function ShipmentsTable({
  rows,
  emptyText,
}: {
  rows: ShipmentRow[];
  emptyText: string;
}) {
  const router = useRouter();
  const byCode = new Map(rows.map((r) => [r.code, r.id]));

  return (
    <div
      className="[&_[role=row]]:cursor-pointer"
      onClick={(e) => {
        const row = (e.target as HTMLElement).closest('[role="row"]');
        const code = row?.querySelector('[role="cell"]')?.textContent?.trim();
        const id = code && byCode.get(code);
        if (id) router.push(`/shipments/${id}`);
      }}
    >
      <DataTable
        caption="Shipments"
        rowKey="id"
        searchable
        pageSize={15}
        emptyText={emptyText}
        columns={[
          { key: "code", label: "Tracking code", sortable: true, width: "1.2fr" },
          { key: "status", label: "Status", type: "status", tones: TONES, sortable: true, width: "1fr" },
          { key: "customer", label: "Customer", sortable: true, width: "1.4fr" },
          { key: "carrier", label: "Carrier", sortable: true, width: "1.2fr" },
          { key: "mode", label: "Mode", sortable: true, width: "0.7fr" },
          { key: "created", label: "Created", sortable: true, align: "right", width: "1fr" },
        ]}
        rows={rows}
      />
    </div>
  );
}
