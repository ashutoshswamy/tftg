import { Badge } from "@ashutoshswamy/smoui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createParty } from "@/lib/actions/parties";
import { PARTY_ROLES } from "@/lib/validation";
import { SubmitButton, CheckField, Input } from "@/components/ui";

const SECTION_TITLES: Record<(typeof PARTY_ROLES)[number], string> = {
  customer: "Customers",
  shipper: "Shippers",
  consignee: "Consignees",
  carrier: "Carriers",
  supplier: "Suppliers",
  agent: "Agents",
  notify_party: "Notify parties",
};

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const supabase = createAdminClient();

  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, email, phone, party_roles(role)")
    .eq("active", true)
    .order("name");

  const errorMessage = Array.isArray(error) ? error[0] : error;

  // One section per role, only where someone plays it. A party with several
  // roles appears under each, with its other roles as badges.
  const sections = PARTY_ROLES.map((role) => ({
    role,
    title: SECTION_TITLES[role],
    items: (parties ?? []).filter((p) => p.party_roles.some((r) => r.role === role)),
  })).filter((sec) => sec.items.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Directory</h1>
        <p className="mt-1 text-sm text-muted">
          Customers, shippers, consignees, carriers and suppliers. Create once, reuse on
          every shipment.
        </p>
      </div>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <nav aria-label="Directory sections" className="flex flex-wrap gap-2">
            {sections.map((sec) => (
              <a
                key={sec.role}
                href={`#${sec.role}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-fill px-3 text-sm font-medium hover:bg-fill-strong"
              >
                {sec.title}
                <span className="tabular-nums text-muted">{sec.items.length}</span>
              </a>
            ))}
          </nav>

          {sections.map((sec) => (
            <section key={sec.role} id={sec.role} className="scroll-mt-6">
              <Card title={sec.title} description={`${sec.items.length} in the directory`}>
                <ul className="space-y-1.5">
                  {sec.items.map((party) => (
                    <li
                      key={party.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg bg-ground px-3 py-2.5"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-9 flex-none items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink"
                      >
                        {party.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm font-semibold">{party.name}</p>
                        <p className="truncate text-sm text-muted">
                          {[party.email, party.phone].filter(Boolean).join(", ") ||
                            "No contact details"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {party.party_roles
                          .filter((r) => r.role !== sec.role)
                          .map((r) => (
                            <Badge key={r.role} size="sm">
                              {r.role.replace("_", " ")}
                            </Badge>
                          ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}

          {!sections.length && (
            <Card title="Directory">
              <p className="text-sm text-muted">
                No parties yet. Add the first one with the form.
              </p>
            </Card>
          )}
        </div>

        <Card title="Add a party" description="Pick every role this party plays.">
          <form action={createParty} className="space-y-4">
            <Input label="Name" name="name" required />

            <fieldset className="space-y-2">
              <legend className="text-sm">Roles</legend>
              <div className="grid grid-cols-2 gap-2">
                {PARTY_ROLES.map((role) => (
                  <CheckField key={role} name="roles" value={role}>
                    {role.replace("_", " ")}
                  </CheckField>
                ))}
              </div>
            </fieldset>

            <Input label="Email" name="email" type="email" />
            <Input label="Phone" name="phone" />

            <SubmitButton full>Add party</SubmitButton>
          </form>
        </Card>
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
