import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PositionComparisonView } from "@/components/reports/PositionComparisonView";
import Link from "next/link";

export default async function PositionComparisonPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [positions, locations] = await Promise.all([
    prisma.position.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        locationRates: {
          select: { locationId: true, fixedHourlySZD: true },
        },
      },
    }),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Last 6 completed periods per location
  const recentPeriods = await prisma.monthlyPeriod.findMany({
    where: {
      status: { in: ["APPROVED", "CLOSED"] },
      locationId: { not: null },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, locationId: true },
    take: 6 * locations.length,
  });

  // Deduplicate: keep at most 6 per location
  const periodsByLocation: Record<string, string[]> = {};
  for (const p of recentPeriods) {
    if (!p.locationId) continue;
    if (!periodsByLocation[p.locationId]) periodsByLocation[p.locationId] = [];
    if (periodsByLocation[p.locationId].length < 6) {
      periodsByLocation[p.locationId].push(p.id);
    }
  }

  const allPeriodIds = Object.values(periodsByLocation).flat();

  // Fetch entries for those periods grouped by positionId
  const entries =
    allPeriodIds.length > 0
      ? await prisma.monthlyEmployeeEntry.findMany({
          where: {
            periodId: { in: allPeriodIds },
            workedHours: { gt: 0 },
            targetServiceChargeAmount: { not: null },
          },
          select: {
            periodId: true,
            positionId: true,
            workedHours: true,
            targetServiceChargeAmount: true,
            period: { select: { locationId: true } },
          },
        })
      : [];

  // Compute average (targetServiceChargeAmount / workedHours) per position × location
  type Acc = { totalAmount: number; totalHours: number };
  const accMap: Record<string, Record<string, Acc>> = {};

  for (const e of entries) {
    const locId = e.period.locationId;
    if (!locId) continue;
    const hours = Number(e.workedHours);
    const amount = e.targetServiceChargeAmount!;
    if (!accMap[e.positionId]) accMap[e.positionId] = {};
    if (!accMap[e.positionId][locId]) accMap[e.positionId][locId] = { totalAmount: 0, totalHours: 0 };
    accMap[e.positionId][locId].totalAmount += amount;
    accMap[e.positionId][locId].totalHours += hours;
  }

  const actualAvg: Record<string, Record<string, number | null>> = {};
  for (const [posId, locMap] of Object.entries(accMap)) {
    actualAvg[posId] = {};
    for (const [locId, acc] of Object.entries(locMap)) {
      actualAvg[posId][locId] = acc.totalHours > 0 ? acc.totalAmount / acc.totalHours : null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Riportok
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pozíció × Helyszín összehasonlítás</h1>
          <p className="mt-1 text-sm text-gray-500">
            Konfigurált fix óradíjak és tényleges átlagos keresetek helyszínenként
          </p>
        </div>
      </div>
      <PositionComparisonView
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          fixedHourlySZD: p.fixedHourlySZD ?? null,
          locationRates: p.locationRates,
        }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        actualAvg={actualAvg}
      />
    </div>
  );
}
