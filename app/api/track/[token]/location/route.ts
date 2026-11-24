import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Polled by the customer tracking page. Scoped to the customer_token, not
// the driver_token — a customer link can read position, never write it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: shipment } = await supabase
    .from("shipments")
    .select("id")
    .eq("customer_token", token)
    .maybeSingle();

  if (!shipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Last 100 pings, oldest first: the path driven so far. The newest is the
  // current position.
  const { data: recent } = await supabase
    .from("location_pings")
    .select("lat, lng, recorded_at")
    .eq("shipment_id", shipment.id)
    .order("recorded_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ trail: (recent ?? []).reverse() });
}
