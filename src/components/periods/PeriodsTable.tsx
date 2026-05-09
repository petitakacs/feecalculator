"use client";

import Link from "next/link";
import { formatPeriod, formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeletePeriodButton } from "@/components/periods/DeletePeriodButton";
import { useLocationFilter } from "@/lib/location-context";
import { PeriodStatus } from "@/types";

interface PeriodRow {
  id: string;
  month: number;
  year: number;
  status: PeriodStatus;
  collectedServiceCharge: number;
  openingBalance: number;
  closingBalance: number;
  locationId: string | null;
  location: { id: string; name: string } | null;
  season: { name: string };
}

interface PeriodsTableProps {
  periods: PeriodRow[];
  canDelete: boolean;
}

export function PeriodsTable({ periods, canDelete }: PeriodsTableProps) {
  const { selectedLocationId } = useLocationFilter();

  const filtered = selectedLocationId
    ? periods.filter((p) => p.locationId === selectedLocationId)
    : periods;

  return (
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
          {filtered.map((period) => (
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
              <td className={`px-6 py-4 text-right font-medium ${period.closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>
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
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                {selectedLocationId
                  ? "Nincs periódus ehhez a lokációhoz."
                  : "Még nincs periódus. Hozd létre az első periódust."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
