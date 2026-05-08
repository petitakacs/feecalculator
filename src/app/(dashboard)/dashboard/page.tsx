import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BalanceSummaryCard } from "@/components/dashboard/BalanceSummaryCard";
import { WarningsPanel } from "@/components/dashboard/WarningsPanel";
import { formatPeriod } from "@/lib/format";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  // Get the latest period
  const latestPeriod = await prisma.monthlyPeriod.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { season: true },
  });

  // Get periods pending approval
  const pendingPeriods = await prisma.monthlyPeriod.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const warnings = [];

  if (
    latestPeriod &&
    latestPeriod.closingBalance < -50000 // -500 EUR threshold
  ) {
    warnings.push({
      type: "negative_balance" as const,
      message: `Closing balance is negative: ${(latestPeriod.closingBalance / 100).toFixed(2)} EUR`,
      severity: "error" as const,
    });
  }

  if (pendingPeriods.length > 0) {
    warnings.push({
      type: "pending_approval" as const,
      message: `${pendingPeriods.length} period(s) pending approval`,
      severity: "warning" as const,
    });
  }

  // Get all periods summary for the current year
  const currentYear = new Date().getFullYear();
  const yearPeriods = await prisma.monthlyPeriod.findMany({
    where: { year: currentYear },
    orderBy: { month: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {latestPeriod && (
          <span className="text-sm text-gray-500">
            Latest: {formatPeriod(latestPeriod.month, latestPeriod.year)}
          </span>
        )}
      </div>

      {latestPeriod ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BalanceSummaryCard
            title="Collected Service Charge"
            amount={latestPeriod.collectedServiceCharge}
            description="This month"
          />
          <BalanceSummaryCard
            title="Opening Balance"
            amount={latestPeriod.openingBalance}
            description="Carried forward"
          />
          <BalanceSummaryCard
            title="Distributable Balance"
            amount={latestPeriod.distributableBalance}
            description="Available for distribution"
          />
          <BalanceSummaryCard
            title="Target Distribution"
            amount={latestPeriod.targetDistributionTotal}
            description="Calculated target"
          />
          <BalanceSummaryCard
            title="Approved Distribution"
            amount={latestPeriod.approvedDistributionTotal}
            description="Approved for payout"
          />
          <BalanceSummaryCard
            title="Closing Balance"
            amount={latestPeriod.closingBalance}
            description="Carry to next month"
            highlight={latestPeriod.closingBalance < 0 ? "negative" : latestPeriod.closingBalance > 0 ? "positive" : "neutral"}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg p-8 text-center">
          <p className="text-gray-500">No periods found.</p>
          <Link
            href="/periods"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Create your first period
          </Link>
        </div>
      )}

      <WarningsPanel warnings={warnings} />

      {yearPeriods.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {currentYear} Period Overview
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Collected</th>
                  <th className="text-right py-2">Distribution</th>
                  <th className="text-right py-2">Closing Balance</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {yearPeriods.map((period) => (
                  <tr key={period.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      <Link
                        href={`/periods/${period.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {formatPeriod(period.month, period.year)}
                      </Link>
                    </td>
                    <td className="text-right py-2">
                      €{(period.collectedServiceCharge / 100).toFixed(2)}
                    </td>
                    <td className="text-right py-2">
                      €{(period.approvedDistributionTotal / 100).toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-2 font-medium ${
                        period.closingBalance < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      €{(period.closingBalance / 100).toFixed(2)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          period.status === "DRAFT"
                            ? "bg-gray-100 text-gray-800"
                            : period.status === "PENDING_APPROVAL"
                            ? "bg-yellow-100 text-yellow-800"
                            : period.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {period.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
