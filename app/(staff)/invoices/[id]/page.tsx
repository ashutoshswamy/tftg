import { one } from "@/lib/relation";
import Link from "next/link";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Badge } from "@ashutoshswamy/smoui";
import { Card } from "@/components/card";
import { CopyLink } from "@/components/copy-link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/money";
import {
  finalizeInvoice,
  recordPayment,
  voidInvoice,
} from "@/lib/actions/invoices";
import { SubmitButton, Input } from "@/components/ui";

const TONE = {
  draft: "neutral",
  sent: "warning",
  paid: "positive",
  void: "negative",
} as const;

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `id, number, status, currency, prices_include_tax, subtotal_minor, tax_total_minor,
       total_minor, issue_date, due_date, notes, pdf_path, invoice_token,
       customer:customer_id(name),
       items:invoice_items(id, description, qty, unit_price_minor, tax_rate_pct, tax_name, amount_minor),
       payments(id, amount_minor, paid_at, method, reference)`
    )
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const errorMessage = Array.isArray(error) ? error[0] : error;
  const isDraft = invoice.status === "draft";

  let pdfUrl: string | null = null;
  if (invoice.pdf_path) {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_path, 60);
    pdfUrl = data?.signedUrl ?? null;
  }

  const money = (minor: number) => formatMoney(minor, invoice.currency);
  const paid = invoice.payments.reduce((n, p) => n + p.amount_minor, 0);

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="text-sm text-muted hover:text-ink">
        All invoices
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="code text-2xl leading-none sm:text-3xl">
                {invoice.number ?? "Draft invoice"}
              </h1>
              <Badge tone={TONE[invoice.status as keyof typeof TONE] ?? "neutral"}>
                {invoice.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {one(invoice.customer)?.name ?? "No customer"}
              {invoice.due_date ? `, due ${invoice.due_date}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Total</p>
            <p className="text-2xl font-bold tabular-nums text-brand-ink">
              {money(invoice.total_minor)}
            </p>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <ArrowDownTrayIcon className="size-5" aria-hidden="true" />
              PDF
            </a>
          )}
        </div>
      </Card>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card title="Order" description="Set when the shipment was created.">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Price</th>
                    <th className="num">Tax</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="num">{item.qty}</td>
                      <td className="num">{money(item.unit_price_minor)}</td>
                      <td className="num text-muted">{item.tax_rate_pct}%</td>
                      <td className="num font-semibold">{money(item.amount_minor)}</td>
                    </tr>
                  ))}
                  {!invoice.items.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-muted">
                        No line items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-2 text-sm">
              <Row label="Subtotal" value={money(invoice.subtotal_minor)} />
              <Row label="Tax" value={money(invoice.tax_total_minor)} />
              <div className="flex justify-between rounded-lg bg-brand-soft px-3 py-2.5 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(invoice.total_minor)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <aside className="space-y-6">
          {isDraft ? (
            <Card title="Confirm invoice" description="The lines come from the shipment's order. Confirming assigns the invoice number and generates the PDF.">
              <form action={finalizeInvoice.bind(null, id)}>
                <SubmitButton full>Confirm and issue</SubmitButton>
              </form>
            </Card>
          ) : (
            invoice.status !== "void" && (
              <>
                <Card title="Payments" description={`${money(paid)} received of ${money(invoice.total_minor)}`}>
                  <ul className="space-y-1.5 text-sm">
                    {invoice.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg bg-ground px-3 py-2.5">
                        <span>
                          {p.paid_at}
                          {p.method ? `, ${p.method}` : ""}
                        </span>
                        <span className="font-semibold tabular-nums">{money(p.amount_minor)}</span>
                      </li>
                    ))}
                    {!invoice.payments.length && <li className="text-muted">No payments yet.</li>}
                  </ul>

                  {invoice.status !== "paid" && (
                    <form action={recordPayment.bind(null, id)} className="space-y-3">
                      <Input label="Amount" name="amount" type="number" step="0.01" required />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Method" name="method" />
                        <Input label="Reference" name="reference" />
                      </div>
                      <SubmitButton tone="secondary" full>Record payment</SubmitButton>
                    </form>
                  )}
                </Card>

                <Card title="Customer link" description="They can read and download the invoice, no account needed.">
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLink path={`/i/${invoice.invoice_token}`} />
                    <a
                      href={`/i/${invoice.invoice_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary min-h-9"
                    >
                      Open
                    </a>
                    <form action={voidInvoice.bind(null, id)} className="ml-auto">
                      <SubmitButton tone="danger" small>Void invoice</SubmitButton>
                    </form>
                  </div>
                </Card>
              </>
            )
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
