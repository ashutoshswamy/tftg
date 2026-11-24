"use client";

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlagIcon, MapPinIcon, TruckIcon } from "@heroicons/react/24/solid";
import "leaflet/dist/leaflet.css";

export type TrailPoint = { lat: number; lng: number; recorded_at: string };
export type MapStop = { kind: string; label: string; lat: number; lng: number };

const POLL_INTERVAL_MS = 20_000;
const BRAND = "#ff7a00";
const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pin = (icon: React.ReactNode, bg: string, size = 32, fg = "#ffffff") =>
  renderToStaticMarkup(
    <span
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        boxShadow: "0 2px 8px rgba(15,27,51,.35)",
      }}
      className="flex items-center justify-center rounded-full"
    >
      {icon}
    </span>
  );

// OpenStreetMap tiles through Leaflet: a real, pannable map with no API key.
// Shows the planned route between stops (dashed), the path driven so far
// (solid), pickup/drop-off pins and the truck at its latest position. With a
// token it polls the customer location endpoint for new pings.
export function TrackingMap({
  token,
  initialTrail,
  stops,
  heightClass = "h-80 sm:h-96",
}: {
  token?: string;
  heightClass?: string;
  initialTrail: TrailPoint[];
  stops: MapStop[];
}) {
  const [trail, setTrail] = useState(initialTrail);
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const layers = useRef<{ L: typeof import("leaflet"); map: import("leaflet").Map; group: import("leaflet").LayerGroup } | null>(null);
  const fitted = useRef(false);
  const last = trail.at(-1);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetch(`/api/track/${token}/location`)
        .then((res) => res.json())
        .then((data) => Array.isArray(data.trail) && setTrail(data.trail))
        .catch(() => {
          // Transient network hiccup: the next poll retries.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layers.current = { L, map, group: L.layerGroup().addTo(map) };
      map.setView([20.6, 78.9], 4); // India overview until data arrives
      setReady(true);
    })();
    return () => {
      cancelled = true;
      layers.current = null;
      map?.remove();
    };
  }, []);

  // Draw stops, route and trail whenever data changes.
  useEffect(() => {
    const ctx = layers.current;
    if (!ready || !ctx) return;
    const { L, map, group } = ctx;
    group.clearLayers();
    const bounds: [number, number][] = [];

    const icon = (html: string, size: number) =>
      L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

    if (stops.length > 1) {
      L.polyline(stops.map((s) => [s.lat, s.lng] as [number, number]), {
        color: "#8a96ad",
        weight: 3,
        dashArray: "6 8",
      }).addTo(group);
    }
    stops.forEach((s, i) => {
      const drop = s.kind === "dropoff" || (s.kind !== "pickup" && i === stops.length - 1 && stops.length > 1);
      const name = drop ? "Delivery" : s.kind === "pickup" || i === 0 ? "Pickup" : "Stop";
      L.marker([s.lat, s.lng], {
        icon: icon(
          pin(
            drop ? <FlagIcon className="size-4" /> : <MapPinIcon className="size-4" />,
            drop ? "#15803d" : "#0d1829"
          ),
          32
        ),
        title: `${name}: ${s.label}`,
        keyboard: false,
      })
        .bindTooltip(`<strong>${name}</strong><br>${esc(s.label)}`, {
          direction: "top",
          offset: [0, -16],
          className: "map-label",
        })
        .addTo(group);
      bounds.push([s.lat, s.lng]);
    });

    if (trail.length) {
      const path = trail.map((p) => [p.lat, p.lng] as [number, number]);
      if (path.length > 1) L.polyline(path, { color: BRAND, weight: 5, opacity: 0.9 }).addTo(group);
      const head = path[path.length - 1];
      L.marker(head, {
        icon: icon(pin(<TruckIcon className="size-5" />, BRAND, 40, "#0d1829"), 40),
        title: "Current position",
        zIndexOffset: 1000,
        keyboard: false,
      })
        .bindTooltip("<strong>Current position</strong>", {
          direction: "top",
          offset: [0, -20],
          className: "map-label",
        })
        .addTo(group);
      bounds.push(...path);
    }

    if (bounds.length) {
      if (!fitted.current) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        fitted.current = true;
      } else if (trail.length) {
        const head = trail[trail.length - 1];
        if (!map.getBounds().contains([head.lat, head.lng])) map.panTo([head.lat, head.lng]);
      }
    }
  }, [ready, trail, stops]);

  const empty = !trail.length && !stops.length;

  return (
    <div className="space-y-2">
      <div className="relative isolate overflow-hidden rounded-xl bg-fill">
        <div
          ref={el}
          role="region"
          aria-label="Shipment map"
          className={`w-full ${heightClass}`}
        />
        {empty && (
          <p className="absolute inset-0 z-[500] flex items-center justify-center bg-panel/80 text-sm text-muted">
            No location data yet.
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-ink" /> Pickup
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#15803d]" /> Delivery
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-brand" /> Current position
        </li>
      </ul>
      {!stops.length && (
        <p className="text-xs text-muted">
          Pickup and delivery are not plotted: their addresses have no map coordinates yet.
        </p>
      )}
      <p className="text-xs text-muted">
        {last
          ? `Last updated ${new Date(last.recorded_at).toLocaleTimeString()}`
          : "Waiting for the first location update."}
      </p>
    </div>
  );
}
