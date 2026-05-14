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

  // Use the first day of the period month as the reference date for all historical lookups.
  // This ensures that recalculating old periods uses the rates that were valid at that time.
  const periodDate = new Date(period.year, period.month - 1, 1);

  const businessRule = await prisma.businessRule.findFirst({
    where: {
      effectiveFrom: { lte: periodDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
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

  // Get season position/variation rules (multiplier overrides) and location rate overrides
  const [seasonPositionRules, seasonVariationRules, seasonPosLocationRates, seasonVarLocationRates] =
    await Promise.all([
      prisma.seasonPositionRule.findMany({ where: { seasonId: period.seasonId } }),
      prisma.seasonVariationRule.findMany({ where: { seasonId: period.seasonId } }),
      period.locationId
        ? prisma.seasonPositionLocationRate.findMany({ where: { seasonId: period.seasonId, locationId: period.locationId } })
        : Promise.resolve([]),
      period.locationId
        ? prisma.seasonVariationLocationRate.findMany({ where: { seasonId: period.seasonId, locationId: period.locationId } })
        : Promise.resolve([]),
    ]);

  // Season position: positionId -> { multiplier, fixedHourlySZD }
  const seasonPositionMap = new Map(
    seasonPositionRules.map((r) => [r.positionId, { multiplier: Number(r.multiplier), fixedHourlySZD: r.fixedHourlySZD ?? null }])
  );
  // Season variation: variationId -> { multiplierDelta, fixedHourlySZD }
  const seasonVariationMap = new Map(
    seasonVariationRules.map((r) => [r.variationId, { multiplierDelta: Number(r.multiplierDelta), fixedHourlySZD: r.fixedHourlySZD ?? null }])
  );
  // Season position+location rate: positionId -> fixedHourlySZD
  const seasonPosLocationMap = new Map(
    seasonPosLocationRates.map((r) => [r.positionId, r.fixedHourlySZD])
  );
  // Season variation+location rate: variationId -> fixedHourlySZD
  const seasonVarLocationMap = new Map(
    seasonVarLocationRates.map((r) => [r.variationId, r.fixedHourlySZD])
  );

  // Fetch all position rate histories effective at periodDate; fall back to static value if none.
  const positionRateHistories = await prisma.positionRateHistory.findMany({
    where: {
      effectiveFrom: { lte: periodDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  // One entry per position: most recent wins (orderBy desc + dedup by positionId)
  const positionRateMap = new Map<string, { multiplier: number; fixedHourlySZD: number | null }>();
  for (const h of positionRateHistories) {
    if (!positionRateMap.has(h.positionId)) {
      positionRateMap.set(h.positionId, {
        multiplier: Number(h.multiplier),
        fixedHourlySZD: h.fixedHourlySZD ?? null,
      });
    }
  }

  const variationRateHistories = await prisma.variationRateHistory.findMany({
    where: {
      effectiveFrom: { lte: periodDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const variationRateMap = new Map<string, { multiplierDelta: number; fixedHourlySZD: number | null }>();
  for (const h of variationRateHistories) {
    if (!variationRateMap.has(h.variationId)) {
      variationRateMap.set(h.variationId, {
        multiplierDelta: Number(h.multiplierDelta),
        fixedHourlySZD: h.fixedHourlySZD ?? null,
      });
    }
  }

  const [locationRates, variationLocationRates, locationRateHistories, variationLocationRateHistories] =
    period.locationId
      ? await Promise.all([
          prisma.positionLocationRate.findMany({ where: { locationId: period.locationId } }),
          prisma.variationLocationRate.findMany({ where: { locationId: period.locationId } }),
          prisma.positionLocationRateHistory.findMany({
            where: {
              locationId: period.locationId,
              effectiveFrom: { lte: periodDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
          }),
          prisma.variationLocationRateHistory.findMany({
            where: {
              locationId: period.locationId,
              effectiveFrom: { lte: periodDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
            },
            orderBy: { effectiveFrom: "desc" },
          }),
        ])
      : [[], [], [], []];

  // Build location-rate maps: history takes priority over static PositionLocationRate
  const locationRateMap = new Map<string, number>(locationRates.map((r) => [r.positionId, r.fixedHourlySZD]));
  for (const h of locationRateHistories) {
    if (!locationRateMap.has(h.positionId)) {
      locationRateMap.set(h.positionId, h.fixedHourlySZD);
    }
  }
  const variationLocationRateMap = new Map<string, number>(variationLocationRates.map((r) => [r.variationId, r.fixedHourlySZD]));
  for (const h of variationLocationRateHistories) {
    if (!variationLocationRateMap.has(h.variationId)) {
      variationLocationRateMap.set(h.variationId, h.fixedHourlySZD);
    }
  }

  // Identify waiter entries (position multiplier = 1.0, or waiter position by name)
  const waiterEntries: WaiterEntry[] = [];
  const allEntries: PositionEntry[] = [];

  for (const entry of period.entries) {
    const variationId = entry.employee?.variationId ?? null;

    // Resolve fixed hourly rate with full priority chain:
    // Season variation+location > Season position+location > date-based variation+location > date-based position+location
    //   > Season variation global (fixedHourlySZD) > Season position global (fixedHourlySZD)
    //   > history-based variation global > history-based position global > static fields
    const seasonVarLocFixed = variationId ? (seasonVarLocationMap.get(variationId) ?? null) : null;
    const seasonPosLocFixed = seasonPosLocationMap.get(entry.positionId) ?? null;
    const variationLocationFixed = variationId ? (variationLocationRateMap.get(variationId) ?? null) : null;
    const locationFixed = locationRateMap.get(entry.positionId) ?? null;

    const seasonVariation = variationId ? seasonVariationMap.get(variationId) : undefined;
    const variationHistorical = variationId ? variationRateMap.get(variationId) : undefined;
    const variationFixed =
      seasonVariation?.fixedHourlySZD ??
      variationHistorical?.fixedHourlySZD ??
      entry.employee?.variation?.fixedHourlySZD ??
      null;

    const seasonPosition = seasonPositionMap.get(entry.positionId);
    const positionHistorical = positionRateMap.get(entry.positionId);
    const positionFixed =
      seasonPosition?.fixedHourlySZD ??
      positionHistorical?.fixedHourlySZD ??
      entry.position.fixedHourlySZD ??
      null;

    const resolvedFixed =
      seasonVarLocFixed ?? seasonPosLocFixed ??
      variationLocationFixed ?? locationFixed ??
      variationFixed ?? positionFixed;

    // Multiplier path (used only when no fixed rate)
    // Season rule overrides take precedence, then history-based multiplier, then static field
    const baseMultiplier =
      seasonPosition?.multiplier ??
      positionHistorical?.multiplier ??
      Number(entry.position.multiplier);

    const variationDelta =
      seasonVariation?.multiplierDelta ??
      variationHistorical?.multiplierDelta ??
      (entry.employee?.variation?.multiplierDelta != null
        ? Number(entry.employee.variation.multiplierDelta)
        : 0);

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

  const isFixedRateMode = period.calculationMode === "FIXED_RATE";

  if (isFixedRateMode) {
    // In FIXED_RATE mode every entry must have a fixed hourly rate on its position/variation
    const missing = allEntries
      .filter((e) => e.fixedHourlySZD == null)
      .map((e) => {
        const entry = period.entries.find((pe) => pe.id === e.entryId);
        return entry?.employee?.name ?? e.employeeId;
      });
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Rögzített óradíj mód: a következő dolgozók pozíciójához nincs fix SZD óradíj beállítva: ${missing.join(", ")}. Menj a Pozíciók oldalra és állítsd be a fix óradíjat.`,
        },
        { status: 422 }
      );
    }
  } else {
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
