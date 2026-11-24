import { notFound } from "next/navigation";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Badge } from "@ashutoshswamy/smoui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLogoVersion } from "@/lib/logo";
import { one } from "@/lib/relation";
import { formatMoney } from "@/lib/money";
import { PublicShell } from "@/components/public-shell";

const STATUS = {
  sent: { tone: "warning", label: "Awaiting payment" },
  paid: { tone: "positive", label: "Paid" },
  void: { tone: "negative", label: "Void" },
} as const;

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const [{ data: invoice }, { data: company }, logoVersion] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `number, status, currency, subtotal_minor, tax_total_minor, total_minor,
         issue_date, due_date, notes, pdf_path, customer:customer_id(name),
         items:invoice_items(description, qty, unit_price_minor, tax_rate_pct, amount_minor)`
      )
      .eq("invoice_token", token)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("name, legal_name, address, tax_id, bank_details")
      .single(),
    getLogoVersion(),
  ]);

  if (!invoice || invoice.status === "draft") {
    notFound();
  }

  let pdfUrl: string | null = null;
  if (invoice.pdf_path) {
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_path, 300, { download: `${invoice.number}.pdf` });
    pdfUrl = data?.signedUrl ?? null;
  }

  const money = (minor: number) => formatMoney(minor, invoice.currency);
  const status = STATUS[invoice.status as keyof typeof STATUS];

  return (
    <PublicShell width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : <span />}
          {pdfUrl && (
            <a href={pdfUrl} className="btn btn-primary">
              <ArrowDownTrayIcon className="size-5" aria-hidden="true" />
              Download PDF
            </a>
          )}
        </div>

        <article className="overflow-hidden rounded-xl bg-panel">
          <div className="h-2 bg-brand" />
          <div className="space-y-8 p-6 sm:p-10">
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/logo?v=${encodeURIComponent(logoVersion ?? "default")}`}
                  alt={company?.name ?? "Company logo"}
                  className="max-h-14 max-w-48 object-contain object-left"
                />
                <div className="text-sm text-muted">
                  {(company?.legal_name || company?.name) && (
                    <p className="font-semibold text-ink">{company?.legal_name || company?.name}</p>
                  )}
                                    {company?.address && <p className="whitespace-pre-line">{company.address}</p>}
                  {company?.tax_id && <p>Tax ID {company.tax_id}</p>}
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-4xl font-bold leading-none text-brand-ink">Invoice</h1>
                <p className="code mt-2 text-muted">{invoice.number}</p>
              </div>
            </header>

            <dl className="grid gap-4 rounded-xl bg-ground p-5 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
              <Meta label="Billed to" value={one(invoice.customer)?.name ?? "Customer"} />
              <Meta label="Issued" value={invoice.issue_date} />
              <Meta label="Due" value={invoice.due_date} />
              <div className="sm:text-right">
                <dt className="text-xs text-muted">Amount due</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-brand-ink">
                  {money(invoice.total_minor)}
                </dd>
              </div>
            </dl>

            <div className="overflow-x-auto">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th className="pl-3">Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit price</th>
                    <th className="num">Tax</th>
                    <th className="num pr-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="pl-3">{item.description}</td>
                      <td className="num">{item.qty}</td>
                      <td className="num">{money(item.unit_price_minor)}</td>
                      <td className="num text-muted">{item.tax_rate_pct}%</td>
                      <td className="num pr-3 font-semibold">{money(item.amount_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between px-3">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(invoice.subtotal_minor)}</dd>
              </div>
              <div className="flex justify-between px-3">
                <dt className="text-muted">Tax</dt>
                <dd className="tabular-nums">{money(invoice.tax_total_minor)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-brand px-3 py-2.5 text-base font-bold text-ink">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(invoice.total_minor)}</dd>
              </div>
            </dl>

            {(company?.bank_details || invoice.notes) && (
              <div className="grid gap-6 text-sm sm:grid-cols-2">
                {company?.bank_details && (
                  <div>
                    <h2 className="font-semibold">Payment details</h2>
                    <p className="mt-1 whitespace-pre-line text-muted">{company.bank_details}</p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h2 className="font-semibold">Notes</h2>
                    <p className="mt-1 whitespace-pre-line text-muted">{invoice.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
      </div>
    </PublicShell>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value ?? "On receipt"}</dd>
    </div>
  );
}
