"use client";

import { useState, useCallback } from "react";
import { MonthlyPeriod, MonthlyEmployeeEntry, Employee, Role } from "@/types";
import { formatCurrency, formatHours } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";
import { ExportButton } from "@/components/allocation/ExportButton";
import { ImportModal } from "@/components/allocation/ImportModal";
import { hasPermission } from "@/lib/permissions";

interface AllocationTableProps {
  period: MonthlyPeriod;
  initialEntries: MonthlyEmployeeEntry[];
  availableEmployees: Employee[];
  userRole: Role;
}

export function AllocationTable({
  period,
  initialEntries,
  availableEmployees,
  userRole,
}: AllocationTableProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const isLocked =
    period.status === "CLOSED" || period.status === "APPROVED";
  const canWrite = hasPermission(userRole, "periods:write");
  const canApprove =
    userRole === "ADMIN" || userRole === "BUSINESS_UNIT_LEAD";
  const canSubmit = hasPermission(userRole, "periods:submit");

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/calculate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Calculation failed", "error");
        return;
      }
      const data = await res.json();
      showToast(
        `Calculation complete. Waiter reference rate: €${(data.waiterReferenceHourlyRateCents / 100).toFixed(2)}/hr`,
        "success"
      );
      // Refresh entries
      const entriesRes = await fetch(`/api/periods/${period.id}/entries`);
      if (entriesRes.ok) {
        const updatedEntries = await entriesRes.json();
        setEntries(updatedEntries);
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setCalculating(false);
    }
  };

  const handleAction = async (
    action: string,
    comment?: string
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Action failed", "error");
        return;
      }
      showToast(`Action ${action} completed`, "success");
      window.location.reload();
    } catch {
      showToast("Network error", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddEmployee = async (employeeId: string) => {
    const res = await fetch(`/api/periods/${period.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error ?? "Failed to add employee", "error");
      return;
    }
    const newEntry = await res.json();
    setEntries((prev) => {
      const exists = prev.find((e) => e.id === newEntry.id);
      if (exists) return prev;
      return [...prev, newEntry];
    });
    showToast("Employee added", "success");
  };

  const startEdit = (entry: MonthlyEmployeeEntry) => {
    setEditingEntryId(entry.id);
    setEditValues({
      workedHours: String(entry.workedHours),
      overtimeHours: String(entry.overtimeHours),
      netWaiterSales: entry.netWaiterSales != null ? String(entry.netWaiterSales / 100) : "",
      bonus: String(entry.bonus / 100),
      overtimePayment: String(entry.overtimePayment / 100),
      manualCorrection: String(entry.manualCorrection / 100),
      finalApprovedAmount: entry.finalApprovedAmount != null ? String(entry.finalApprovedAmount / 100) : "",
      notes: entry.notes ?? "",
    });
  };

  const saveEdit = async (entry: MonthlyEmployeeEntry) => {
    const updateData: Record<string, unknown> = {
      workedHours: parseFloat(editValues.workedHours) || 0,
      overtimeHours: parseFloat(editValues.overtimeHours) || 0,
      bonus: Math.round((parseFloat(editValues.bonus) || 0) * 100),
      overtimePayment: Math.round((parseFloat(editValues.overtimePayment) || 0) * 100),
      manualCorrection: Math.round((parseFloat(editValues.manualCorrection) || 0) * 100),
      notes: editValues.notes || null,
    };

    if (editValues.netWaiterSales !== "") {
      updateData.netWaiterSales = Math.round((parseFloat(editValues.netWaiterSales) || 0) * 100);
    }

    if (editValues.finalApprovedAmount !== "") {
      updateData.finalApprovedAmount = Math.round((parseFloat(editValues.finalApprovedAmount) || 0) * 100);
      const targetAmount =
        (entry.targetServiceChargeAmount ?? 0) +
        Math.round((parseFloat(editValues.bonus) || 0) * 100) +
        Math.round((parseFloat(editValues.overtimePayment) || 0) * 100) +
        Math.round((parseFloat(editValues.manualCorrection) || 0) * 100);
      if ((updateData.finalApprovedAmount as number) !== targetAmount) {
        updateData.overrideFlag = true;
      }
    }

    const res = await fetch(`/api/periods/${period.id}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: entry.id, ...updateData }),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error ?? "Save failed", "error");
      return;
    }

    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    setEditingEntryId(null);
    showToast("Entry saved", "success");
  };

  const addableEmployees = availableEmployees.filter(
    (emp) => !entries.some((e) => e.employeeId === emp.id)
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Balance:</span>
          <span
            className={`font-bold ${period.distributableBalance < 0 ? "text-red-600" : "text-green-600"}`}
          >
            {formatCurrency(period.distributableBalance)}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">Target:</span>
          <span className="font-bold">{formatCurrency(period.targetDistributionTotal)}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!isLocked && canWrite && (
            <>
              {/* Add employee dropdown */}
              {addableEmployees.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddEmployee(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                >
                  <option value="">+ Add Employee</option>
                  {addableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position?.name})
                    </option>
                  ))}
                </select>
              )}

              <ImportModal periodId={period.id} />

              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {calculating ? "Calculating..." : "Calculate"}
              </button>
            </>
          )}

          <ExportButton periodId={period.id} />

          {/* Status actions */}
          {!isLocked && period.status === "DRAFT" && canSubmit && (
            <button
              onClick={() => handleAction("SUBMITTED")}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Submit for Approval
            </button>
          )}
          {period.status === "PENDING_APPROVAL" && canApprove && (
            <>
              <button
                onClick={() => handleAction("APPROVED")}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const comment = prompt("Reason for rejection:");
                  if (comment !== null) handleAction("REJECTED", comment);
                }}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {period.status === "APPROVED" && canApprove && (
            <button
              onClick={() => handleAction("CLOSED")}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Close Period
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">Employee</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Position</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Hours</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">OT Hrs</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Waiter Sales</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Gross SC</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Net SC</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Target/hr</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Target SC</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Bonus</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">OT Pay</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Correction</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Final Target</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Approved</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Override</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Notes</th>
              {!isLocked && canWrite && (
                <th className="px-3 py-2"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              const finalTarget =
                (entry.targetServiceChargeAmount ?? 0) +
                entry.bonus +
                entry.overtimePayment +
                entry.manualCorrection;

              return (
                <tr
                  key={entry.id}
                  className={`${
                    entry.overrideFlag ? "bg-yellow-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-3 py-2 font-medium sticky left-0 bg-inherit z-10">
                    {entry.employee?.name ?? entry.employeeId}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {entry.position?.name ?? entry.positionId}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.workedHours}
                        onChange={(e) => setEditValues((v) => ({ ...v, workedHours: e.target.value }))}
                        className="w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      formatHours(entry.workedHours)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.overtimeHours}
                        onChange={(e) => setEditValues((v) => ({ ...v, overtimeHours: e.target.value }))}
                        className="w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      formatHours(entry.overtimeHours)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.netWaiterSales}
                        onChange={(e) => setEditValues((v) => ({ ...v, netWaiterSales: e.target.value }))}
                        placeholder="0.00"
                        className="w-20 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : entry.netWaiterSales != null ? (
                      formatCurrency(entry.netWaiterSales)
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {entry.calculatedGrossServiceCharge != null
                      ? formatCurrency(entry.calculatedGrossServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {entry.calculatedNetServiceCharge != null
                      ? formatCurrency(entry.calculatedNetServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {entry.targetNetHourlyServiceCharge != null
                      ? formatCurrency(entry.targetNetHourlyServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {entry.targetServiceChargeAmount != null
                      ? formatCurrency(entry.targetServiceChargeAmount)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.bonus}
                        onChange={(e) => setEditValues((v) => ({ ...v, bonus: e.target.value }))}
                        className="w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      formatCurrency(entry.bonus)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.overtimePayment}
                        onChange={(e) => setEditValues((v) => ({ ...v, overtimePayment: e.target.value }))}
                        className="w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      formatCurrency(entry.overtimePayment)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.manualCorrection}
                        onChange={(e) => setEditValues((v) => ({ ...v, manualCorrection: e.target.value }))}
                        className="w-16 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      formatCurrency(entry.manualCorrection)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(finalTarget)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.finalApprovedAmount}
                        onChange={(e) => setEditValues((v) => ({ ...v, finalApprovedAmount: e.target.value }))}
                        placeholder="Same as target"
                        className="w-20 text-right border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : entry.finalApprovedAmount != null ? (
                      formatCurrency(entry.finalApprovedAmount)
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.overrideFlag && (
                      <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-medium">
                        YES
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValues.notes}
                        onChange={(e) => setEditValues((v) => ({ ...v, notes: e.target.value }))}
                        className="w-32 border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    ) : (
                      entry.notes ?? ""
                    )}
                  </td>
                  {!isLocked && canWrite && (
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(entry)}
                            className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingEntryId(null)}
                            className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(entry)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={17} className="px-4 py-8 text-center text-gray-500">
                  No entries yet. Add employees or import a file.
                </td>
              </tr>
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot className="bg-gray-50 border-t font-medium text-xs">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-gray-50" colSpan={8}>Totals</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(entries.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(entries.reduce((s, e) => s + e.bonus, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(entries.reduce((s, e) => s + e.overtimePayment, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(entries.reduce((s, e) => s + e.manualCorrection, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(
                    entries.reduce(
                      (s, e) =>
                        s +
                        (e.targetServiceChargeAmount ?? 0) +
                        e.bonus +
                        e.overtimePayment +
                        e.manualCorrection,
                      0
                    )
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(entries.reduce((s, e) => s + (e.finalApprovedAmount ?? 0), 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isLocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          This period is {period.status.toLowerCase()}. No modifications are allowed.
        </div>
      )}
    </div>
  );
}
