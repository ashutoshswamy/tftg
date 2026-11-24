import { one } from "@/lib/relation";
import Link from "next/link";
import { StatCard } from "@ashutoshswamy/smoui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/card";
import {
  StatusBadge,
  StatusIcon,
  STATUS_META,
  type ShipmentStatus,
} from "@/components/status-diamond";

const ORDER = Object.keys(STATUS_META) as ShipmentStatus[];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function DashboardPage() {
  const supabase = createAdminClient();
  const user = await getCurrentUser();
  const today = new Date().toISOString().slice(0, 10);

  const [counts, { data: active }, { data: overdue }, { data: unassigned }, { data: activity }] =
    await Promise.all([
      Promise.all(
        ORDER.map((status) =>
          supabase
            .from("shipments")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
            .then(({ count }) => [status, count ?? 0] as const)
        )
      ),
      supabase
        .from("shipments")
        .select(
          "id, tracking_code, mode, status, updated_at, customer:customer_id(name), carrier:carrier_id(name)"
        )
        .not("status", "in", "(delivered,cancelled)")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("invoices")
        .select("id, number, due_date, currency, total_minor, customer:customer_id(name)")
        .eq("status", "sent")
        .lt("due_date", today)
        .order("due_date")
        .limit(5),
      supabase
        .from("shipments")
        .select("id, tracking_code, customer:customer_id(name)")
        .eq("status", "pending")
        .is("carrier_id", null)
        .order("created_at")
        .limit(5),
      supabase
        .from("status_events")
        .select("id, status, note, created_at, shipment:shipment_id(id, tracking_code)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const byStatus = Object.fromEntries(counts) as Record<ShipmentStatus, number>;
  const total = ORDER.reduce((n, s) => n + byStatus[s], 0);
  const attention = (overdue?.length ?? 0) + (unassigned?.length ?? 0);
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="page-title">Welcome back, {firstName}</h1>
        </div>
        <Link href="/shipments/new" className="btn btn-primary">
          New shipment
        </Link>
      </div>

      <section aria-label="Shipments by status" className="space-y-3">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ORDER.map((status) => (
            <li key={status}>
              <Link
                href={`/shipments?status=${status}`}
                aria-label={`${STATUS_META[status].label}: ${byStatus[status]}`}
                className="block rounded-xl"
              >
                <StatCard label={STATUS_META[status].label} value={byStatus[status]} />
              </Link>
            </li>
          ))}
        </ul>

        {total > 0 && (
          <div className="rounded-xl bg-panel p-4">
            <div
              className="flex h-3 overflow-hidden rounded-full bg-fill"
              role="img"
              aria-label={ORDER.map((s) => `${STATUS_META[s].label} ${byStatus[s]}`).join(", ")}
            >
              {ORDER.filter((s) => byStatus[s] > 0).map((s) => (
                <span
                  key={s}
                  style={{ width: `${(byStatus[s] / total) * 100}%`, background: STATUS_META[s].fg }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              {ORDER.map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_META[s].fg }} />
                  {STATUS_META[s].label} {Math.round((byStatus[s] / total) * 100)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title="Active shipments"
          description="Most recently updated first."
          action={
            <Link href="/shipments" className="btn btn-quiet min-h-9">
              All shipments
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {active?.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/shipments/${s.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-ground px-3 py-3 transition-colors hover:bg-brand-soft"
                >
                  <StatusIcon status={s.status} size={36} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="code text-sm text-brand-ink">{s.tracking_code}</p>
                    <p className="truncate text-sm text-muted">
                      {one(s.customer)?.name ?? "No customer"}
                    </p>
                  </div>
                  <div className="hidden min-w-0 basis-32 text-sm sm:block">
                    <p className="truncate capitalize">{s.mode}</p>
                    <p className="truncate text-muted">{one(s.carrier)?.name ?? "Unassigned"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={s.status} />
                    <time className="text-xs tabular-nums text-muted">{when(s.updated_at)}</time>
                  </div>
                </Link>
              </li>
            ))}
            {!active?.length && (
              <li className="py-4 text-sm text-muted">
                No active shipments. New ones appear here the moment they are created.
              </li>
            )}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card
            title="Needs attention"
            description={attention ? `${attention} item${attention === 1 ? "" : "s"} to look at` : "Nothing waiting"}
          >
            <ul className="space-y-1.5 text-sm">
              {overdue?.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-ground px-3 py-2.5 hover:bg-brand-soft"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">Invoice {inv.number} overdue</p>
                      <p className="truncate text-muted">
                        {one(inv.customer)?.name ?? "No customer"}, due {inv.due_date}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-cancelled">
                      {formatMoney(inv.total_minor, inv.currency)}
                    </span>
                  </Link>
                </li>
              ))}
              {unassigned?.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/shipments/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-ground px-3 py-2.5 hover:bg-brand-soft"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">Needs a carrier</p>
                      <p className="truncate text-muted">
                        <span className="code">{s.tracking_code}</span>, {one(s.customer)?.name ?? "No customer"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {!attention && (
                <li className="text-muted">No overdue invoices or unassigned shipments.</li>
              )}
            </ul>
          </Card>

          <Card title="Recent activity">
            <ol className="space-y-3">
              {activity?.map((e) => {
                const sh = one(e.shipment);
                return (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <StatusIcon status={e.status} size={28} />
                    <div className="min-w-0 flex-1">
                      <p>
                        {sh ? (
                          <Link
                            href={`/shipments/${sh.id}`}
                            className="code text-brand-ink hover:underline underline-offset-4"
                          >
                            {sh.tracking_code}
                          </Link>
                        ) : (
                          "Shipment"
                        )}{" "}
                        {STATUS_META[e.status as ShipmentStatus]?.label.toLowerCase() ?? e.status}
                      </p>
                      {e.note && <p className="truncate text-muted">{e.note}</p>}
                    </div>
                    <time className="text-xs tabular-nums text-muted">{when(e.created_at)}</time>
                  </li>
                );
              })}
              {!activity?.length && <li className="text-sm text-muted">No activity yet.</li>}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
