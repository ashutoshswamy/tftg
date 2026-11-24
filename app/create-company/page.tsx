import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { SubmitButton, Input } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSignedIn } from "@/lib/auth";
import { createCompany } from "@/lib/actions/company";

export default async function CreateCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await requireSignedIn();
  const supabase = createAdminClient();

  const [{ data: company }, { data: membership }] = await Promise.all([
    supabase.from("company_settings").select("name").single(),
    supabase
      .from("memberships")
      .select("clerk_user_id")
      .eq("clerk_user_id", user.id)
      .maybeSingle(),
  ]);

  // Already set up, or this user is already a member: nothing to do here.
  if (company?.name || membership) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Set up your company"
      intro="You become the admin. Invite your team from Organization once you are in."
    >
      <form action={createCompany} className="space-y-4">
        {error && (
          <p className="message-error" role="alert">
            {Array.isArray(error) ? error[0] : error}
          </p>
        )}

        <Input label="Company name" name="name" required autoFocus />

        <SubmitButton full>Create company</SubmitButton>
      </form>
    </AuthShell>
  );
}
