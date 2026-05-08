import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatPeriod, formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PeriodActions } from "@/components/periods/PeriodActions";

export default async function PeriodDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id: params.id },
    include: {
      season: true,
      approvals: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { entries: true } },
    },
  });

  if (!period) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/periods" className="text-gray-500 hover:text-gray-700">
              ← Periods
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatPeriod(period.month, period.year)}
            </h1>
            <StatusBadge status={period.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">Season: {period.season.name}</p>
        </div>
        <PeriodActions period={period} userRole={session.user.role} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Opening Balance</div>
          <div
            className={`text-lg font-bold ${period.openingBalance < 0 ? "text-red-600" : "text-green-600"}`}
          >
            {formatCurrency(period.openingBalance)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Collected SC</div>
          <div className="text-lg font-bold">
            {formatCurrency(period.collectedServiceCharge)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Distributable</div>
          <div className="text-lg font-bold">
            {formatCurrency(period.distributableBalance)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Target Distribution</div>
          <div className="text-lg font-bold">
            {formatCurrency(period.targetDistributionTotal)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Approved Distribution</div>
          <div className="text-lg font-bold">
            {formatCurrency(period.approvedDistributionTotal)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Closing Balance</div>
          <div
            className={`text-lg font-bold ${period.closingBalance < 0 ? "text-red-600" : "text-green-600"}`}
          >
            {formatCurrency(period.closingBalance)}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Period Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Season Mode</dt>
              <dd className="font-medium">{period.season.referenceMode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Entries</dt>
              <dd className="font-medium">{period._count.entries} employees</dd>
            </div>
            {period.notes && (
              <div className="pt-2">
                <dt className="text-gray-500">Notes</dt>
                <dd className="mt-1 text-gray-700">{period.notes}</dd>
              </div>
            )}
            {period.lockedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Locked At</dt>
                <dd className="font-medium">{formatDate(period.lockedAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Approval History</h2>
          {period.approvals.length > 0 ? (
            <div className="space-y-3">
              {period.approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-3 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      approval.action === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : approval.action === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : approval.action === "CLOSED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {approval.action}
                  </span>
                  <div>
                    <div className="font-medium">{approval.user.name}</div>
                    <div className="text-gray-500">
                      {formatDate(approval.createdAt.toString())}
                    </div>
                    {approval.comment && (
                      <div className="text-gray-700 mt-1">{approval.comment}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No approval actions yet.</p>
          )}
        </div>
      </div>

      {/* Quick link to allocation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Employee Allocation</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage worked hours, sales data, and service charge distribution
            </p>
          </div>
          <Link
            href={`/periods/${period.id}/allocation`}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
          >
            Open Allocation Table →
          </Link>
        </div>
      </div>
    </div>
  );
}
