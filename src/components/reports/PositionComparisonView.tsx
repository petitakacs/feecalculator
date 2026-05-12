"use client";

import { formatCurrency } from "@/lib/format";

interface LocationRateRow {
  locationId: string;
  fixedHourlySZD: number;
}

interface PositionRow {
  id: string;
  name: string;
  fixedHourlySZD: number | null;
  locationRates: LocationRateRow[];
}

interface LocationRow {
  id: string;
  name: string;
}

interface ActualAvgMap {
  [positionId: string]: {
    [locationId: string]: number | null;
  };
}

interface PositionComparisonViewProps {
  positions: PositionRow[];
  locations: LocationRow[];
  actualAvg: ActualAvgMap;
}

export function PositionComparisonView({ positions, locations, actualAvg }: PositionComparisonViewProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500 min-w-[160px]">Pozíció</th>
            {locations.map((loc) => (
              <th key={loc.id} className="text-center px-4 py-3 font-medium text-gray-500 min-w-[140px]">
                {loc.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{pos.name}</td>
              {locations.map((loc) => {
                const locRate = pos.locationRates.find((r) => r.locationId === loc.id);
                const configuredRate = locRate?.fixedHourlySZD ?? pos.fixedHourlySZD ?? null;
                const avg = actualAvg[pos.id]?.[loc.id] ?? null;
                return (
                  <td key={loc.id} className="px-4 py-3 text-center">
                    {configuredRate != null ? (
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
                        {formatCurrency(configuredRate)}/óra
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                    {avg != null && (
                      <div className="mt-0.5 text-xs text-gray-400">
                        Átlag: {formatCurrency(Math.round(avg))}/óra
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {positions.length === 0 && (
            <tr>
              <td colSpan={locations.length + 1} className="px-4 py-8 text-center text-gray-400 text-sm">
                Nincsenek aktív pozíciók.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
