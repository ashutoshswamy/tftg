"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { SearchInput, type SearchInputHandle } from "@ashutoshswamy/smoui";
import { searchIndex, type SearchIndex } from "@/lib/actions/search";

type Hit = { id: string; label: string; hint?: string; href: string };
type Group = { heading: string; hits: Hit[] };

const PAGES = [
  ["Dashboard", "/dashboard"],
  ["Shipments", "/shipments"],
  ["New shipment", "/shipments/new"],
  ["Dispatch", "/dispatch"],
  ["Live map", "/map"],
  ["Fleet", "/fleet"],
  ["Directory", "/directory/parties"],
  ["Invoices", "/invoices"],
  ["Settings", "/settings"],
  ["Organization", "/organization"],
] as const;

const PER_GROUP = 5;

// smoui SearchInput in the header, with a results panel under it. The index
// is fetched once, on first focus, and filtered in the browser. "/" or
// Ctrl/Cmd+K focuses the field from anywhere.
export function GlobalSearch() {
  const router = useRouter();
  const field = useRef<SearchInputHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const loading = useRef(false);

  function load() {
    if (index || loading.current) return;
    loading.current = true;
    searchIndex()
      .then(setIndex)
      .finally(() => (loading.current = false));
  }

  // The sidebar asks for focus after it expands from its icon-only state.
  useEffect(() => {
    const focus = () => field.current?.focus();
    window.addEventListener("tftg:focus-search", focus);
    return () => window.removeEventListener("tftg:focus-search", focus);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
        (e.target as HTMLElement).tagName,
      );
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        field.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo<Group[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const match = (...parts: string[]) =>
      parts.join(" ").toLowerCase().includes(t);
    const out: Group[] = [
      {
        heading: "Go to",
        hits: PAGES.filter(([label]) => match(label)).map(([label, href]) => ({
          id: href,
          label,
          href,
        })),
      },
    ];
    if (index) {
      out.push(
        {
          heading: "Shipments",
          hits: index.shipments
            .filter((s) => match(s.code, s.customer, s.reference))
            .map((s) => ({
              id: s.id,
              label: `${s.code}${s.customer ? `  ${s.customer}` : ""}`,
              hint: s.status.replace("_", " "),
              href: `/shipments/${s.id}`,
            })),
        },
        {
          heading: "Invoices",
          hits: index.invoices
            .filter((v) => match(v.number, v.customer))
            .map((v) => ({
              id: v.id,
              label: `${v.number}${v.customer ? `  ${v.customer}` : ""}`,
              hint: v.status,
              href: `/invoices/${v.id}`,
            })),
        },
        {
          heading: "Parties",
          hits: index.parties
            .filter((p) => match(p.name, p.roles, p.contact))
            .map((p) => ({
              id: p.id,
              label: p.name,
              hint: p.roles,
              href: "/directory/parties",
            })),
        },
        {
          heading: "Drivers",
          hits: index.drivers
            .filter((d) => match(d.name, d.phone))
            .map((d) => ({ id: d.id, label: d.name, href: "/fleet" })),
        },
        {
          heading: "Vehicles",
          hits: index.vehicles
            .filter((v) => match(v.plate))
            .map((v) => ({
              id: v.id,
              label: v.plate,
              hint: v.type.replace("_", " "),
              href: "/fleet",
            })),
        },
      );
    }
    return out
      .filter((g) => g.hits.length)
      .map((g) => ({ ...g, hits: g.hits.slice(0, PER_GROUP) }));
  }, [q, index]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const showPanel = open && q.trim().length > 0;

  // The sidebar clips its contents, so the panel is fixed: beside the field on
  // wide screens, full width above it when there is no room to the right.
  // The field sits at the bottom of the sidebar, so the panel grows upward.
  // Measured in event handlers, never during render.
  const [pos, setPos] = useState<CSSProperties>({});
  const place = () => {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    const room = window.innerWidth - r.right - 20;
    setPos(
      room >= 280
        ? {
            left: r.right + 12,
            top: Math.max(8, r.top),
            width: Math.min(448, room),
          }
        : {
            left: 8,
            bottom: window.innerHeight - r.top + 8,
            width: window.innerWidth - 16,
          },
    );
  };

  return (
    <div
      ref={root}
      className="w-full"
      onFocus={() => {
        place();
        setOpen(true);
        load();
      }}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <SearchInput
        ref={field}
        collapsible={false}
        width="100%"
        label="Search"
        placeholder="Search shipments, invoices, parties"
        shortcut="/"
        onChange={(v) => {
          place();
          setQ(v);
        }}
        onSubmit={() => groups[0]?.hits[0] && go(groups[0].hits[0].href)}
      />

      {showPanel && (
        <div
          role="listbox"
          aria-label="Search results"
          style={pos}
          className="fixed z-[1100] max-h-[min(28rem,70dvh)] overflow-y-auto rounded-xl bg-panel p-2 shadow-[0_12px_32px_rgba(13,24,41,0.18)]"
        >
          {groups.map((g) => (
            <div key={g.heading} className="py-1">
              <p className="px-3 pb-1 text-xs font-semibold text-muted">
                {g.heading}
              </p>
              {g.hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(h.href)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-ground focus-visible:bg-ground"
                >
                  <span className="min-w-0 truncate">{h.label}</span>
                  {h.hint && (
                    <span className="flex-none text-xs capitalize text-muted">
                      {h.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
          {!groups.length && (
            <p className="px-3 py-3 text-sm text-muted">
              {index ? "Nothing found." : "Searching..."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
