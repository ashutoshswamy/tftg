import { createAdminClient } from "@/lib/supabase/admin";
import { CountedTextarea } from "@ashutoshswamy/smoui";
import { PartySelect } from "@/components/party-select";
import { Segmented, SubmitButton, Input } from "@/components/ui";
import { Card } from "@/components/card";
import { FleetFields } from "@/components/fleet-fields";
import { OrderLines, type OrderLine } from "@/components/order-lines";
import { MODES } from "@/lib/validation";

type PartyOption = { id: string; name: string; roles: string[] };

type Shipment = {
  mode: string;
  customer_id: string | null;
  shipper_id: string | null;
  consignee_id: string | null;
  carrier_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  currency: string | null;
  notes: string | null;
  details: { reference?: string } | null;
};

export async function ShipmentForm({
  action,
  error,
  shipment,
  items = [],
}: {
  action: (formData: FormData) => void;
  error?: string;
  shipment?: Shipment;
  items?: OrderLine[];
}) {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("parties")
    .select("id, name, party_roles(role)")
    .eq("active", true)
    .order("name");

  const parties: PartyOption[] =
    rows?.map((p) => ({
      id: p.id,
      name: p.name,
      roles: p.party_roles.map((r) => r.role),
    })) ?? [];

  const byRole = (role: string) =>
    parties.filter((p) => p.roles.includes(role));

  const [{ data: drivers }, { data: vehicles }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, name, carrier_id")
      .eq("active", true)
      .order("name"),
    supabase
      .from("vehicles")
      .select("id, plate, type, carrier_id")
      .eq("active", true)
      .order("plate"),
  ]);

  const [{ data: company }, { data: taxRates }] = await Promise.all([
    supabase
      .from("company_settings")
      .select("default_tax_rate_id, prices_include_tax")
      .single(),
    supabase.from("tax_rates").select("id, rate_pct"),
  ]);
  const defaultTax = String(
    Number(
      taxRates?.find((t) => t.id === company?.default_tax_rate_id)?.rate_pct ??
        0,
    ),
  );

  // Optional parties and details stay folded unless this shipment already uses them.
  const extrasOpen = !!(
    shipment &&
    (shipment.shipper_id ||
      shipment.consignee_id ||
      shipment.currency ||
      shipment.notes ||
      shipment.details?.reference)
  );

  return (
    <form action={action} className="max-w-3xl space-y-6">
      {error && (
        <p className="message-error" role="alert">
          {error}
        </p>
      )}

      <Card>
        <div className="space-y-5">
          <PartySelect
            label="Customer"
            role="customer"
            name="customerId"
            options={byRole("customer")}
            defaultValue={shipment?.customer_id}
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Mode</p>
            <div className="overflow-x-auto">
              <Segmented
                name="mode"
                label="Mode"
                options={MODES.map((m) => ({ value: m, label: m }))}
                defaultValue={shipment?.mode ?? "road"}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Carrier and fleet"
        description="Your own driver and vehicle, or a third-party carrier's. Both are optional."
      >
        <FleetFields
          carriers={byRole("carrier").map((c) => ({ id: c.id, name: c.name }))}
          drivers={(drivers ?? []).map((d) => ({
            id: d.id,
            name: d.name,
            carrierId: d.carrier_id,
          }))}
          vehicles={(vehicles ?? []).map((v) => ({
            id: v.id,
            plate: v.plate ?? v.type,
            carrierId: v.carrier_id,
          }))}
          defaults={{
            carrierId: shipment?.carrier_id ?? null,
            driverId: shipment?.driver_id ?? null,
            vehicleId: shipment?.vehicle_id ?? null,
          }}
        />
      </Card>

      <Card
        title="Order"
        description="Enter moves to the next field. Enter on the last field adds a line."
      >
        <OrderLines
          initial={items}
          defaultTax={defaultTax}
          pricesIncludeTax={company?.prices_include_tax ?? false}
        >
          <SubmitButton full large>
            {shipment ? "Save changes" : "Create shipment"}
          </SubmitButton>
        </OrderLines>
      </Card>

      <details open={extrasOpen} className="group rounded-xl bg-panel">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl p-5 text-sm font-semibold sm:px-6">
          More parties and details
          <span className="text-muted group-open:hidden">
            Shipper, consignee, reference, notes
          </span>
        </summary>
        <div className="space-y-4 px-5 pb-6 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <PartySelect
              label="Shipper"
              role="shipper"
              name="shipperId"
              options={byRole("shipper")}
              defaultValue={shipment?.shipper_id}
            />
            <PartySelect
              label="Consignee"
              role="consignee"
              name="consigneeId"
              options={byRole("consignee")}
              defaultValue={shipment?.consignee_id}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Reference (PO / container / AWB no.)"
              name="reference"
              defaultValue={shipment?.details?.reference ?? ""}
            />
            <Input
              label="Currency override (3-letter code)"
              name="currency"
              maxLength={3}
              hint="Blank uses the company default"
              defaultValue={shipment?.currency ?? ""}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <CountedTextarea
            label="Notes"
            name="notes"
            rows={3}
            defaultValue={shipment?.notes ?? ""}
          />
        </div>
      </details>
    </form>
  );
}
