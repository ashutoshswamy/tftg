import { one } from "@/lib/relation";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackingMap, type MapStop } from "@/components/tracking-map";
import { ArrowRightIcon, CheckIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/card";
import { ProgressSteps } from "@/components/progress-steps";
import { PublicShell } from "@/components/public-shell";
import {
  STATUS_META,
  StatusIcon,
  isShipmentStatus,
} from "@/components/status-diamond";

const label = (status: string) =>
  isShipmentStatus(status) ? STATUS_META[status].label : status.replace("_", " ");

export default async function CustomerTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, tracking_code, mode, status, tokens_expire_at")
    .eq("customer_token", token)
    .maybeSingle();

  if (!shipment || isExpired(shipment.tokens_expire_at)) {
    notFound();
  }

  const [{ data: stops }, { data: events }, { data: recentPings }] = await Promise.all([
    supabase
      .from("stops")
      .select(
        "sequence, kind, address_snapshot, scheduled_at, arrived_at, departed_at, location:location_id(lat, lng)"
      )
      .eq("shipment_id", shipment.id)
      .order("sequence"),
    // Public view: status + timestamp only. Staff notes on status_events
    // can carry internal comments, so they never reach this page.
    supabase
      .from("status_events")
      .select("status, created_at")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("location_pings")
      .select("lat, lng, recorded_at")
      .eq("shipment_id", shipment.id)
      .order("recorded_at", { ascending: false })
      .limit(100),
  ]);

  const trail = [...(recentPings ?? [])].reverse();
  const mapStops: MapStop[] = (stops ?? []).flatMap((st) => {
    const loc = one(st.location);
    return loc?.lat != null && loc?.lng != null
      ? [{ kind: st.kind, label: st.address_snapshot ?? st.kind, lat: loc.lat, lng: loc.lng }]
      : [];
  });
  const showMap = !["pending", "delivered", "cancelled"].includes(shipment.status);

  const first = stops?.[0]?.address_snapshot;
  const last = stops && stops.length > 1 ? stops[stops.length - 1].address_snapshot : null;

  const routeCard = (
    <Card title="Route">
      <ol>
        {stops?.map((stop, i) => {
          const done = Boolean(stop.arrived_at);
          return (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < stops.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-0.5 ${done ? "bg-brand" : "bg-line"}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex size-7 flex-none items-center justify-center rounded-full ${done ? "bg-brand text-ink" : "bg-fill text-muted"}`}
              >
                {done ? <CheckIcon className="size-4" /> : <MapPinIcon className="size-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize">
                  {stop.kind.replace("_", " ")}
                  {done && <span className="font-normal text-muted">, arrived</span>}
                </p>
                <p className="text-sm">{stop.address_snapshot}</p>
                {stop.scheduled_at && (
                  <p className="text-xs text-muted">
                    Scheduled {new Date(stop.scheduled_at).toLocaleString()}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {!stops?.length && (
          <li className="text-sm text-muted">The route has not been set yet.</li>
        )}
      </ol>
    </Card>
  );

  const historyCard = (
    <Card title="History">
      <ul className="space-y-1.5">
        {events?.map((e, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ground px-3 py-2.5 text-sm"
          >
            <StatusIcon status={e.status} size={24} />
            <span className="font-semibold">{label(e.status)}</span>
            <time className="ml-auto text-xs tabular-nums text-muted">
              {new Date(e.created_at).toLocaleString()}
            </time>
          </li>
        ))}
        {!events?.length && <li className="text-sm text-muted">No updates yet.</li>}
      </ul>
    </Card>
  );

  return (
    <PublicShell width="max-w-6xl">
      <div className="space-y-4">
        {/* Status band: who/what on the left, progress on the right. */}
        <Card>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <StatusIcon status={shipment.status} size={64} />
                <div className="min-w-0">
                  <p className="text-sm capitalize text-muted">{shipment.mode} shipment</p>
                  <h1 className="text-3xl font-bold leading-tight">{label(shipment.status)}</h1>
                  <p className="code text-sm text-muted">{shipment.tracking_code}</p>
                </div>
              </div>
              {first && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold">{first}</span>
                  {last && (
                    <>
                      <ArrowRightIcon className="size-4 text-muted" aria-hidden="true" />
                      <span className="font-semibold">{last}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <ProgressSteps status={shipment.status} />
          </div>
        </Card>

        {showMap ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-4">
              <Card title="Live location">
                <TrackingMap
                  token={token}
                  initialTrail={trail}
                  stops={mapStops}
                  heightClass="h-80 sm:h-[28rem] lg:h-[34rem]"
                />
              </Card>
            </div>
            <div className="space-y-4">
              {routeCard}
              {historyCard}
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {routeCard}
            {historyCard}
          </div>
        )}
      </div>
    </PublicShell>
  );
}

function isExpired(tokensExpireAt: string | null) {
  return Boolean(tokensExpireAt && new Date(tokensExpireAt) < new Date());
}
