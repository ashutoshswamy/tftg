import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDriverStatusWithPhoto } from "@/lib/actions/driver";
import { PhotoStatusButton } from "@/components/photo-status-button";
import { DriverLocationPinger } from "@/components/driver-location-pinger";
import { Card } from "@/components/card";
import { PublicShell } from "@/components/public-shell";
import {
  STATUS_META,
  StatusIcon,
  isShipmentStatus,
} from "@/components/status-diamond";

export default async function DriverPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, tracking_code, status, tokens_expire_at")
    .eq("driver_token", token)
    .maybeSingle();

  if (!shipment || isExpired(shipment.tokens_expire_at)) {
    notFound();
  }

  const [{ data: stops }, { data: documents }] = await Promise.all([
    supabase
      .from("stops")
      .select("sequence, kind, address_snapshot, scheduled_at, arrived_at")
      .eq("shipment_id", shipment.id)
      .order("sequence"),
    supabase
      .from("documents")
      .select("id, created_at")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false }),
  ]);

  const closed = ["delivered", "cancelled"].includes(shipment.status);
  const errorMessage = Array.isArray(error) ? error[0] : error;

  const next = stops?.find((st) => !st.arrived_at) ?? null;

  return (
    <PublicShell width="max-w-md">
      <div className={`space-y-4 ${closed ? "" : "pb-28"}`}>
        <Card>
          <div className="flex items-center gap-4">
            <StatusIcon status={shipment.status} size={56} />
            <div>
              <h1 className="code text-2xl leading-none">{shipment.tracking_code}</h1>
              <p className="mt-1.5 text-lg font-semibold">
                {isShipmentStatus(shipment.status)
                  ? STATUS_META[shipment.status].label
                  : shipment.status}
              </p>
            </div>
          </div>

          {next && !closed && (
            <div className="rounded-lg bg-brand-soft p-4">
              <p className="text-xs text-brand-ink">Next stop</p>
              <p className="text-lg font-semibold capitalize">{next.kind.replace("_", " ")}</p>
              <p className="text-sm">{next.address_snapshot}</p>
            </div>
          )}

          {!closed && <DriverLocationPinger token={token} />}
        </Card>

        {errorMessage && (
          <p className="message-error" role="alert">
            {errorMessage}
          </p>
        )}

        <p className="px-1 text-sm text-muted">
          {documents?.length
            ? `${documents.length} photo(s) uploaded, last at ${new Date(documents[0].created_at).toLocaleString()}.`
            : "A photo is taken when you mark picked up and delivered."}
        </p>

        <Card title="Stops">
          <ol className="space-y-1.5">
            {stops?.map((stop, i) => (
              <li key={i} className="rounded-lg bg-ground px-3 py-3">
                <p className="text-sm font-semibold capitalize">
                  {stop.kind.replace("_", " ")}
                </p>
                <p className="text-sm text-muted">{stop.address_snapshot}</p>
              </li>
            ))}
            {!stops?.length && (
              <li className="text-sm text-muted">No stops recorded yet.</li>
            )}
          </ol>
        </Card>
      </div>

      {/* Thumb-reach bar: the two things a driver does most, always visible. */}
      {!closed && (
        <div className="fixed inset-x-0 bottom-0 bg-panel px-4 py-3 shadow-[0_-8px_24px_rgba(15,27,51,0.08)]">
          <div className="mx-auto max-w-md space-y-2">
          <p className="text-center text-xs text-muted">A photo is required to mark picked up or delivered.</p>
          <div className="grid grid-cols-2 gap-3">
            <PhotoStatusButton
              action={updateDriverStatusWithPhoto.bind(null, token)}
              status="in_transit"
              label="Picked up"
            />
            <PhotoStatusButton
              action={updateDriverStatusWithPhoto.bind(null, token)}
              status="delivered"
              label="Delivered"
              primary
            />
          </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

function isExpired(tokensExpireAt: string | null) {
  return Boolean(tokensExpireAt && new Date(tokensExpireAt) < new Date());
}
