"use client";

import { useEffect, useRef } from "react";

const BARS = 48;

// One tall column per slice of the screen. The tops follow a half sine, so
// together they make an arch. Three kinds of motion, none of them uniform:
//  - each column breathes at its own depth, out of step with its neighbour,
//    so a quick wave runs across the arch (CSS, .bar-in);
//  - its brightness pulses on a different clock, so colour drifts too;
//  - the columns near the pointer swell up toward it (below).
const bars = Array.from({ length: BARS }, (_, i) => ({
  // Rounded: server and browser engines can differ in the last float digit,
  // which React reports as a hydration mismatch.
  h: Number((28 + 54 * Math.sin((Math.PI * i) / (BARS - 1))).toFixed(2)),
  amp: Number((0.1 + 0.08 * Math.abs(Math.sin(i * 1.7))).toFixed(3)),
}));

export function LandingBars() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    const cols = [...el.children] as HTMLElement[];
    let frame = 0;
    let x = -1;

    const paint = () => {
      frame = 0;
      cols.forEach((c, i) => {
        const near = x < 0 ? 0 : Math.max(0, 1 - Math.abs(x - i / (BARS - 1)) / 0.16);
        c.style.setProperty("--lift", near.toFixed(3));
      });
    };
    const move = (e: PointerEvent) => {
      x = e.clientX / window.innerWidth;
      frame ||= requestAnimationFrame(paint);
    };
    const leave = () => {
      x = -1;
      frame ||= requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} aria-hidden="true" className="bars absolute inset-x-0 bottom-0 flex h-full items-end">
      {bars.map((b, i) => (
        <span
          key={i}
          className="bar-out block flex-1"
          style={{ height: `${b.h}%`, ["--i" as string]: i, ["--amp" as string]: b.amp }}
        >
          <span className="bar-in block h-full w-full" />
        </span>
      ))}
    </div>
  );
}
