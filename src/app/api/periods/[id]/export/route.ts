import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { exportPeriodToExcel } from "@/lib/export";
import { MonthlyEmployeeEntry, MonthlyPeriod } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    include: {
      season: true,
      entries: {
        include: { employee: { include: { position: true } }, position: true },
        orderBy: [{ employee: { name: "asc" } }],
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const periodData: MonthlyPeriod = {
    id: period.id,
    month: period.month,
    year: period.year,
    seasonId: period.seasonId,
    openingBalance: period.openingBalance,
    collectedServiceCharge: period.collectedServiceCharge,
    distributableBalance: period.distributableBalance,
    targetDistributionTotal: period.targetDistributionTotal,
    approvedDistributionTotal: period.approvedDistributionTotal,
    closingBalance: period.closingBalance,
    status: period.status,
    notes: period.notes ?? undefined,
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
  };

  const entriesData: MonthlyEmployeeEntry[] = period.entries.map((e) => ({
    id: e.id,
    periodId: e.periodId,
    employeeId: e.employeeId,
    positionId: e.positionId,
    workedHours: Number(e.workedHours),
    overtimeHours: Number(e.overtimeHours),
    netWaiterSales: e.netWaiterSales ?? undefined,
    calculatedGrossServiceCharge: e.calculatedGrossServiceCharge ?? undefined,
    calculatedNetServiceCharge: e.calculatedNetServiceCharge ?? undefined,
    targetNetHourlyServiceCharge: e.targetNetHourlyServiceCharge ?? undefined,
    targetServiceChargeAmount: e.targetServiceChargeAmount ?? undefined,
    bonus: e.bonus,
    overtimePayment: e.overtimePayment,
    manualCorrection: e.manualCorrection,
    manualCorrectionReason: e.manualCorrectionReason ?? undefined,
    finalApprovedAmount: e.finalApprovedAmount ?? undefined,
    notes: e.notes ?? undefined,
    isLoanEntry: e.isLoanEntry,
    workingLocationId: e.workingLocationId ?? undefined,
    entryLabel: e.entryLabel ?? undefined,
    overrideFlag: e.overrideFlag,
    overrideReason: e.overrideReason ?? undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    employee: e.employee ? {
      id: e.employee.id,
      name: e.employee.name,
      active: e.employee.active,
      positionId: e.employee.positionId,
      baseSalaryType: e.employee.baseSalaryType,
      baseSalaryAmount: e.employee.baseSalaryAmount,
      eligibleForServiceCharge: e.employee.eligibleForServiceCharge,
      startDate: e.employee.startDate.toISOString(),
      createdAt: e.employee.createdAt.toISOString(),
      updatedAt: e.employee.updatedAt.toISOString(),
    } : undefined,
    position: e.position ? {
      id: e.position.id,
      name: e.position.name,
      multiplier: Number(e.position.multiplier),
      eligibleForServiceCharge: e.position.eligibleForServiceCharge,
      active: e.position.active,
      createdAt: e.position.createdAt.toISOString(),
      updatedAt: e.position.updatedAt.toISOString(),
    } : undefined,
  }));

  const buffer = exportPeriodToExcel(periodData, entriesData);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="period-${period.year}-${String(period.month).padStart(2, "0")}.xlsx"`,
    },
  });
}
