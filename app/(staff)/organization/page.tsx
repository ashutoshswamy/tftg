import { Badge } from "@ashutoshswamy/smoui";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvite, removeMember, revokeInvite } from "@/lib/actions/invites";
import { SubmitButton, Select, Input } from "@/components/ui";

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("memberships")
      .select("clerk_user_id, email, full_name, role")
      .order("created_at"),
    user.role === "admin"
      ? supabase
          .from("invites")
          .select("id, email, role, token, status")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const errorMessage = Array.isArray(error) ? error[0] : error;

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Organization</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone with access to Too Far To Go.{" "}
          {isAdmin
            ? "Invite teammates by email and choose their role."
            : "Only admins can invite or remove people."}
        </p>
      </div>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Members" description={`${members?.length ?? 0} with access`}>
          <ul className="space-y-1.5">
            {members?.map((m) => {
              const name = m.full_name || m.email;
              return (
                <li
                  key={m.clerk_user_id}
                  className="flex items-center gap-3 rounded-lg bg-ground px-3 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 flex-none items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink"
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="truncate text-sm text-muted">{m.email}</p>
                  </div>
                  <Badge tone={m.role === "admin" ? "accent" : "neutral"} size="sm">
                    {m.role}
                  </Badge>
                  {isAdmin && m.clerk_user_id !== user.id && (
                    <form action={removeMember.bind(null, m.clerk_user_id)}>
                      <SubmitButton tone="danger" small>Remove</SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {isAdmin && (
          <div className="space-y-6">
            <Card title="Invite someone" description="They get an email with a sign-up link.">
              <form action={createInvite} className="space-y-3">
                <Input label="Email" name="email" type="email" required />
                <Select
                  name="role"
                  label="Role"
                  defaultValue="dispatcher"
                  options={[
                    { value: "dispatcher", label: "Dispatcher" },
                    { value: "admin", label: "Admin" },
                  ]}
                />
                <SubmitButton full>Send invite</SubmitButton>
              </form>
            </Card>

            <Card title="Pending invites" description={`${invites?.length ?? 0} waiting`}>
              <ul className="space-y-1.5 text-sm">
                {invites?.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-2 rounded-lg bg-ground px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{inv.email}</p>
                      <a
                        href={`/accept-invite/${inv.token}`}
                        className="text-xs text-brand-ink hover:underline"
                      >
                        Open invite link
                      </a>
                    </div>
                    <Badge size="sm">{inv.role}</Badge>
                    <form action={revokeInvite.bind(null, inv.id)}>
                      <SubmitButton tone="quiet" small>Revoke</SubmitButton>
                    </form>
                  </li>
                ))}
                {!invites?.length && <li className="text-muted">No pending invites.</li>}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-panel p-5 sm:p-6">
      <header>
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      {children}
    </section>
  );
}
