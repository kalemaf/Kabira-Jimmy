"use client";

import type { ReportColumn, ReportRow } from "@/lib/reports";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToCsv(columns: ReportColumn[], rows: ReportRow[], filename: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(String(row[c.key] ?? ""))).join(","));
  const csv = [header, ...lines].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export async function exportToExcel(columns: ReportColumn[], rows: ReportRow[], filename: string) {
  const XLSX = await import("xlsx");
  const data = rows.map((row) => {
    const obj: Record<string, string | number> = {};
    for (const c of columns) obj[c.label] = row[c.key] ?? "";
    return obj;
  });
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToPdf(title: string, columns: ReportColumn[], rows: ReportRow[], filename: string) {
  const [{ pdf }, { GenericReportPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/generic-report-pdf"),
  ]);
  const blob = await pdf(GenericReportPDF({ title, columns, rows })).toBlob();
  downloadBlob(blob, `${filename}.pdf`);
}
