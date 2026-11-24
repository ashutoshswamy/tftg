import { notFound } from "next/navigation";
import { ShipmentForm } from "@/components/shipment-form";
import { updateShipment } from "@/lib/actions/shipments";
import { createAdminClient } from "@/lib/supabase/admin";
import { currencyExponent } from "@/lib/money";

export default async function EditShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select(
      "mode, customer_id, shipper_id, consignee_id, carrier_id, driver_id, vehicle_id, currency, notes, details"
    )
    .eq("id", id)
    .single();

  if (!shipment) notFound();

  const [{ data: rows }, { data: company }] = await Promise.all([
    supabase
      .from("shipment_items")
      .select("description, qty, unit_price_minor, tax_rate_pct")
      .eq("shipment_id", id)
      .order("position"),
    supabase.from("company_settings").select("default_currency").single(),
  ]);
  const exponent = currencyExponent(shipment.currency ?? company?.default_currency ?? "USD");
  const items = (rows ?? []).map((r) => ({
    description: r.description,
    qty: String(Number(r.qty)),
    unitPrice: (r.unit_price_minor / 10 ** exponent).toFixed(exponent),
    taxRatePct: String(Number(r.tax_rate_pct)),
  }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Edit shipment</h1>
      <ShipmentForm
        action={updateShipment.bind(null, id)}
        error={Array.isArray(error) ? error[0] : error}
        shipment={shipment}
        items={items}
      />
    </div>
  );
}
