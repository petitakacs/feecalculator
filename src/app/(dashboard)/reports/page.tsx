import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const periods = await prisma.monthlyPeriod.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { season: true },
    take: 24,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and export service charge reports
        </p>
      </div>
      <ReportsView
        periods={periods.map((p) => ({
          id: p.id,
          month: p.month,
          year: p.year,
          seasonId: p.seasonId,
          season: {
            id: p.season.id,
            name: p.season.name,
            referenceMode: p.season.referenceMode,
            startDate: p.season.startDate.toISOString(),
            endDate: p.season.endDate.toISOString(),
            active: p.season.active,
            createdAt: p.season.createdAt.toISOString(),
            updatedAt: p.season.updatedAt.toISOString(),
          },
          openingBalance: p.openingBalance,
          collectedServiceCharge: p.collectedServiceCharge,
          distributableBalance: p.distributableBalance,
          targetDistributionTotal: p.targetDistributionTotal,
          approvedDistributionTotal: p.approvedDistributionTotal,
          closingBalance: p.closingBalance,
          status: p.status,
          notes: p.notes ?? undefined,
          lockedAt: p.lockedAt?.toISOString() ?? undefined,
          lockedBy: p.lockedBy ?? undefined,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
