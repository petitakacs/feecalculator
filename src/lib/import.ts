import * as XLSX from "xlsx";
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

export function parseImportFile(fileBuffer: Buffer): {
  rows: Record<string, unknown>[];
  error?: string;
} {
  try {
    const wb = XLSX.read(fileBuffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<
      string,
      unknown
    >[];
    return { rows };
  } catch {
    return { rows: [], error: "Failed to parse file. Please upload a valid Excel or CSV file." };
  }
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
    const rowNum = i + 2; // 1-indexed, +1 for header

    // Try different column name formats
    const employeeName = String(
      raw["Employee Name"] ||
        raw["employee_name"] ||
        raw["name"] ||
        raw["Name"] ||
        ""
    ).trim();

    if (!employeeName) {
      errors.push({ row: rowNum, message: "Missing employee name" });
      continue;
    }

    // Check if employee exists
    const employee = employeeNameMap.get(employeeName.toLowerCase());
    if (!employee) {
      unmatchedNames.push(employeeName);
      errors.push({
        row: rowNum,
        message: `Employee not found: "${employeeName}"`,
      });
      continue;
    }

    const hoursRaw =
      raw["Hours"] || raw["hours"] || raw["Worked Hours"] || raw["worked_hours"] || 0;
    const otHoursRaw =
      raw["OT Hours"] ||
      raw["ot_hours"] ||
      raw["Overtime Hours"] ||
      raw["overtime_hours"] ||
      0;
    const waiterSalesRaw =
      raw["Waiter Sales"] ||
      raw["waiter_sales"] ||
      raw["Net Waiter Sales"] ||
      undefined;
    const bonusRaw = raw["Bonus"] || raw["bonus"] || 0;
    const otPaymentRaw =
      raw["OT Payment"] || raw["ot_payment"] || raw["Overtime Payment"] || 0;
    const correctionRaw =
      raw["Correction"] || raw["correction"] || raw["Manual Correction"] || 0;
    const notesRaw = raw["Notes"] || raw["notes"] || "";

    const hours = parseFloat(String(hoursRaw)) || 0;
    const otHours = parseFloat(String(otHoursRaw)) || 0;
    const bonus = Math.round(parseFloat(String(bonusRaw))) || 0;
    const otPayment = Math.round(parseFloat(String(otPaymentRaw))) || 0;
    const correction = Math.round(parseFloat(String(correctionRaw))) || 0;
    const waiterSales =
      waiterSalesRaw !== undefined && waiterSalesRaw !== ""
        ? Math.round(parseFloat(String(waiterSalesRaw)))
        : undefined;

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

  return {
    rows,
    errors,
    matchedCount: rows.length,
    unmatchedNames,
  };
}
