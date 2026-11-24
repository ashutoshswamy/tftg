import { one } from "@/lib/relation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import { InvoicesTable } from "@/components/invoices-table";

export default async function InvoicesPage() {
  const supabase = createAdminClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, number, status, currency, total_minor, due_date, customer:customer_id(name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Invoices</h1>
        <p className="mt-1 text-sm text-muted">Create an invoice from a shipment, then finalize it to send.</p>
      </div>

      <InvoicesTable
        rows={(invoices ?? []).map((inv) => ({
          id: inv.id,
          number: inv.number ?? `Draft ${inv.id.slice(0, 4)}`,
          customer: one(inv.customer)?.name ?? "No customer",
          status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
          total: formatMoney(inv.total_minor, inv.currency),
          due: inv.due_date ?? "Not set",
        }))}
      />
    </div>
  );
}
