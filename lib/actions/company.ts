"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSignedIn } from "@/lib/auth";

/**
 * The person who fills this in first becomes the one admin. Guarded twice:
 * the company_settings row can only be named once (checked here), and a
 * signed-in user who already has a membership has no reason to be on this
 * page (also checked here, redirect to /dashboard instead of double-admin).
 */
export async function createCompany(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/create-company?error=Enter a company name");
  }

  const user = await requireSignedIn();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("company_settings")
    .select("name")
    .single();
  if (existing?.name) {
    redirect("/dashboard");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("clerk_user_id")
    .eq("clerk_user_id", user.id)
    .maybeSingle();
  if (membership) {
    redirect("/dashboard");
  }

  await supabase.from("company_settings").update({ name }).eq("id", true);
  await supabase.from("memberships").insert({
    clerk_user_id: user.id,
    email: user.email,
    full_name: user.fullName || null,
    role: "admin",
  });

  redirect("/dashboard");
}
