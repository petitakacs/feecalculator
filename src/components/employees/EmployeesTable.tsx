"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";
import { Role } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { useLocationFilter } from "@/lib/location-context";

interface EmployeeRow {
  id: string;
  name: string;
  positionName: string;
  variationName?: string;
  locationId?: string;
  baseSalaryType: string;
  baseSalaryAmount: number;
  startDate: string;
  active: boolean;
}

export function EmployeesTable({
  initialEmployees,
  userRole,
}: {
  initialEmployees: EmployeeRow[];
  userRole: Role;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const canWrite = hasPermission(userRole, "employees:write");
  const { selectedLocationId } = useLocationFilter();

  const handleToggle = async (emp: EmployeeRow) => {
    setToggling(emp.id);
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emp.active }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Hiba", "error");
        return;
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e))
      );
      showToast(emp.active ? `${emp.name} archiválva` : `${emp.name} aktiválva`, "success");
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setToggling(null);
    }
  };

  // Filter by session-level location (client-side, mirrors AllocationTable logic)
  const locationFiltered = selectedLocationId
    ? employees.filter((e) => !e.locationId || e.locationId === selectedLocationId)
    : employees;

  const visible = showInactive
    ? locationFiltered
    : locationFiltered.filter((e) => e.active);

  const inactiveCount = locationFiltered.filter((e) => !e.active).length;

  return (
    <div className="space-y-3">
      {inactiveCount > 0 && (
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {showInactive
            ? "Inaktív dolgozók elrejtése"
            : `Inaktív dolgozók mutatása (${inactiveCount} fő)`}
        </button>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Név</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Pozíció / változat</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Bér típusa</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Alapbér</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Kezdés dátuma</th>
              {canWrite && (
                <th className="text-center px-6 py-3 font-medium text-gray-500">Aktív</th>
              )}
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.map((emp) => (
              <tr
                key={emp.id}
                className={emp.active ? "hover:bg-gray-50" : "bg-gray-50 opacity-60"}
              >
                <td className="px-6 py-4 font-medium">
                  {emp.active ? emp.name : (
                    <span className="line-through text-gray-400">{emp.name}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span>{emp.positionName}</span>
                    {emp.variationName && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {emp.variationName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {emp.baseSalaryType === "HOURLY" ? "Órabér" : "Havi bér"}
                </td>
                <td className="px-6 py-4 text-right">{formatCurrency(emp.baseSalaryAmount)}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(emp.startDate)}</td>
                {canWrite && (
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggle(emp)}
                      disabled={toggling === emp.id}
                      title={emp.active ? "Archiválás" : "Aktiválás"}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                        emp.active ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          emp.active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                )}
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/employees/${emp.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Szerkesztés
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                  {selectedLocationId
                    ? "Ennél a lokációnál nincsenek dolgozók."
                    : "Nincsenek dolgozók."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
