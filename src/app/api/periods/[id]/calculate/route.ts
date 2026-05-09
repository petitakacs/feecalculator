import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  calculatePeriod,
  WaiterEntry,
  PositionEntry,
  SeasonParams,
} from "@/lib/calculation-engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    include: {
      season: true,
      location: true,
      entries: {
        include: { employee: { include: { position: true } }, position: true },
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  // Get active business rule
  const now = new Date();
  const businessRule = await prisma.businessRule.findFirst({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!businessRule) {
    return NextResponse.json({ error: "No active business rule found" }, { status: 422 });
  }

  // Per-location serviceChargePercent override takes priority over the global rule
  const locationOverride = period.location?.serviceChargePercent != null
    ? Number(period.location.serviceChargePercent)
    : null;

  const rules = {
    serviceChargePercent: locationOverride ?? Number(businessRule.serviceChargePercent),
    employeeContribution: Number(businessRule.employeeContribution),
  };

  // Get season position rules (multiplier overrides)
  const seasonRules = await prisma.seasonPositionRule.findMany({
    where: { seasonId: period.seasonId },
  });
  const multiplierOverrideMap = new Map(
    seasonRules.map((r) => [r.positionId, Number(r.multiplier)])
  );

  // Identify waiter entries (position multiplier = 1.0, or waiter position by name)
  const waiterEntries: WaiterEntry[] = [];
  const allEntries: PositionEntry[] = [];

  for (const entry of period.entries) {
    const positionMultiplier =
      multiplierOverrideMap.get(entry.positionId) ??
      Number(entry.position.multiplier);

    allEntries.push({
      entryId: entry.id,
      employeeId: entry.employeeId,
      positionId: entry.positionId,
      multiplier: positionMultiplier,
      workedHours: Number(entry.workedHours),
      bonus: entry.bonus,
      overtimePayment: entry.overtimePayment,
      manualCorrection: entry.manualCorrection,
    });

    // Waiter entries have netWaiterSales set
    if (entry.netWaiterSales !== null) {
      waiterEntries.push({
        employeeId: entry.employeeId,
        workedHours: Number(entry.workedHours),
        netSalesCents: entry.netWaiterSales,
      });
    }
  }

  const seasonParams: SeasonParams = {
    mode: period.season.referenceMode,
    manualWaiterTargetHourlyCents: period.season.manualWaiterTargetHourly ?? undefined,
    minHourlyCents: period.season.minAllowedVariance
      ? Math.round(Number(period.season.minAllowedVariance) * 100)
      : undefined,
    maxHourlyCents: period.season.maxAllowedVariance
      ? Math.round(Number(period.season.maxAllowedVariance) * 100)
      : undefined,
  };

  const result = calculatePeriod(waiterEntries, allEntries, rules, seasonParams);

  // Update all entries with calculated values
  await Promise.all(
    result.entries.map(async (entryResult) => {
      const dbEntry = period.entries.find((e) => e.id === entryResult.entryId);
      if (!dbEntry) return;

      return prisma.monthlyEmployeeEntry.update({
        where: { id: dbEntry.id },
        data: {
          calculatedGrossServiceCharge: entryResult.calculatedGrossServiceChargeCents,
          calculatedNetServiceCharge: entryResult.calculatedNetServiceChargeCents,
          targetNetHourlyServiceCharge: entryResult.targetNetHourlyServiceChargeCents,
          targetServiceChargeAmount: entryResult.targetServiceChargeAmountCents,
        },
      });
    })
  );

  // Update the period totals
  await prisma.monthlyPeriod.update({
    where: { id: id },
    data: {
      targetDistributionTotal: result.targetDistributionTotalCents,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CALCULATE",
    entityType: "MonthlyPeriod",
    entityId: id,
    periodId: id,
    after: {
      targetDistributionTotal: result.targetDistributionTotalCents,
      waiterReferenceRate: result.waiterReferenceHourlyRateCents,
    },
  });

  return NextResponse.json({
    waiterReferenceHourlyRateCents: result.waiterReferenceHourlyRateCents,
    targetDistributionTotalCents: result.targetDistributionTotalCents,
    entriesUpdated: result.entries.length,
  });
}
