import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPeriod } from "@/lib/format";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    select: { month: true, year: true, locationId: true },
  });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

  const { month, year, locationId } = period;

  // Compute prev month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;

  // Compute prev year same month
  const prevYearSameMonthMonth = month;
  const prevYearSameMonthYear = year - 1;

  // Fetch relevant periods
  const [prevMonthPeriod, prevYearSameMonthPeriod, prevYearPeriods] = await Promise.all([
    prisma.monthlyPeriod.findFirst({
      where: { locationId: locationId ?? null, month: prevMonth, year: prevMonthYear },
      include: {
        entries: {
          select: { employeeId: true, finalApprovedAmount: true, targetServiceChargeAmount: true },
        },
      },
    }),
    prisma.monthlyPeriod.findFirst({
      where: { locationId: locationId ?? null, month: prevYearSameMonthMonth, year: prevYearSameMonthYear },
      include: {
        entries: {
          select: { employeeId: true, finalApprovedAmount: true, targetServiceChargeAmount: true },
        },
      },
    }),
    prisma.monthlyPeriod.findMany({
      where: { locationId: locationId ?? null, year: year - 1 },
      include: {
        entries: {
          select: { employeeId: true, finalApprovedAmount: true, targetServiceChargeAmount: true },
        },
      },
    }),
  ]);

  // Helper to get the effective amount for an entry
  const effectiveAmount = (e: { finalApprovedAmount: number | null; targetServiceChargeAmount: number | null }) =>
    e.finalApprovedAmount ?? e.targetServiceChargeAmount ?? null;

  // Build prevMonth map
  const prevMonthMap: Record<string, number> = {};
  if (prevMonthPeriod) {
    for (const e of prevMonthPeriod.entries) {
      const amt = effectiveAmount(e);
      if (amt != null) prevMonthMap[e.employeeId] = amt;
    }
  }

  // Build prevYearSameMonth map
  const prevYearSameMonthMap: Record<string, number> = {};
  if (prevYearSameMonthPeriod) {
    for (const e of prevYearSameMonthPeriod.entries) {
      const amt = effectiveAmount(e);
      if (amt != null) prevYearSameMonthMap[e.employeeId] = amt;
    }
  }

  // Build prevYearAvg map: for each employee, average across all prev year periods they appear in
  const prevYearSums: Record<string, { total: number; count: number }> = {};
  for (const p of prevYearPeriods) {
    for (const e of p.entries) {
      const amt = effectiveAmount(e);
      if (amt != null) {
        if (!prevYearSums[e.employeeId]) prevYearSums[e.employeeId] = { total: 0, count: 0 };
        prevYearSums[e.employeeId].total += amt;
        prevYearSums[e.employeeId].count += 1;
      }
    }
  }
  const prevYearAvgMap: Record<string, number> = {};
  for (const [empId, { total, count }] of Object.entries(prevYearSums)) {
    prevYearAvgMap[empId] = Math.round(total / count);
  }

  return NextResponse.json({
    prevMonth: prevMonthMap,
    prevYearSameMonth: prevYearSameMonthMap,
    prevYearAvg: prevYearAvgMap,
    prevMonthLabel: formatPeriod(prevMonth, prevMonthYear),
    prevYearSameMonthLabel: formatPeriod(prevYearSameMonthMonth, prevYearSameMonthYear),
    prevYearLabel: String(year - 1),
  });
}
