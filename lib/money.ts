// Money as integer minor units (cents, paise, ...) everywhere — never
// floats. Exponent (decimal places) comes from Intl, not a lookup table:
// it already knows USD=2, JPY=0, KWD=3, etc.

export function currencyExponent(currency: string): number {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function formatMoney(minorUnits: number, currency: string): string {
  const exponent = currencyExponent(currency);
  const amount = minorUnits / 10 ** exponent;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount
  );
}

export type LineCalc = {
  /** The line's stated amount (qty × unit price), before rounding tax. */
  amountMinor: number;
  taxMinor: number;
  /** Net of tax — what rolls into the invoice subtotal. */
  netMinor: number;
};

/**
 * One invoice line's tax split. `pricesIncludeTax` controls whether
 * `amountMinor` already has tax baked in (back it out) or not (add it).
 * Rounds per line — the invoice sums already-rounded lines, matching how a
 * human checks a printed invoice against its line items.
 */
export function calcLine(
  qty: number,
  unitPriceMinor: number,
  taxRatePct: number,
  pricesIncludeTax: boolean
): LineCalc {
  const amountMinor = Math.round(qty * unitPriceMinor);
  const rate = taxRatePct / 100;

  if (pricesIncludeTax) {
    const netMinor = Math.round(amountMinor / (1 + rate));
    return { amountMinor, taxMinor: amountMinor - netMinor, netMinor };
  }

  const taxMinor = Math.round(amountMinor * rate);
  return { amountMinor, taxMinor, netMinor: amountMinor };
}

export type InvoiceTotals = {
  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
};

export function calcInvoiceTotals(
  items: { qty: number; unitPriceMinor: number; taxRatePct: number }[],
  pricesIncludeTax: boolean
): InvoiceTotals {
  let subtotalMinor = 0;
  let taxTotalMinor = 0;

  for (const item of items) {
    const line = calcLine(item.qty, item.unitPriceMinor, item.taxRatePct, pricesIncludeTax);
    subtotalMinor += line.netMinor;
    taxTotalMinor += line.taxMinor;
  }

  return {
    subtotalMinor,
    taxTotalMinor,
    totalMinor: subtotalMinor + taxTotalMinor,
  };
}
