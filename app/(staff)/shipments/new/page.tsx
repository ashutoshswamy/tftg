import { ShipmentForm } from "@/components/shipment-form";
import { createShipment } from "@/lib/actions/shipments";

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">New shipment</h1>
        <p className="mt-1 text-sm text-muted">
          Parties and the order go in once here. Invoicing later only asks you to confirm.
        </p>
      </div>
      <ShipmentForm
        action={createShipment}
        error={Array.isArray(error) ? error[0] : error}
      />
    </div>
  );
}
