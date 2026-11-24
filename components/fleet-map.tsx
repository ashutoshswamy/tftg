"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlagIcon, TruckIcon } from "@heroicons/react/24/solid";
import { SegmentedControl } from "@ashutoshswamy/smoui";
import { StatusBadge } from "@/components/status-diamond";
import "leaflet/dist/leaflet.css";

export type FleetPoint = {
  id: string;
  code: string;
  status: "assigned" | "in_transit";
  party: string;
  carrier: string;
  lat: number;
  lng: number;
  recordedAt: string;
  dest: { lat: number; lng: number; label: string } | null;
};

const COLORS = {
  in_transit: { bg: "#ff7a00", fg: "#0d1829" },
  assigned: { bg: "#1d4ed8", fg: "#ffffff" },
} as const;
const STALE_MS = 15 * 60_000;

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ago(iso: string) {
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

const truck = (p: FleetPoint, active: boolean) => {
  const size = active ? 48 : 38;
  const c = COLORS[p.status];
  const stale = Date.now() - new Date(p.recordedAt).getTime() > STALE_MS;
  return renderToStaticMarkup(
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        opacity: stale && !active ? 0.55 : 1,
        border: "3px solid #ffffff",
        boxShadow: "0 2px 8px rgba(13,24,41,.35)",
      }}
    >
      <TruckIcon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>,
  );
};

// Every moving shipment on one OpenStreetMap view (Leaflet, no API key).
// The rail on the right lists the same shipments; picking one flies the map
// to it and draws its route to the drop-off when that address has coordinates.
export function FleetMap({ points }: { points: FleetPoint[] }) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    L: typeof import("leaflet");
    map: import("leaflet").Map;
    group: import("leaflet").LayerGroup;
  } | null>(null);
  const fitted = useRef(false);

  const shown = useMemo(
    () => points.filter((p) => !filter || p.status === filter),
    [points, filter],
  );

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: true, zoomControl: false });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.setView([20.6, 78.9], 4);
      ctx.current = { L, map, group: L.layerGroup().addTo(map) };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      ctx.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c) return;
    const { L, map, group } = c;
    group.clearLayers();
    const bounds: [number, number][] = [];

    shown.forEach((p) => {
      const active = p.id === selected;
      const size = active ? 48 : 38;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          html: truck(p, active),
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: active ? 1000 : 0,
        title: p.code,
        keyboard: false,
      })
        .bindTooltip(`<strong>${esc(p.code)}</strong><br>${esc(p.party)}`, {
          direction: "top",
          offset: [0, -size / 2],
          className: "map-label",
        })
        .on("click", () => setSelected(p.id))
        .addTo(group);
      bounds.push([p.lat, p.lng]);

      if (active && p.dest) {
        L.polyline(
          [
            [p.lat, p.lng],
            [p.dest.lat, p.dest.lng],
          ],
          { color: "#8a96ad", weight: 3, dashArray: "6 8" },
        ).addTo(group);
        L.marker([p.dest.lat, p.dest.lng], {
          icon: L.divIcon({
            html: renderToStaticMarkup(
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{
                  background: "#15803d",
                  color: "#fff",
                  border: "3px solid #fff",
                }}
              >
                <FlagIcon className="size-4" />
              </span>,
            ),
            className: "",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          keyboard: false,
        })
          .bindTooltip(`<strong>Delivery</strong><br>${esc(p.dest.label)}`, {
            direction: "top",
            offset: [0, -16],
            className: "map-label",
          })
          .addTo(group);
      }
    });

    if (!fitted.current && bounds.length) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
      fitted.current = true;
    }
  }, [ready, shown, selected]);

  function pick(p: FleetPoint) {
    setSelected(p.id);
    ctx.current?.map.flyTo(
      [p.lat, p.lng],
      Math.max(ctx.current.map.getZoom(), 10),
      {
        duration: 0.6,
      },
    );
  }

  // The list panel floats over the map on desktop and drops below it on
  // phones, so the map always gets the full width.
  const panel = (
    <>
      <SegmentedControl
        label="Filter by status"
        className="flex! w-full [&>button]:flex-1 [&>button]:px-2!"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "", label: `All ${points.length}` },
          { value: "in_transit", label: "In transit" },
          { value: "assigned", label: "Assigned" },
        ]}
      />
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => pick(p)}
              aria-pressed={p.id === selected}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                p.id === selected ? "bg-brand-soft" : "hover:bg-ground"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.code}</span>
                <StatusBadge status={p.status} />
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted">
                {p.party} · {p.carrier}
              </span>
              <span className="mt-0.5 flex items-center justify-between text-xs text-muted">
                <span>Seen {ago(p.recordedAt)}</span>
                {p.id === selected && (
                  <Link
                    href={`/shipments/${p.id}`}
                    className="font-semibold text-brand-ink hover:underline"
                  >
                    Open shipment
                  </Link>
                )}
              </span>
            </button>
          </li>
        ))}
        {points.length > 0 && !shown.length && (
          <li className="px-1 text-sm text-muted">Nothing with that status.</li>
        )}
      </ul>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="relative isolate overflow-hidden rounded-xl bg-fill">
        <div
          ref={el}
          role="region"
          aria-label="Map of active shipments"
          className="h-[55dvh] min-h-[400px] w-full lg:h-[calc(100dvh-11rem)]"
        />
        {!points.length && (
          <p className="absolute inset-0 z-[500] flex items-center justify-center bg-panel/80 px-6 text-center text-sm text-muted">
            No active shipment has reported a location yet.
          </p>
        )}
        <section
          aria-label="Active shipments"
          className="absolute bottom-3 left-3 top-3 z-[1000] hidden w-80 flex-col gap-3 rounded-xl bg-panel p-3 shadow-[0_8px_28px_rgba(13,24,41,0.22)] lg:flex"
        >
          {panel}
        </section>
      </div>

      <section
        aria-label="Active shipments"
        className="flex max-h-[60dvh] flex-col gap-3 rounded-xl bg-panel p-3 lg:hidden"
      >
        {panel}
      </section>
    </div>
  );
}
