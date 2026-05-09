import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatPeriod, formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreatePeriodButton } from "@/components/periods/CreatePeriodButton";
import { DeletePeriodButton } from "@/components/periods/DeletePeriodButton";
import { hasPermission } from "@/lib/permissions";

export default async function PeriodsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [periods, seasons, locations] = await Promise.all([
    prisma.monthlyPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { season: true, location: true },
    }),
    prisma.season.findMany({ where: { active: true } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const canDelete = hasPermission(session.user.role, "periods:delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Periods</h1>
        <CreatePeriodButton
          seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Period</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Lokáció</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Season</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Collected SC</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Opening Balance</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Closing Balance</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {periods.map((period) => (
              <tr key={period.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">
                  {formatPeriod(period.month, period.year)}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {period.location?.name ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-6 py-4 text-gray-500">{period.season.name}</td>
                <td className="px-6 py-4 text-right">
                  {formatCurrency(period.collectedServiceCharge)}
                </td>
                <td className="px-6 py-4 text-right">
                  {formatCurrency(period.openingBalance)}
                </td>
                <td
                  className={`px-6 py-4 text-right font-medium ${
                    period.closingBalance < 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatCurrency(period.closingBalance)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={period.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {canDelete && period.status === "DRAFT" && (
                      <DeletePeriodButton
                        periodId={period.id}
                        periodLabel={formatPeriod(period.month, period.year)}
                      />
                    )}
                    <Link
                      href={`/periods/${period.id}/allocation`}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 font-medium"
                    >
                      Tábla →
                    </Link>
                    <Link
                      href={`/periods/${period.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Megnyit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No periods yet. Create your first period to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
