import * as XLSX from "xlsx";
import { MonthlyEmployeeEntry, MonthlyPeriod } from "@/types";
import { formatCurrency, formatHours, formatPeriod } from "@/lib/format";

export function exportPeriodToExcel(
  period: MonthlyPeriod,
  entries: MonthlyEmployeeEntry[]
): Buffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["Café Service Charge Distribution"],
    [
      "Period:",
      formatPeriod(period.month, period.year),
      "Status:",
      period.status,
    ],
    ["Opening Balance:", formatCurrency(period.openingBalance)],
    ["Collected SC:", formatCurrency(period.collectedServiceCharge)],
    ["Distributable Balance:", formatCurrency(period.distributableBalance)],
    ["Target Distribution:", formatCurrency(period.targetDistributionTotal)],
    [
      "Approved Distribution:",
      formatCurrency(period.approvedDistributionTotal),
    ],
    ["Closing Balance:", formatCurrency(period.closingBalance)],
    [],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Allocation sheet
  const headers = [
    "Employee",
    "Position",
    "Hours",
    "OT Hours",
    "Waiter Sales",
    "Gross SC",
    "Net SC",
    "Target Hourly",
    "Target SC",
    "Bonus",
    "OT Payment",
    "Correction",
    "Final Target",
    "Approved",
    "Override",
    "Notes",
  ];

  const rows = entries.map((entry) => [
    entry.employee?.name ?? entry.employeeId,
    entry.position?.name ?? entry.positionId,
    formatHours(entry.workedHours),
    formatHours(entry.overtimeHours),
    entry.netWaiterSales != null ? formatCurrency(entry.netWaiterSales) : "-",
    entry.calculatedGrossServiceCharge != null
      ? formatCurrency(entry.calculatedGrossServiceCharge)
      : "-",
    entry.calculatedNetServiceCharge != null
      ? formatCurrency(entry.calculatedNetServiceCharge)
      : "-",
    entry.targetNetHourlyServiceCharge != null
      ? formatCurrency(entry.targetNetHourlyServiceCharge)
      : "-",
    entry.targetServiceChargeAmount != null
      ? formatCurrency(entry.targetServiceChargeAmount)
      : "-",
    formatCurrency(entry.bonus),
    formatCurrency(entry.overtimePayment),
    formatCurrency(entry.manualCorrection),
    entry.targetServiceChargeAmount != null
      ? formatCurrency(
          entry.targetServiceChargeAmount +
            entry.bonus +
            entry.overtimePayment +
            entry.manualCorrection
        )
      : "-",
    entry.finalApprovedAmount != null
      ? formatCurrency(entry.finalApprovedAmount)
      : "-",
    entry.overrideFlag ? "YES" : "NO",
    entry.notes ?? "",
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Color-code overridden rows in yellow
  entries.forEach((entry, idx) => {
    if (entry.overrideFlag) {
      const rowIdx = idx + 1; // +1 for header row (0-indexed)
      for (let col = 0; col < headers.length; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: col });
        if (!ws[cellAddress]) continue;
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.fill = {
          fgColor: { rgb: "FFFF00" },
        };
      }
    }
  });

  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, // Employee
    { wch: 20 }, // Position
    { wch: 8 }, // Hours
    { wch: 8 }, // OT Hours
    { wch: 14 }, // Waiter Sales
    { wch: 12 }, // Gross SC
    { wch: 12 }, // Net SC
    { wch: 14 }, // Target Hourly
    { wch: 12 }, // Target SC
    { wch: 10 }, // Bonus
    { wch: 12 }, // OT Payment
    { wch: 12 }, // Correction
    { wch: 14 }, // Final Target
    { wch: 12 }, // Approved
    { wch: 8 }, // Override
    { wch: 30 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Allocation");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
