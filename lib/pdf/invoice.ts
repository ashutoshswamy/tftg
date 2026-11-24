import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMoney } from "@/lib/money";

export type InvoicePdfData = {
  number: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  company: {
    name: string;
    legalName?: string | null;
    address?: string | null;
    taxId?: string | null;
    bankDetails?: string | null;
    logo?: { bytes: Uint8Array; contentType: string } | null;
  };
  customer: { name: string };
  items: {
    description: string;
    qty: number;
    unitPriceMinor: number;
    taxRatePct: number;
    amountMinor: number;
  }[];
  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  notes?: string | null;
};

// Same palette as the app: ink navy, one orange accent, cool greys.
const INK = rgb(0.051, 0.094, 0.161);
const MUTED = rgb(0.333, 0.38, 0.478);
const BRAND = rgb(1, 0.478, 0);
const BRAND_INK = rgb(0.702, 0.29, 0); // darker orange for text on white
const FILL = rgb(0.957, 0.969, 0.984);
const LINE = rgb(0.886, 0.906, 0.937);

const W = 595;
const H = 842;
const M = 48; // page margin
const BOTTOM = 70;

// ponytail: pdf-lib, drawing by hand. Not @react-pdf/renderer (its dependency
// tree is broken on npm: @react-pdf/hyphenate has no version satisfying the
// ^0.1.1 every 4.x release asks for). Revisit when that is fixed.
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontFile = (weight: 400 | 700) =>
    readFile(
      path.join(
        process.cwd(),
        `node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff`
      )
    );
  const font = await doc.embedFont(await fontFile(400), { subset: true });
  const bold = await doc.embedFont(await fontFile(700), { subset: true });

  const money = (minor: number) => formatMoney(minor, data.currency);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H;

  const text = (
    value: string,
    x: number,
    size: number,
    f: PDFFont = font,
    color = INK,
    align: "left" | "right" = "left"
  ) => {
    const left = align === "right" ? x - f.widthOfTextAtSize(value, size) : x;
    page.drawText(value, { x: left, y, size, font: f, color });
  };

  /** Word-wrap to a width; returns the lines. */
  const wrap = (value: string, width: number, size: number, f: PDFFont) => {
    const lines: string[] = [];
    for (const para of value.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };

  // Small brand tab in the top-left margin; repeated on every page.
  const drawHeaderBar = () => {
    page.drawRectangle({ x: M, y: H - 8, width: 44, height: 8, color: BRAND });
  };

  // ---- header: logo or name on the left, Invoice on the right ----------
  drawHeaderBar();
  y = H - 58;

  let headerBottom = y;
  if (data.company.logo) {
    const { bytes, contentType } = data.company.logo;
    const img = contentType.includes("png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // Fit a 150 x 72 box: a square 240 logo prints 72pt tall, the wide default stays 150 wide.
    const scale = Math.min(150 / img.width, 72 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: M, y: y - h + 14, width: w, height: h });
    headerBottom = y - h + 14 - 16;
  } else {
    text(data.company.name, M, 20, bold);
    headerBottom = y - 20;
  }

  // Company block under the logo.
  let cy = headerBottom;
  const companyLines = [
    data.company.logo ? data.company.legalName || data.company.name : data.company.legalName,
    ...(data.company.address ? data.company.address.split("\n") : []),
    data.company.taxId ? `Tax ID ${data.company.taxId}` : null,
  ].filter(Boolean) as string[];
  for (const [i, line] of companyLines.entries()) {
    y = cy;
    const lead = i === 0 && !!data.company.logo;
    text(line, M, 9, lead ? bold : font, lead ? INK : MUTED);
    cy -= 13;
  }

  y = H - 58;
  text("Invoice", W - M, 26, bold, INK, "right");
  y -= 20;
  text(data.number, W - M, 11, font, MUTED, "right");

  // ---- meta panel -------------------------------------------------------
  const metaTop = Math.min(cy, H - 150) - 14;
  const PANEL_H = 64;
  page.drawRectangle({ x: M, y: metaTop - PANEL_H, width: W - 2 * M, height: PANEL_H, color: FILL });
  const label = (x: number, value: string, align: "left" | "right" = "left") => {
    y = metaTop - 16;
    text(value, x, 8.5, font, MUTED, align);
  };
  const value = (x: number, v: string, size = 11.5) => {
    y = metaTop - 36;
    text(v, x, size, bold);
  };
  label(M + 18, "Billed to");
  wrap(data.customer.name, 150, 11.5, bold)
    .slice(0, 2)
    .forEach((line, i) => {
      y = metaTop - 36 - i * 14;
      text(line, M + 18, 11.5, bold);
    });
  label(M + 188, "Issued");
  value(M + 188, data.issueDate);
  label(M + 278, "Due");
  value(M + 278, data.dueDate ?? "On receipt");
  label(W - M - 18, "Amount due", "right");
  y = metaTop - 38;
  text(money(data.totalMinor), W - M - 18, 16, bold, BRAND_INK, "right");

  y = metaTop - PANEL_H - 34;

  // ---- items table ------------------------------------------------------
  const c = { desc: M + 2, qty: 340, price: 424, tax: 456, amount: W - M - 2 };
  const descWidth = c.qty - c.desc - 50;

  const drawTableHead = () => {
    text("Description", c.desc, 8.5, bold, MUTED);
    text("Qty", c.qty, 8.5, bold, MUTED, "right");
    text("Unit price", c.price + 14, 8.5, bold, MUTED, "right");
    text("Tax", c.tax + 14, 8.5, bold, MUTED, "right");
    text("Amount", c.amount, 8.5, bold, MUTED, "right");
    y -= 9;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: INK });
  };
  drawTableHead();

  for (const item of data.items) {
    const lines = wrap(item.description, descWidth, 10, font);
    const rowH = lines.length * 13 + 22;
    if (y - rowH < BOTTOM + 130) {
      page = doc.addPage([W, H]);
      drawHeaderBar();
      y = H - 56;
      drawTableHead();
    }
    const top = y;
    lines.forEach((line, i) => {
      y = top - 19 - i * 13;
      text(line, c.desc, 10, font);
    });
    y = top - 19;
    text(String(item.qty), c.qty, 10, font, INK, "right");
    text(money(item.unitPriceMinor), c.price + 14, 10, font, INK, "right");
    text(`${item.taxRatePct}%`, c.tax + 14, 10, font, MUTED, "right");
    text(money(item.amountMinor), c.amount, 10, bold, INK, "right");
    y = top - rowH;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
  }

  // ---- totals -----------------------------------------------------------
  if (y < BOTTOM + 130) {
    page = doc.addPage([W, H]);
    drawHeaderBar();
    y = H - 56;
  }
  y -= 26;
  const tx = W - M - 230;
  const row = (name: string, amount: string) => {
    text(name, tx + 16, 10, font, MUTED);
    text(amount, W - M - 16, 10, font, INK, "right");
    y -= 20;
  };
  row("Subtotal", money(data.subtotalMinor));
  row("Tax", money(data.taxTotalMinor));
  // Bar top sits 12pt under the last row's baseline so the two never touch.
  page.drawRectangle({ x: tx, y: y - 30, width: 230, height: 38, color: INK });
  y -= 15;
  text("Total", tx + 16, 11, bold, rgb(1, 1, 1));
  text(money(data.totalMinor), W - M - 16, 14, bold, BRAND, "right");
  y -= 15 + 44;

  // ---- payment details and notes ---------------------------------------
  const blocks: [string, string][] = [];
  if (data.company.bankDetails) blocks.push(["Payment details", data.company.bankDetails]);
  if (data.notes) blocks.push(["Notes", data.notes]);

  const half = (W - 2 * M - 24) / 2;
  const blockLines = blocks.map(([, body]) => wrap(body, half, 9.5, font));
  const need = Math.max(0, ...blockLines.map((l) => l.length)) * 13 + 30;
  if (blocks.length && y - need < BOTTOM) {
    page = doc.addPage([W, H]);
    drawHeaderBar();
    y = H - 56;
  }
  const blockTop = y;
  blocks.forEach(([title], i) => {
    const x = M + i * (half + 24);
    y = blockTop;
    text(title, x, 9, bold, INK);
    blockLines[i].forEach((line, j) => {
      y = blockTop - 16 - j * 13;
      text(line, x, 9.5, font, MUTED);
    });
  });

  // ---- footer on every page --------------------------------------------
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.6, color: LINE });
    const label = `${data.company.name}  |  ${data.number}`;
    p.drawText(label, { x: M, y: 32, size: 8.5, font, color: MUTED });
    const pn = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 8.5), y: 32, size: 8.5, font, color: MUTED });
  });

  return doc.save();
}
