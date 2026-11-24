import { one } from "@/lib/relation";
import Link from "next/link";
import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@ashutoshswamy/smoui";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addStop,
  regenerateToken,
  updateShipmentStatus,
} from "@/lib/actions/shipments";
import { createDraftInvoice } from "@/lib/actions/invoices";
import { Card } from "@/components/card";
import { CopyLink } from "@/components/copy-link";
import { ProgressSteps } from "@/components/progress-steps";
import { StatusBadge } from "@/components/status-diamond";
import { TrackingMap, type MapStop } from "@/components/tracking-map";
import { STATUSES } from "@/lib/validation";
import {
  STATUS_META,
  StatusIcon,
  isShipmentStatus,
} from "@/components/status-diamond";
import { SubmitButton, Select, Input } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export default async function ShipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = Array.isArray(error) ? error[0] : error;
  const supabase = createAdminClient();

  const [{ data: shipment }, { data: stops }, { data: events }, { data: invoices }, { data: pings }, { data: order }, { data: company }] =
    await Promise.all([
      supabase
        .from("shipments")
        .select(
          `id, tracking_code, currency, customer_token, driver_token, mode, status, notes, details,
           customer:customer_id(name), shipper:shipper_id(name),
           consignee:consignee_id(name), carrier:carrier_id(name),
           driver:driver_id(name, phone), vehicle:vehicle_id(plate, type)`
        )
        .eq("id", id)
        .single(),
      supabase
        .from("stops")
        .select("id, sequence, kind, address_snapshot, scheduled_at, location:location_id(lat, lng)")
        .eq("shipment_id", id)
        .order("sequence"),
      supabase
        .from("status_events")
        .select("id, status, note, created_at")
        .eq("shipment_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, number, status")
        .eq("shipment_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("location_pings")
        .select("lat, lng, recorded_at")
        .eq("shipment_id", id)
        .order("recorded_at", { ascending: false })
        .limit(100),
      supabase
        .from("shipment_items")
        .select("id, description, qty, unit_price_minor, tax_rate_pct")
        .eq("shipment_id", id)
        .order("position"),
      supabase.from("company_settings").select("default_currency").single(),
    ]);

  if (!shipment) notFound();

  const trail = [...(pings ?? [])].reverse();
  const mapStops: MapStop[] = (stops ?? []).flatMap((st) => {
    const loc = one(st.location);
    return loc?.lat != null && loc?.lng != null
      ? [{ kind: st.kind, label: st.address_snapshot ?? st.kind, lat: loc.lat, lng: loc.lng }]
      : [];
  });

  const first = stops?.[0]?.address_snapshot;
  const last = stops && stops.length > 1 ? stops[stops.length - 1].address_snapshot : null;

  const parties = [
    ["Customer", one(shipment.customer)?.name],
    ["Shipper", one(shipment.shipper)?.name],
    ["Consignee", one(shipment.consignee)?.name],
    ["Carrier", one(shipment.carrier)?.name],
    ["Driver", [one(shipment.driver)?.name, one(shipment.driver)?.phone].filter(Boolean).join(", ")],
    ["Vehicle", one(shipment.vehicle)?.plate ?? one(shipment.vehicle)?.type],
  ] as const;

  const links = [
    {
      label: "Public tracking",
      hint: "Customer enters the tracking code",
      path: `/track?code=${shipment.tracking_code}`,
      Icon: MagnifyingGlassIcon,
    },
    {
      label: "Customer link",
      hint: "Live status and map, no code needed",
      path: `/t/${shipment.customer_token}`,
      Icon: UserIcon,
      regenerate: regenerateToken.bind(null, id, "customer"),
    },
    {
      label: "Driver link",
      hint: "Status buttons, location and proof of delivery",
      path: `/d/${shipment.driver_token}`,
      Icon: TruckIcon,
      regenerate: regenerateToken.bind(null, id, "driver"),
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/shipments" className="text-sm text-muted hover:text-ink">
        All shipments
      </Link>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <StatusIcon status={shipment.status} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="code text-2xl leading-none sm:text-3xl">
                {shipment.tracking_code}
              </h1>
              <StatusBadge status={shipment.status} />
              <Badge size="sm">{shipment.mode}</Badge>
            </div>
            {first && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="truncate">{first}</span>
                {last && (
                  <>
                    <ArrowRightIcon className="size-4 flex-none" aria-hidden="true" />
                    <span className="truncate">{last}</span>
                  </>
                )}
              </p>
            )}
          </div>
          <Link href={`/shipments/${id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
        </div>
        <div className="pt-2">
          <ProgressSteps status={shipment.status} />
        </div>
      </Card>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {(trail.length > 0 || mapStops.length > 0) && (
            <Card title="Live map">
              <TrackingMap token={shipment.customer_token} initialTrail={trail} stops={mapStops} />
            </Card>
          )}

          <Card title="Stops" description="Pickup, transit hubs and drop-off in order.">
            <ol className="space-y-1.5">
              {stops?.map((stop) => (
                <li
                  key={stop.id}
                  className="flex items-start gap-3 rounded-lg bg-ground px-3 py-3 text-sm"
                >
                  <span className="flex size-7 flex-none items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
                    {stop.sequence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold capitalize">{stop.kind.replace("_", " ")}</p>
                    <p className="text-muted">{stop.address_snapshot}</p>
                  </div>
                  {stop.scheduled_at && (
                    <time className="text-xs tabular-nums text-muted">
                      {new Date(stop.scheduled_at).toLocaleString()}
                    </time>
                  )}
                </li>
              ))}
              {!stops?.length && (
                <li className="text-sm text-muted">
                  No stops yet. Add the pickup and drop-off below.
                </li>
              )}
            </ol>

            <form
              action={addStop.bind(null, id)}
              className="grid gap-3 sm:grid-cols-2 sm:items-end"
            >
              <Select
                name="kind"
                label="Type"
                defaultValue="pickup"
                options={[
                  { value: "pickup", label: "Pickup" },
                  { value: "dropoff", label: "Drop-off" },
                  { value: "transit_hub", label: "Transit hub" },
                  { value: "stop", label: "Stop" },
                ]}
              />
              <div className="sm:col-span-2">
                <Input label="Address" name="address" required />
              </div>
              <div className="native-field">
                <label htmlFor="scheduledAt">Scheduled</label>
                <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="field" />
              </div>
              <SubmitButton tone="secondary" large>Add stop</SubmitButton>
            </form>
          </Card>

          <Card title="Status" description="Staff notes are never shown to customers or drivers.">
            <form
              action={updateShipmentStatus.bind(null, id)}
              className="flex flex-wrap items-end gap-3"
            >
              <Select
                className="min-w-0! w-60"
                name="status"
                label="New status"
                defaultValue={shipment.status}
                options={STATUSES.map((st) => ({
                  value: st,
                  label: isShipmentStatus(st) ? STATUS_META[st].label : st,
                }))}
              />
              <Input className="min-w-0! w-72 max-w-full" label="Note" name="note" />
              <SubmitButton large>Update status</SubmitButton>
            </form>

            <ol className="space-y-1.5">
              {events?.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ground px-3 py-2.5 text-sm"
                >
                  <StatusIcon status={e.status} size={24} />
                  <span className="font-semibold">
                    {isShipmentStatus(e.status) ? STATUS_META[e.status].label : e.status}
                  </span>
                  {e.note && <span className="text-muted">{e.note}</span>}
                  <time className="ml-auto text-xs tabular-nums text-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
              {!events?.length && (
                <li className="text-sm text-muted">No status changes recorded yet.</li>
              )}
            </ol>
          </Card>

          <Card
            title="Order"
            description="Billed as written here. Creating an invoice only asks you to confirm it."
            action={
              <Link href={`/shipments/${id}/edit`} className="btn btn-secondary min-h-9">
                Edit order
              </Link>
            }
          >
            <ul className="space-y-1.5 text-sm">
              {order?.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-ground px-3 py-2.5"
                >
                  <span className="min-w-0 truncate">
                    {o.description}
                    <span className="text-muted"> x {Number(o.qty)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(
                      Math.round(Number(o.qty) * o.unit_price_minor),
                      shipment.currency ?? company?.default_currency ?? "USD"
                    )}
                  </span>
                </li>
              ))}
              {!order?.length && (
                <li className="text-muted">No order lines yet. Add them with Edit order.</li>
              )}
            </ul>
          </Card>

          <Card
            title="Invoices"
            action={
              <form action={createDraftInvoice.bind(null, id)}>
                <SubmitButton tone="secondary" small>Create invoice</SubmitButton>
              </form>
            }
          >
            <ul className="space-y-1.5 text-sm">
              {invoices?.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg bg-ground px-3 py-2.5"
                >
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="code text-brand-ink hover:underline underline-offset-4"
                  >
                    {inv.number ?? "Draft"}
                  </Link>
                  <Badge size="sm">{inv.status}</Badge>
                </li>
              ))}
              {!invoices?.length && (
                <li className="text-muted">No invoices for this shipment.</li>
              )}
            </ul>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Details">
            <dl className="space-y-3 text-sm">
              {parties.map(([label, value]) => (
                <Field key={label} label={label} value={value} />
              ))}
              <Field label="Reference" value={shipment.details?.reference} />
              {shipment.notes && <Field label="Notes" value={shipment.notes} />}
            </dl>
          </Card>

          <Card title="Tracking links" description="Share these. Regenerating a link kills the old one.">
            <ul className="space-y-2">
              {links.map(({ label, hint, path, Icon, regenerate }) => (
                <li key={label} className="space-y-2 rounded-lg bg-ground p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted">{hint}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyLink path={path} />
                    <a
                      href={path}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary min-h-9"
                    >
                      Open
                    </a>
                    {regenerate && (
                      <form action={regenerate} className="ml-auto">
                        <SubmitButton tone="quiet" small>Regenerate</SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value ?? "Not set"}</dd>
    </div>
  );
}
