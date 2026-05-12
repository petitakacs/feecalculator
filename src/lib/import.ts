import ExcelJS from "exceljs";
import { Employee } from "@/types";

export interface ImportRow {
  employeeName: string;
  hours: number;
  otHours: number;
  waiterSales?: number;
  bonus: number;
  otPayment: number;
  correction: number;
  notes?: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
  matchedCount: number;
  unmatchedNames: string[];
}

/** Parse an xlsx buffer into a flat array of row objects keyed by header names. */
export async function parseImportFile(fileBuffer: ArrayBuffer | Buffer): Promise<{
  rows: Record<string, unknown>[];
  error?: string;
}> {
  try {
    const wb = new ExcelJS.Workbook();
    const buf = fileBuffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(fileBuffer))
      : fileBuffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buf as any);

    const ws = wb.worksheets[0];
    if (!ws) return { rows: [], error: "No worksheet found in the uploaded file." };

    const headers: string[] = [];
    const rows: Record<string, unknown>[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value ?? "").trim());
        });
        return;
      }
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) obj[header] = cell.value;
      });
      rows.push(obj);
    });

    return { rows };
  } catch {
    return { rows: [], error: "Failed to parse file. Please upload a valid Excel (.xlsx) file." };
  }
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return undefined;
}

export function processImportRows(
  rawRows: Record<string, unknown>[],
  employees: Employee[]
): ImportResult {
  const errors: { row: number; message: string }[] = [];
  const rows: ImportRow[] = [];
  const unmatchedNames: string[] = [];

  const employeeNameMap = new Map(
    employees.map((e) => [e.name.toLowerCase().trim(), e])
  );

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2;

    const employeeName = String(
      pick(raw, "Employee Name", "employee_name", "name", "Name") ?? ""
    ).trim();

    if (!employeeName) {
      errors.push({ row: rowNum, message: "Missing employee name" });
      continue;
    }

    const employee = employeeNameMap.get(employeeName.toLowerCase());
    if (!employee) {
      unmatchedNames.push(employeeName);
      errors.push({ row: rowNum, message: `Employee not found: "${employeeName}"` });
      continue;
    }

    const hours = parseFloat(String(pick(raw, "Hours", "hours", "Worked Hours", "worked_hours") ?? 0)) || 0;
    const otHours = parseFloat(String(pick(raw, "OT Hours", "ot_hours", "Overtime Hours", "overtime_hours") ?? 0)) || 0;
    const bonus = Math.round(parseFloat(String(pick(raw, "Bonus", "bonus") ?? 0))) || 0;
    const otPayment = Math.round(parseFloat(String(pick(raw, "OT Payment", "ot_payment", "Overtime Payment") ?? 0))) || 0;
    const correction = Math.round(parseFloat(String(pick(raw, "Correction", "correction", "Manual Correction") ?? 0))) || 0;
    const waiterSalesRaw = pick(raw, "Waiter Sales", "waiter_sales", "Net Waiter Sales");
    const waiterSales =
      waiterSalesRaw !== undefined && waiterSalesRaw !== ""
        ? Math.round(parseFloat(String(waiterSalesRaw)))
        : undefined;
    const notesRaw = pick(raw, "Notes", "notes");

    if (hours < 0) {
      errors.push({ row: rowNum, message: "Hours cannot be negative" });
      continue;
    }

    rows.push({
      employeeName,
      hours,
      otHours,
      waiterSales,
      bonus,
      otPayment,
      correction,
      notes: notesRaw ? String(notesRaw) : undefined,
    });
  }

  return { rows, errors, matchedCount: rows.length, unmatchedNames };
}
