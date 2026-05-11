import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
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
        include: { employee: { include: { position: true, variation: true } }, position: true },
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
    // Resolve fixed hourly rate: variation > position (both optional)
    const variationFixed = entry.employee?.variation?.fixedHourlySZD ?? null;
    const positionFixed = entry.position.fixedHourlySZD ?? null;
    const resolvedFixed = variationFixed ?? positionFixed;

    // Multiplier path (used only when no fixed rate)
    const baseMultiplier = multiplierOverrideMap.get(entry.positionId) ??
      Number(entry.position.multiplier);
    const variationDelta = entry.employee?.variation?.multiplierDelta != null
      ? Number(entry.employee.variation.multiplierDelta)
      : 0;
    const positionMultiplier = baseMultiplier + variationDelta;

    allEntries.push({
      entryId: entry.id,
      employeeId: entry.employeeId,
      positionId: entry.positionId,
      multiplier: positionMultiplier,
      fixedHourlySZD: resolvedFixed,
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

  // For sales-based modes, require at least one waiter entry with positive sales
  const salesBasedMode = seasonParams.mode === "SALES_BASED" || seasonParams.mode === "SALES_BASED_WITH_LIMITS";
  if (salesBasedMode && waiterEntries.length === 0) {
    return NextResponse.json(
      { error: "Nincs pincér eladás rögzítve. Add meg az egyéni pincér eladásokat (Pincér eladás oszlop) a számítás előtt." },
      { status: 422 }
    );
  }
  if (salesBasedMode && waiterEntries.every((w) => w.netSalesCents === 0)) {
    return NextResponse.json(
      { error: "Minden pincér eladás 0 Ft. Ellenőrizd a beírt eladási értékeket." },
      { status: 422 }
    );
  }

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
          calculatedTargetNetHourlyServiceCharge: entryResult.targetNetHourlyServiceChargeCents,
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
      waiterReferenceHourlyRate: result.waiterReferenceHourlyRateCents,
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
