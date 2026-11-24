import "server-only";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "dispatcher";
};

/**
 * Current signed-in staff member. Clerk only proves identity; membership
 * (and role) is our own data. Three outcomes for a signed-in user with no
 * membership row: company never set up yet → /create-company; company
 * exists but this person was never invited → /not-invited; otherwise a
 * membership exists and we return it.
 */
export async function getCurrentUser(): Promise<StaffUser> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("email, full_name, role")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!membership) {
    const { data: company } = await supabase
      .from("company_settings")
      .select("name")
      .single();

    redirect(company?.name ? "/not-invited" : "/create-company");
  }

  return {
    id: userId,
    email: membership.email,
    fullName: membership.full_name ?? membership.email,
    role: membership.role,
  };
}

/** Clerk identity only, no membership requirement — for /create-company. */
export async function requireSignedIn() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }
  const user = await currentUser();
  return {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    fullName: user?.fullName ?? user?.username ?? "",
  };
}

/** Staff member who must be an admin; dispatchers go back to the dashboard. */
export async function requireAdminUser(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
