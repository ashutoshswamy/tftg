import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Driver page posts here every 15-30s while a shipment is in transit.
// Authorized by the driver_token itself — no staff session involved.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid ping" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, status, tokens_expire_at")
    .eq("driver_token", token)
    .maybeSingle();

  if (!shipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (shipment.tokens_expire_at && new Date(shipment.tokens_expire_at) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (["delivered", "cancelled"].includes(shipment.status)) {
    return NextResponse.json({ error: "Shipment closed" }, { status: 409 });
  }

  const speed = Number(body?.speed);
  const heading = Number(body?.heading);
  const accuracy = Number(body?.accuracy);

  await supabase.from("location_pings").insert({
    shipment_id: shipment.id,
    lat,
    lng,
    speed: Number.isFinite(speed) ? speed : null,
    heading: Number.isFinite(heading) ? heading : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
  });

  return NextResponse.json({ ok: true });
}
