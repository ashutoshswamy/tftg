import Link from "next/link";
import { Badge } from "@ashutoshswamy/smoui";
import { Card } from "@/components/card";
import { Input, Select, SubmitButton } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDriver, createVehicle } from "@/lib/actions/fleet";
import { one } from "@/lib/relation";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "own", label: "Own fleet" },
  { id: "third", label: "Third-party" },
] as const;

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string | string[] }>;
}) {
  const { view: rawView, error } = await searchParams;
  const view = VIEWS.some((v) => v.id === rawView) ? rawView! : "all";
  const errorMessage = Array.isArray(error) ? error[0] : error;
  const supabase = createAdminClient();

  const [{ data: drivers }, { data: vehicles }, { data: carriers }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, name, phone, license_no, carrier:carrier_id(name)")
      .eq("active", true)
      .order("name"),
    supabase
      .from("vehicles")
      .select("id, type, plate, capacity, carrier:carrier_id(name)")
      .eq("active", true)
      .order("plate"),
    supabase
      .from("parties")
      .select("id, name, party_roles!inner(role)")
      .eq("party_roles.role", "carrier")
      .eq("active", true)
      .order("name"),
  ]);

  const keep = <T extends { carrier: unknown }>(r: T) =>
    view === "all" || (view === "own") === !one(r.carrier as { name: string } | null);
  const shownDrivers = (drivers ?? []).filter(keep);
  const shownVehicles = (vehicles ?? []).filter(keep);

  const owners = [
    { value: "", label: "Own fleet" },
    ...(carriers ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const ownerBadge = (carrier: unknown) => {
    const name = one(carrier as { name: string } | null)?.name;
    return <Badge size="sm" tone={name ? "neutral" : "accent"}>{name ?? "Own fleet"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Fleet</h1>
        <p className="mt-1 text-sm text-muted">
          Your own drivers and vehicles, and those that belong to third-party carriers.
          Pick them on a shipment.
        </p>
      </div>

      {errorMessage && (
        <p className="message-error" role="alert">
          {errorMessage}
        </p>
      )}

      <nav aria-label="Fleet view" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={v.id === "all" ? "/fleet" : `/fleet?view=${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium ${
              view === v.id ? "bg-brand-soft text-brand-ink" : "bg-fill hover:bg-fill-strong"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title="Drivers" description={`${shownDrivers.length} shown`}>
            <ul className="space-y-1.5">
              {shownDrivers.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-ground px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold">{d.name}</p>
                    <p className="truncate text-sm text-muted">
                      {[d.phone, d.license_no && `Licence ${d.license_no}`]
                        .filter(Boolean)
                        .join(", ") || "No contact details"}
                    </p>
                  </div>
                  {ownerBadge(d.carrier)}
                </li>
              ))}
              {!shownDrivers.length && (
                <li className="text-sm text-muted">No drivers here yet. Add one with the form.</li>
              )}
            </ul>
          </Card>

          <Card title="Vehicles" description={`${shownVehicles.length} shown`}>
            <ul className="space-y-1.5">
              {shownVehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-ground px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="code truncate text-sm font-semibold">{v.plate ?? "No plate"}</p>
                    <p className="truncate text-sm capitalize text-muted">
                      {[v.type.replace("_", " "), v.capacity].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  {ownerBadge(v.carrier)}
                </li>
              ))}
              {!shownVehicles.length && (
                <li className="text-sm text-muted">No vehicles here yet. Add one with the form.</li>
              )}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Add a driver">
            <form action={createDriver} className="space-y-4">
              <Input label="Name" name="name" required />
              <Input label="Phone" name="phone" type="tel" />
              <Input label="Licence number" name="licenseNo" />
              <Select name="ownerId" label="Belongs to" options={owners} defaultValue="" />
              <SubmitButton full>Add driver</SubmitButton>
            </form>
          </Card>

          <Card title="Add a vehicle">
            <form action={createVehicle} className="space-y-4">
              <Input label="Plate or vehicle number" name="plate" required />
              <Select
                name="type"
                label="Type"
                defaultValue="truck"
                options={[
                  { value: "truck", label: "Truck" },
                  { value: "van", label: "Van" },
                  { value: "rail_car", label: "Rail car" },
                  { value: "container", label: "Container" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Input label="Capacity (optional)" name="capacity" />
              <Select name="ownerId" label="Belongs to" options={owners} defaultValue="" />
              <SubmitButton full>Add vehicle</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
