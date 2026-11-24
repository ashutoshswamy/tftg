"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcInvoiceTotals, calcLine, currencyExponent } from "@/lib/money";
import { getLogo } from "@/lib/logo";
import { one } from "@/lib/relation";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

/** currency/tax cascade: shipment override → company default. */
export async function createDraftInvoice(shipmentId: string) {
  const supabase = createAdminClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("customer_id, currency, tax_rate_id, prices_include_tax")
    .eq("id", shipmentId)
    .single();

  if (!shipment) redirect("/shipments");

  // The order is entered on the shipment; invoicing only copies and confirms it.
  const { data: order } = await supabase
    .from("shipment_items")
    .select("description, qty, unit_price_minor, tax_rate_pct, tax_name")
    .eq("shipment_id", shipmentId)
    .order("position");
  if (!order?.length) {
    redirect(
      `/shipments/${shipmentId}?error=${encodeURIComponent("Add the order lines to this shipment first (Edit)")}`
    );
  }

  const { data: company } = await supabase
    .from("company_settings")
    .select("default_currency, default_tax_rate_id, prices_include_tax")
    .single();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      shipment_id: shipmentId,
      customer_id: shipment.customer_id,
      currency: shipment.currency ?? company?.default_currency ?? "USD",
      prices_include_tax: shipment.prices_include_tax ?? company?.prices_include_tax ?? false,
    })
    .select("id")
    .single();

  if (error || !invoice) {
    redirect(`/shipments/${shipmentId}?error=${encodeURIComponent(error?.message ?? "Could not create invoice")}`);
  }

  const pricesIncludeTax = shipment.prices_include_tax ?? company?.prices_include_tax ?? false;
  await supabase.from("invoice_items").insert(
    order.map((o) => ({
      invoice_id: invoice.id,
      description: o.description,
      qty: o.qty,
      unit_price_minor: o.unit_price_minor,
      tax_rate_pct: o.tax_rate_pct,
      tax_name: o.tax_name,
      amount_minor: calcLine(Number(o.qty), o.unit_price_minor, Number(o.tax_rate_pct), pricesIncludeTax)
        .amountMinor,
    }))
  );
  await recalcInvoiceTotals(invoice.id);

  redirect(`/invoices/${invoice.id}`);
}

async function recalcInvoiceTotals(invoiceId: string) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("prices_include_tax")
    .eq("id", invoiceId)
    .single();
  const { data: items } = await supabase
    .from("invoice_items")
    .select("qty, unit_price_minor, tax_rate_pct")
    .eq("invoice_id", invoiceId);

  const totals = calcInvoiceTotals(
    (items ?? []).map((i) => ({
      qty: Number(i.qty),
      unitPriceMinor: i.unit_price_minor,
      taxRatePct: Number(i.tax_rate_pct),
    })),
    invoice?.prices_include_tax ?? false
  );

  await supabase
    .from("invoices")
    .update({
      subtotal_minor: totals.subtotalMinor,
      tax_total_minor: totals.taxTotalMinor,
      total_minor: totals.totalMinor,
    })
    .eq("id", invoiceId);
}

export async function finalizeInvoice(invoiceId: string) {
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `id, currency, prices_include_tax, subtotal_minor, tax_total_minor, total_minor, notes,
       customer:customer_id(name),
       items:invoice_items(description, qty, unit_price_minor, tax_rate_pct, amount_minor)`
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) redirect("/invoices");
  if (!invoice.items?.length) {
    redirect(`/invoices/${invoiceId}?error=This invoice has no line items. Add the order to the shipment and create it again.`);
  }

  const { data: company } = await supabase
    .from("company_settings")
    .select("name, legal_name, address, tax_id, bank_details, invoice_prefix, payment_terms_days")
    .single();

  const { data: numberResult, error: numberError } = await supabase.rpc(
    "next_invoice_number"
  );
  if (numberError || !numberResult) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(numberError?.message ?? "Could not assign invoice number")}`);
  }

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + (company?.payment_terms_days ?? 15));

  const pdfBytes = await renderInvoicePdf({
    number: numberResult,
    issueDate: issueDate.toISOString().slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    currency: invoice.currency,
    company: {
      name: company?.name ?? "",
      legalName: company?.legal_name,
      address: company?.address,
      taxId: company?.tax_id,
      bankDetails: company?.bank_details,
      logo: await getLogo(),
    },
    customer: { name: one(invoice.customer)?.name ?? "Customer" },
    items: invoice.items.map((i) => ({
      description: i.description,
      qty: Number(i.qty),
      unitPriceMinor: i.unit_price_minor,
      taxRatePct: Number(i.tax_rate_pct),
      amountMinor: i.amount_minor,
    })),
    subtotalMinor: invoice.subtotal_minor,
    taxTotalMinor: invoice.tax_total_minor,
    totalMinor: invoice.total_minor,
    notes: invoice.notes,
  });

  const pdfPath = `${invoiceId}.pdf`;
  // Service role for storage: the staff client's RLS policy covers tables,
  // not the storage bucket, and this write has already been authorized by
  // the staff session above.
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("invoices")
    .upload(pdfPath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(uploadError.message)}`);
  }

  await supabase
    .from("invoices")
    .update({
      number: numberResult,
      status: "sent",
      issue_date: issueDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      pdf_path: pdfPath,
    })
    .eq("id", invoiceId);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function recordPayment(invoiceId: string, formData: FormData) {
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "").trim() || null;
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(`/invoices/${invoiceId}?error=Enter a payment amount`);
  }

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("currency, total_minor")
    .eq("id", invoiceId)
    .single();

  if (!invoice) redirect("/invoices");

  const amountMinor = Math.round(amount * 10 ** currencyExponent(invoice.currency));
  await supabase.from("payments").insert({ invoice_id: invoiceId, amount_minor: amountMinor, method, reference });

  const { data: payments } = await supabase
    .from("payments")
    .select("amount_minor")
    .eq("invoice_id", invoiceId);
  const paidMinor = (payments ?? []).reduce((sum, p) => sum + p.amount_minor, 0);

  if (paidMinor >= invoice.total_minor) {
    await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
  }

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function voidInvoice(invoiceId: string) {
  const supabase = createAdminClient();
  await supabase.from("invoices").update({ status: "void" }).eq("id", invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}
