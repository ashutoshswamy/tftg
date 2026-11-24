"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/organization?error=Only admins can manage the team");
  }
  return user;
}

export async function createInvite(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "dispatcher");

  if (!email || !["admin", "dispatcher"].includes(role)) {
    redirect("/organization?error=Invalid invite");
  }

  const supabase = createAdminClient();

  // One live invite per email: revoke any earlier pending one first,
  // rather than juggling several tokens for the same person.
  await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("email", email)
    .eq("status", "pending");

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ email, role, invited_by: admin.id })
    .select("id, token")
    .single();

  if (error || !invite) {
    redirect(`/organization?error=${encodeURIComponent(error?.message ?? "Could not create invite")}`);
  }

  // Clerk emails the invitation. Its link opens our sign-up page with a
  // ticket, then /accept-invite/[token] turns the account into a member.
  // ponytail: revoking in the app does not cancel the Clerk email; the
  // accept page rejects a revoked token anyway.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: email,
      ignoreExisting: true,
      redirectUrl: `${origin}/signup?redirect_url=${encodeURIComponent(`/accept-invite/${invite.token}`)}`,
    });
  } catch (e) {
    await supabase.from("invites").update({ status: "revoked" }).eq("id", invite.id);
    const msg = e instanceof Error ? e.message : "Could not send the invitation email";
    redirect(`/organization?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/organization");
}

export async function revokeInvite(inviteId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("invites").update({ status: "revoked" }).eq("id", inviteId);
  revalidatePath("/organization");
}

export async function removeMember(clerkUserId: string) {
  const admin = await requireAdmin();
  if (clerkUserId === admin.id) {
    redirect("/organization?error=You can't remove yourself");
  }
  const supabase = createAdminClient();
  await supabase.from("memberships").delete().eq("clerk_user_id", clerkUserId);
  revalidatePath("/organization");
}
