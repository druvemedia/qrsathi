"use client";
/** Parses CSV / XLSX files into a header row + string cells, and writes CSV / XLSX. */

export interface Table {
  headers: string[];
  rows: string[][];
}

export async function parseTableFile(file: File): Promise<Table> {
  let table: string[][];
  if (/\.xlsx$/i.test(file.name)) {
    const readXlsx = (await import("read-excel-file")).default;
    const data = await readXlsx(file);
    table = data.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c == null ? "" : String(c))));
  } else if (/\.xls$/i.test(file.name)) {
    throw new Error("Old .xls files aren't supported — save as .xlsx or CSV.");
  } else {
    const Papa = (await import("papaparse")).default;
    table = await new Promise<string[][]>((resolve, reject) =>
      Papa.parse<string[]>(file, { skipEmptyLines: "greedy", complete: (r) => resolve(r.data), error: reject }),
    );
  }
  if (table.length < 2) throw new Error("The file needs a header row and at least one data row.");
  const headers = table[0].map((h, i) => (String(h || "").trim() || `Column ${i + 1}`));
  const rows = table.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { headers, rows };
}

/** Normalises a header like "Low Stock At" / "low-stock" → "low_stock_at". */
export const headerKey = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const csvCell = (v: unknown) => {
  const s0 = v == null ? "" : String(v);
  const s = /^[=+\-@\t\r]/.test(s0) ? `'${s0}` : s0;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

export async function toXlsx(headers: string[], rows: (string | number | null)[][]): Promise<Blob> {
  const writeXlsxFile = (await import("write-excel-file/browser")).default;
  const data = [
    headers.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...rows.map((r) => r.map((v) => (typeof v === "number" ? { value: v, type: Number } : { value: v ?? "", type: String }))),
  ];
  return writeXlsxFile(data as any).toBlob();
}
