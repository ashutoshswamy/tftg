"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// ponytail: no rate limiter here — there's no infra for one yet (no Redis/
// KV). The code space (31^6 ≈ 887M) makes blind brute force impractical at
// this traffic level. Add a limiter (e.g. Upstash) if abuse shows up.
export async function lookupTrackingCode(formData: FormData) {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  if (!code) {
    redirect("/track?error=Enter a tracking code");
  }

  const supabase = createAdminClient();
  const { data: shipment } = await supabase
    .from("shipments")
    .select("customer_token")
    .eq("tracking_code", code)
    .maybeSingle();

  if (!shipment) {
    redirect(`/track?error=${encodeURIComponent("No shipment found for that code")}`);
  }

  redirect(`/t/${shipment.customer_token}`);
}
