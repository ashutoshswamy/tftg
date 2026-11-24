import { test } from "node:test";
import assert from "node:assert/strict";
import { calcLine, calcInvoiceTotals, formatMoney, currencyExponent } from "./money.ts";

test("exclusive tax: tax added on top", () => {
  const line = calcLine(2, 10000, 18, false); // 2 x $100.00, 18% GST
  assert.equal(line.amountMinor, 20000);
  assert.equal(line.taxMinor, 3600);
  assert.equal(line.netMinor, 20000);
});

test("inclusive tax: tax backed out of the stated price", () => {
  const line = calcLine(1, 11800, 18, true); // $118.00 incl. 18% tax
  assert.equal(line.amountMinor, 11800);
  assert.equal(line.netMinor, 10000);
  assert.equal(line.taxMinor, 1800);
});

test("invoice totals sum already-rounded lines", () => {
  const totals = calcInvoiceTotals(
    [
      { qty: 1, unitPriceMinor: 10000, taxRatePct: 18 },
      { qty: 3, unitPriceMinor: 333, taxRatePct: 0 },
    ],
    false
  );
  assert.equal(totals.subtotalMinor, 10999);
  assert.equal(totals.taxTotalMinor, 1800);
  assert.equal(totals.totalMinor, 12799);
});

test("zero-decimal currency (JPY) has no fractional exponent", () => {
  assert.equal(currencyExponent("JPY"), 0);
  assert.equal(formatMoney(1500, "JPY"), "¥1,500");
});

test("two-decimal currency formats with cents", () => {
  assert.equal(formatMoney(123456, "USD"), "$1,234.56");
});
