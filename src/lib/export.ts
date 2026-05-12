import ExcelJS from "exceljs";
import { MonthlyEmployeeEntry, MonthlyPeriod } from "@/types";
import { formatCurrency, formatHours, formatPeriod } from "@/lib/format";

export async function exportPeriodToExcel(
  period: MonthlyPeriod,
  entries: MonthlyEmployeeEntry[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FeeCalculator";
  wb.created = new Date();

  // --- Summary sheet ---
  const summaryWs = wb.addWorksheet("Summary");
  summaryWs.addRow(["Café Service Charge Distribution"]);
  summaryWs.addRow(["Period:", formatPeriod(period.month, period.year), "Status:", period.status]);
  summaryWs.addRow(["Opening Balance:", formatCurrency(period.openingBalance)]);
  summaryWs.addRow(["Collected SC:", formatCurrency(period.collectedServiceCharge)]);
  summaryWs.addRow(["Distributable Balance:", formatCurrency(period.distributableBalance)]);
  summaryWs.addRow(["Target Distribution:", formatCurrency(period.targetDistributionTotal)]);
  summaryWs.addRow(["Approved Distribution:", formatCurrency(period.approvedDistributionTotal)]);
  summaryWs.addRow(["Closing Balance:", formatCurrency(period.closingBalance)]);

  // --- Allocation sheet ---
  const ws = wb.addWorksheet("Allocation");

  ws.columns = [
    { header: "Employee",      key: "employee",      width: 25 },
    { header: "Position",      key: "position",      width: 20 },
    { header: "Hours",         key: "hours",         width: 8 },
    { header: "OT Hours",      key: "otHours",       width: 8 },
    { header: "Waiter Sales",  key: "waiterSales",   width: 14 },
    { header: "Gross SC",      key: "grossSC",       width: 12 },
    { header: "Net SC",        key: "netSC",         width: 12 },
    { header: "Target Hourly", key: "targetHourly",  width: 14 },
    { header: "Target SC",     key: "targetSC",      width: 12 },
    { header: "Bonus",         key: "bonus",         width: 10 },
    { header: "OT Payment",    key: "otPayment",     width: 12 },
    { header: "Correction",    key: "correction",    width: 12 },
    { header: "Final Target",  key: "finalTarget",   width: 14 },
    { header: "Approved",      key: "approved",      width: 12 },
    { header: "Override",      key: "override",      width: 8 },
    { header: "Notes",         key: "notes",         width: 30 },
  ];

  // Style header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };

  for (const entry of entries) {
    const target = entry.targetServiceChargeAmount;
    const row = ws.addRow({
      employee:     entry.employee?.name ?? entry.employeeId,
      position:     entry.position?.name ?? entry.positionId,
      hours:        formatHours(entry.workedHours),
      otHours:      formatHours(entry.overtimeHours),
      waiterSales:  entry.netWaiterSales != null ? formatCurrency(entry.netWaiterSales) : "-",
      grossSC:      entry.calculatedGrossServiceCharge != null ? formatCurrency(entry.calculatedGrossServiceCharge) : "-",
      netSC:        entry.calculatedNetServiceCharge != null ? formatCurrency(entry.calculatedNetServiceCharge) : "-",
      targetHourly: entry.targetNetHourlyServiceCharge != null ? formatCurrency(entry.targetNetHourlyServiceCharge) : "-",
      targetSC:     target != null ? formatCurrency(target) : "-",
      bonus:        formatCurrency(entry.bonus),
      otPayment:    formatCurrency(entry.overtimePayment),
      correction:   formatCurrency(entry.manualCorrection),
      finalTarget:  target != null ? formatCurrency(target + entry.bonus + entry.overtimePayment + entry.manualCorrection) : "-",
      approved:     entry.finalApprovedAmount != null ? formatCurrency(entry.finalApprovedAmount) : "-",
      override:     entry.overrideFlag ? "YES" : "NO",
      notes:        entry.notes ?? "",
    });

    if (entry.overrideFlag) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" },
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
