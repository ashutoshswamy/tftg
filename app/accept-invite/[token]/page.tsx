import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { AuthShell } from "@/components/auth-shell";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: invite } = await supabase
    .from("invites")
    .select("id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return (
      <AuthShell
        title="This invite is no longer valid"
        intro="The link is invalid, expired, or already used. Ask an admin to send a new one."
      >
        <Link href="/login" className="btn btn-secondary">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  const { userId } = await auth();
  const returnUrl = `/accept-invite/${token}`;

  if (!userId) {
    const redirectParam = `redirect_url=${encodeURIComponent(returnUrl)}`;
    return (
      <AuthShell
        title="Join the team"
        intro={`Invited as ${invite.role}. Use ${invite.email} to create an account or sign in.`}
      >
        <div className="flex flex-wrap gap-3">
          <Link href={`/signup?${redirectParam}`} className="btn btn-primary">
            Create account
          </Link>
          <Link href={`/login?${redirectParam}`} className="btn btn-secondary">
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  if (email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <AuthShell
        title="Wrong account"
        intro={`This invite is for ${invite.email}, but you are signed in as ${email}. Sign out and sign in with the invited email.`}
      >
        <Link href="/login" className="btn btn-secondary">
          Switch account
        </Link>
      </AuthShell>
    );
  }

  const { data: existing } = await supabase
    .from("memberships")
    .select("clerk_user_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("memberships").insert({
      clerk_user_id: userId,
      email: invite.email,
      full_name: user?.fullName || null,
      role: invite.role,
    });
    await supabase.from("invites").update({ status: "accepted" }).eq("id", invite.id);
  }

  redirect("/dashboard");
}
