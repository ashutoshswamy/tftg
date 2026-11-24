"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@ashutoshswamy/smoui";

export type InvoiceRow = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: string;
  due: string;
};

const TONES = { Draft: "info", Sent: "warn", Paid: "good", Void: "bad" } as const;

// smoui DataTable has no row links, so a click on a row opens its invoice.
// Rows are matched by the first column, which is unique (drafts carry a short id).
export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter();
  const byNumber = new Map(rows.map((r) => [r.number, r.id]));

  return (
    <div
      className="[&_[role=row]]:cursor-pointer"
      onClick={(e) => {
        const row = (e.target as HTMLElement).closest('[role="row"]');
        const number = row?.querySelector('[role="cell"]')?.textContent?.trim();
        const id = number && byNumber.get(number);
        if (id) router.push(`/invoices/${id}`);
      }}
    >
      <DataTable
        caption="Invoices"
        rowKey="id"
        searchable
        pageSize={15}
        emptyText="No invoices yet. Create one from a shipment."
        columns={[
          { key: "number", label: "Number", sortable: true, width: "1.1fr" },
          { key: "customer", label: "Customer", sortable: true, width: "1.6fr" },
          { key: "status", label: "Status", type: "status", tones: TONES, sortable: true, width: "0.9fr" },
          { key: "total", label: "Total", sortable: true, align: "right", width: "1.1fr" },
          { key: "due", label: "Due", sortable: true, align: "right", width: "1fr" },
        ]}
        rows={rows}
      />
    </div>
  );
}
