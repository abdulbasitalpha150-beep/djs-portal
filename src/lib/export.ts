import * as XLSX from "xlsx";
import { toast } from "sonner";

export type ExportColumn<T> = {
  label: string;
  getValue: (row: T) => string | number | boolean | null | undefined;
};

function normalizeExportValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatExportFilename(moduleName: string, format: "csv" | "xlsx") {
  const today = new Date().toISOString().slice(0, 10);
  return `${moduleName}_${today}.${format === "csv" ? "csv" : "xlsx"}`;
}

export function exportRowsToFile<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  format: "csv" | "xlsx",
  sheetName = "Data",
) {
  if (rows.length === 0) {
    toast.error("No records to export");
    return false;
  }

  const header = columns.map((column) => column.label);
  const data = rows.map((row) => columns.map((column) => normalizeExportValue(column.getValue(row))));

  if (format === "csv") {
    const csvContent = [
      header.map(escapeCsv).join(","),
      ...data.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
    return true;
  }

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
  toast.success("Export downloaded");
  return true;
}
