import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/format";

export default async function SeasonsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { periods: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Seasons</h1>
        <Link
          href="/seasons/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        >
          + New Season
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Start Date</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">End Date</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Mode</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Periods</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {seasons.map((season) => (
              <tr key={season.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{season.name}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(season.startDate.toString())}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(season.endDate.toString())}</td>
                <td className="px-6 py-4 text-gray-500">
                  {season.referenceMode === "SALES_BASED"
                    ? "A: Sales Based"
                    : season.referenceMode === "MANUAL_TARGET"
                    ? "B: Manual Target"
                    : "C: Sales + Limits"}
                </td>
                <td className="px-6 py-4 text-right">{season._count.periods}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      season.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {season.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/seasons/${season.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
