"use client";

import { useEffect, useState } from "react";

const PING_INTERVAL_MS = 20_000;

// ponytail: plain navigator.geolocation in the page tab. No native wrapper,
// no telematics API — good enough while the driver keeps this tab open and
// the screen on. Background tracking needs Capacitor/Expo or a telematics
// integration (Samsara/Motive/Geotab); add that if drivers lock their phones
// mid-route and pings stop.
export function DriverLocationPinger({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "tracking" | "denied" | "unsupported">(
    "idle"
  );
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    let lastSent = 0;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setStatus("tracking");
        const now = Date.now();
        if (now - lastSent < PING_INTERVAL_MS) return;
        lastSent = now;

        fetch("/api/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            accuracy: position.coords.accuracy,
          }),
        })
          .then(() => setLastSentAt(new Date()))
          .catch(() => {
            // Offline or a closed shipment — next watchPosition tick retries.
          });
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [token]);

  if (status === "unsupported") return null;

  return (
    <p className="text-xs text-muted">
      {status === "denied" && "Location sharing is off — turn it on to share your position."}
      {status === "tracking" &&
        (lastSentAt
          ? `Sharing location — last sent ${lastSentAt.toLocaleTimeString()}`
          : "Sharing location…")}
      {status === "idle" && "Requesting location permission…"}
    </p>
  );
}
