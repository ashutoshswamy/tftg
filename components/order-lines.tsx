"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Input } from "@/components/ui";

export type OrderLine = {
  description: string;
  qty: string;
  unitPrice: string;
  taxRatePct: string;
};

const blank = (tax: string): OrderLine => ({
  description: "",
  qty: "1",
  unitPrice: "",
  taxRatePct: tax,
});

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One row per order line, laid out left to right so the whole line can be
// typed without leaving the keyboard: Enter moves to the next field, and
// Enter on the very last field adds a fresh line and focuses it. Fields post
// as repeated item* names; the server reads them in order with getAll.
// `children` is the submit button, pinned beside the running total.
export function OrderLines({
  initial,
  defaultTax,
  pricesIncludeTax,
  children,
}: {
  initial: OrderLine[];
  defaultTax: string;
  pricesIncludeTax: boolean;
  children: ReactNode;
}) {
  const [rows, setRows] = useState(() =>
    (initial.length ? initial : [blank(defaultTax)]).map((r, i) => ({ ...r, key: i })),
  );
  const [next, setNext] = useState(rows.length);
  const focusKey = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusKey.current === null) return;
    root.current?.querySelector<HTMLInputElement>(`[data-desc="${focusKey.current}"]`)?.focus();
    focusKey.current = null;
  }, [rows]);

  const set = (key: number, field: keyof OrderLine, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const add = () => {
    setRows((rs) => [...rs, { ...blank(defaultTax), key: next }]);
    focusKey.current = next;
    setNext(next + 1);
  };

  function onEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault(); // Enter must never submit a half-typed order
    const fields = [...(root.current?.querySelectorAll<HTMLInputElement>("[data-item]") ?? [])];
    const at = fields.indexOf(e.currentTarget);
    if (fields[at + 1]) fields[at + 1].focus();
    else add();
  }

  const subtotal = rows.reduce(
    (s, r) => s + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0),
    0,
  );
  const tax = rows.reduce(
    (s, r) =>
      s + ((Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (Number(r.taxRatePct) || 0)) / 100,
    0,
  );
  // Prices that already include tax: the tax is inside the line, not on top.
  const total = pricesIncludeTax ? subtotal : subtotal + tax;

  const field = (key: number, name: string, label: string, field: keyof OrderLine, extra = {}) => (
    <Input
      label={label}
      name={name}
      value={rows.find((r) => r.key === key)![field]}
      onChange={(e) => set(key, field, e.target.value)}
      onKeyDown={onEnter}
      data-item=""
      {...extra}
    />
  );

  return (
    <div ref={root} className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={row.key}
            className="grid grid-cols-[repeat(3,minmax(0,1fr))_2.5rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem_5.5rem_2.5rem]"
          >
            <div className="col-span-3 sm:col-span-1">
              {field(row.key, "itemDescription", "Description", "description", {
                "data-desc": row.key,
              })}
            </div>
            {field(row.key, "itemQty", "Qty", "qty", { type: "number", step: "0.01" })}
            {field(row.key, "itemUnitPrice", "Unit price", "unitPrice", {
              type: "number",
              step: "0.01",
            })}
            {field(row.key, "itemTaxRatePct", "Tax %", "taxRatePct", {
              type: "number",
              step: "0.01",
            })}
            <button
              type="button"
              className="btn btn-quiet h-14 px-0"
              aria-label={`Remove line ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-quiet -ml-2" onClick={add}>
        + Add line
      </button>

      <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-panel px-5 py-3 sm:-mx-6 sm:px-6">
        <dl className="flex items-baseline gap-6 text-sm">
          <div>
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{money(subtotal)}</dd>
          </div>
          <div>
            <dt className="text-muted">Tax{pricesIncludeTax ? " (included)" : ""}</dt>
            <dd className="font-semibold tabular-nums">{money(tax)}</dd>
          </div>
          <div>
            <dt className="text-muted">Total</dt>
            <dd className="text-lg font-bold tabular-nums">{money(total)}</dd>
          </div>
        </dl>
        <div className="min-w-48">{children}</div>
      </div>
    </div>
  );
}
