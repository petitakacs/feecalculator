import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const refRate: number = Math.round(Number(body.refRateCents));
  if (!Number.isFinite(refRate) || refRate <= 0) {
    return NextResponse.json({ error: "Érvénytelen referencia óradíj" }, { status: 400 });
  }

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          employee: { include: { variation: true } },
          position: true,
        },
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  // Get season position rules (multiplier overrides)
  const seasonRules = await prisma.seasonPositionRule.findMany({
    where: { seasonId: period.seasonId },
  });
  const multiplierOverrideMap = new Map(
    seasonRules.map((r) => [r.positionId, Number(r.multiplier)])
  );

  // Recompute every entry using the new reference rate
  let targetDistributionTotal = 0;

  await Promise.all(
    period.entries.map(async (entry) => {
      const baseMultiplier =
        multiplierOverrideMap.get(entry.positionId) ?? Number(entry.position.multiplier);
      const variationDelta =
        entry.employee?.variation?.multiplierDelta != null
          ? Number(entry.employee.variation.multiplierDelta)
          : 0;
      const effectiveMultiplier = baseMultiplier + variationDelta;

      const targetNetHourlyServiceCharge = Math.round(refRate * effectiveMultiplier);
      const targetServiceChargeAmount = Math.round(
        targetNetHourlyServiceCharge * Number(entry.workedHours)
      );
      targetDistributionTotal += targetServiceChargeAmount;

      return prisma.monthlyEmployeeEntry.update({
        where: { id: entry.id },
        data: {
          targetNetHourlyServiceCharge,
          targetServiceChargeAmount,
          // Also update the "original calculated" value so the override indicator resets
          calculatedTargetNetHourlyServiceCharge: targetNetHourlyServiceCharge,
          // Clear any per-entry manual override since we're applying a new base rate
          overrideFlag: false,
        },
      });
    })
  );

  await prisma.monthlyPeriod.update({
    where: { id },
    data: {
      waiterReferenceHourlyRate: refRate,
      targetDistributionTotal,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "APPLY_REF_RATE",
    entityType: "MonthlyPeriod",
    entityId: id,
    periodId: id,
    after: { waiterReferenceHourlyRate: refRate, targetDistributionTotal },
  });

  return NextResponse.json({
    waiterReferenceHourlyRate: refRate,
    targetDistributionTotal,
    entriesUpdated: period.entries.length,
  });
}
