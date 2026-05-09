"use client";

import { useState, useCallback, useRef } from "react";
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

interface RowValues {
  workedHours: string;
  overtimeHours: string;
  netWaiterSales: string;
  bonus: string;
  overtimePayment: string;
  manualCorrection: string;
  finalApprovedAmount: string;
  notes: string;
}

function entryToRowValues(entry: MonthlyEmployeeEntry): RowValues {
  return {
    workedHours: String(entry.workedHours),
    overtimeHours: String(entry.overtimeHours),
    netWaiterSales: entry.netWaiterSales != null ? String(entry.netWaiterSales) : "",
    bonus: String(entry.bonus),
    overtimePayment: String(entry.overtimePayment),
    manualCorrection: String(entry.manualCorrection),
    finalApprovedAmount: entry.finalApprovedAmount != null ? String(entry.finalApprovedAmount) : "",
    notes: entry.notes ?? "",
  };
}

export function AllocationTable({
  period,
  initialEntries,
  availableEmployees,
  userRole,
}: AllocationTableProps) {
  const [entries, setEntries] = useState<MonthlyEmployeeEntry[]>(initialEntries);
  const [rowValues, setRowValues] = useState<Record<string, RowValues>>(() => {
    const map: Record<string, RowValues> = {};
    for (const e of initialEntries) {
      map[e.id] = entryToRowValues(e);
    }
    return map;
  });
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [addingAll, setAddingAll] = useState(false);

  // Track latest row values via ref so blur handler sees current values
  const rowValuesRef = useRef(rowValues);
  rowValuesRef.current = rowValues;

  const isLocked =
    period.status === "CLOSED" || period.status === "APPROVED";
  const canWrite = hasPermission(userRole, "periods:write");
  const canApprove =
    userRole === "ADMIN" || userRole === "BUSINESS_UNIT_LEAD";
  const canSubmit = hasPermission(userRole, "periods:submit");

  const editable = !isLocked && canWrite;

  // ---- Derived summary numbers ----
  const totalApproved = entries.reduce((s, e) => s + (e.finalApprovedAmount ?? 0), 0);
  const totalTarget = entries.reduce(
    (s, e) =>
      s +
      (e.targetServiceChargeAmount ?? 0) +
      e.bonus +
      e.overtimePayment +
      e.manualCorrection,
    0
  );
  const closingBalance = period.distributableBalance - totalApproved;

  // ---- Field update helper ----
  const updateField = useCallback(
    (entryId: string, field: keyof RowValues, value: string) => {
      setRowValues((prev) => ({
        ...prev,
        [entryId]: { ...prev[entryId], [field]: value },
      }));
      setDirtyRows((prev) => new Set(prev).add(entryId));
    },
    []
  );

  // ---- Auto-save on blur ----
  const handleBlurSave = useCallback(
    async (entry: MonthlyEmployeeEntry) => {
      const vals = rowValuesRef.current[entry.id];
      if (!vals) return;

      setSavingRows((prev) => new Set(prev).add(entry.id));
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });

      const updateData: Record<string, unknown> = {
        workedHours: parseFloat(vals.workedHours) || 0,
        overtimeHours: parseFloat(vals.overtimeHours) || 0,
        bonus: Math.round(parseFloat(vals.bonus) || 0),
        overtimePayment: Math.round(parseFloat(vals.overtimePayment) || 0),
        manualCorrection: Math.round(parseFloat(vals.manualCorrection) || 0),
        notes: vals.notes || null,
      };

      if (vals.netWaiterSales !== "") {
        updateData.netWaiterSales = Math.round(parseFloat(vals.netWaiterSales) || 0);
      }

      if (vals.finalApprovedAmount !== "") {
        const approvedAmt = Math.round(parseFloat(vals.finalApprovedAmount) || 0);
        updateData.finalApprovedAmount = approvedAmt;
        const computedTarget =
          (entry.targetServiceChargeAmount ?? 0) +
          Math.round(parseFloat(vals.bonus) || 0) +
          Math.round(parseFloat(vals.overtimePayment) || 0) +
          Math.round(parseFloat(vals.manualCorrection) || 0);
        if (approvedAmt !== computedTarget) {
          updateData.overrideFlag = true;
        }
      }

      try {
        const res = await fetch(`/api/periods/${period.id}/entries`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: entry.id, ...updateData }),
        });

        if (!res.ok) {
          const err = await res.json();
          showToast(err.error ?? "Mentés sikertelen", "error");
          setDirtyRows((prev) => new Set(prev).add(entry.id));
          return;
        }

        const updated: MonthlyEmployeeEntry = await res.json();
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
        setRowValues((prev) => ({
          ...prev,
          [entry.id]: entryToRowValues(updated),
        }));
      } catch {
        showToast("Hálózati hiba", "error");
        setDirtyRows((prev) => new Set(prev).add(entry.id));
      } finally {
        setSavingRows((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      }
    },
    [period.id]
  );

  // ---- Calculate ----
  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/calculate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Számítás sikertelen", "error");
        return;
      }
      const data = await res.json();
      showToast(
        `Számítás kész. Pincér referencia díj: ${formatCurrency(data.waiterReferenceHourlyRateCents)}/óra`,
        "success"
      );
      const entriesRes = await fetch(`/api/periods/${period.id}/entries`);
      if (entriesRes.ok) {
        const updatedEntries: MonthlyEmployeeEntry[] = await entriesRes.json();
        setEntries(updatedEntries);
        const map: Record<string, RowValues> = {};
        for (const e of updatedEntries) {
          map[e.id] = entryToRowValues(e);
        }
        setRowValues(map);
        setDirtyRows(new Set());
      }
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setCalculating(false);
    }
  };

  // ---- Workflow actions ----
  const handleAction = async (action: string, comment?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Művelet sikertelen", "error");
        return;
      }
      showToast(`${action} sikeresen végrehajtva`, "success");
      window.location.reload();
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Add single employee ----
  const handleAddEmployee = async (employeeId: string) => {
    const res = await fetch(`/api/periods/${period.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error ?? "Hozzáadás sikertelen", "error");
      return;
    }
    const newEntry: MonthlyEmployeeEntry = await res.json();
    setEntries((prev) => {
      const exists = prev.find((e) => e.id === newEntry.id);
      if (exists) return prev;
      return [...prev, newEntry];
    });
    setRowValues((prev) => ({
      ...prev,
      [newEntry.id]: entryToRowValues(newEntry),
    }));
    showToast("Dolgozó hozzáadva", "success");
  };

  // ---- Add ALL active employees at once ----
  const handleAddAllEmployees = async () => {
    if (addableEmployees.length === 0) return;
    setAddingAll(true);
    try {
      const employeeIds = addableEmployees.map((e) => e.id);
      const res = await fetch(`/api/periods/${period.id}/entries/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Tömeges hozzáadás sikertelen", "error");
        return;
      }
      const result = await res.json();
      // Refresh entries list
      const entriesRes = await fetch(`/api/periods/${period.id}/entries`);
      if (entriesRes.ok) {
        const updatedEntries: MonthlyEmployeeEntry[] = await entriesRes.json();
        setEntries(updatedEntries);
        const map: Record<string, RowValues> = {};
        for (const e of updatedEntries) {
          map[e.id] = entryToRowValues(e);
        }
        setRowValues(map);
      }
      showToast(
        `${result.created} dolgozó hozzáadva, ${result.skipped} már szerepelt`,
        "success"
      );
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setAddingAll(false);
    }
  };

  const addableEmployees = availableEmployees.filter(
    (emp) => !entries.some((e) => e.employeeId === emp.id)
  );

  // ---- Input cell helper ----
  const inputCell = (
    entry: MonthlyEmployeeEntry,
    field: keyof RowValues,
    width: string,
    type: "number" | "text" = "number",
    placeholder?: string
  ) => {
    const vals = rowValues[entry.id];
    const value = vals ? vals[field] : "";
    if (editable) {
      return (
        <input
          type={type}
          value={value}
          onChange={(e) => updateField(entry.id, field, e.target.value)}
          onBlur={() => handleBlurSave(entry)}
          placeholder={placeholder}
          className={`${width} text-right border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white`}
        />
      );
    }
    // read-only display
    if (type === "text") return <span>{value}</span>;
    if (value === "") return <span className="text-gray-300">-</span>;
    return <span>{value}</span>;
  };

  return (
    <div className="space-y-4">
      {/* ── Summary Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Felosztható egyenleg</div>
          <div className={`text-xl font-bold mt-1 ${period.distributableBalance < 0 ? "text-red-600" : "text-blue-700"}`}>
            {formatCurrency(period.distributableBalance)}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Cél szétosztás</div>
          <div className="text-xl font-bold mt-1 text-green-700">
            {formatCurrency(totalTarget)}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Jóváhagyott összeg</div>
          <div className="text-xl font-bold mt-1 text-purple-700">
            {formatCurrency(totalApproved)}
          </div>
        </div>
        <div className={`${closingBalance < 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded-lg px-4 py-3`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>
            Várható záróegyenleg
          </div>
          <div className={`text-xl font-bold mt-1 ${closingBalance < 0 ? "text-red-700" : "text-green-700"}`}>
            {formatCurrency(closingBalance)}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow p-4">
        {editable && (
          <>
            {addableEmployees.length > 0 && (
              <>
                {/* One-click add all */}
                <button
                  onClick={handleAddAllEmployees}
                  disabled={addingAll}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {addingAll
                    ? "Hozzáadás..."
                    : `Összes hozzáadása (${addableEmployees.length} dolgozó)`}
                </button>

                {/* Individual add dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddEmployee(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
                >
                  <option value="">+ Egyéni hozzáadás</option>
                  {addableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position?.name})
                    </option>
                  ))}
                </select>
              </>
            )}

            <ImportModal periodId={period.id} />

            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? "Számítás..." : "Számítás"}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ExportButton periodId={period.id} />

          {!isLocked && period.status === "DRAFT" && canSubmit && (
            <button
              onClick={() => handleAction("SUBMITTED")}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Jóváhagyásra küld
            </button>
          )}
          {period.status === "PENDING_APPROVAL" && canApprove && (
            <>
              <button
                onClick={() => handleAction("APPROVED")}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Jóváhagy
              </button>
              <button
                onClick={() => {
                  const comment = prompt("Visszaküldés oka:");
                  if (comment !== null) handleAction("REJECTED", comment);
                }}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Visszaküld
              </button>
            </>
          )}
          {period.status === "APPROVED" && canApprove && (
            <button
              onClick={() => handleAction("CLOSED")}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Periódus lezárása
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            {/* Column group headers */}
            <tr>
              {/* sticky name col */}
              <th
                rowSpan={2}
                className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 border-b border-r border-gray-200 sticky left-0 z-20"
              >
                Dolgozó
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 border-b border-r border-gray-200"
              >
                Pozíció
              </th>
              {/* Group 1: Bevitel */}
              <th
                colSpan={3}
                className="px-3 py-1 text-center text-xs font-bold text-blue-700 bg-blue-100 border-b border-blue-200"
              >
                Bevitel
              </th>
              {/* Group 2: Számított */}
              <th
                colSpan={2}
                className="px-3 py-1 text-center text-xs font-bold text-gray-700 bg-gray-200 border-b border-gray-300"
              >
                Számított
              </th>
              {/* Group 3: Célértékek */}
              <th
                colSpan={2}
                className="px-3 py-1 text-center text-xs font-bold text-green-700 bg-green-100 border-b border-green-200"
              >
                Célértékek
              </th>
              {/* Group 4: Kiegészítők */}
              <th
                colSpan={3}
                className="px-3 py-1 text-center text-xs font-bold text-yellow-800 bg-yellow-100 border-b border-yellow-200"
              >
                Kiegészítők
              </th>
              {/* Group 5: Összesítés */}
              <th
                colSpan={2}
                className="px-3 py-1 text-center text-xs font-bold text-purple-700 bg-purple-100 border-b border-purple-200"
              >
                Összesítés
              </th>
              {/* Notes / status */}
              <th
                rowSpan={2}
                className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-100 border-b border-gray-200"
              >
                Megjegyzés
              </th>
              <th
                rowSpan={2}
                className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-center text-gray-600 font-semibold"
              >
                Állapot
              </th>
            </tr>
            <tr>
              {/* Bevitel sub-cols */}
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100">
                Ledolg. óra
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100">
                Túlóra
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100 border-r border-blue-100">
                Pincér eladás nettó
              </th>
              {/* Számított sub-cols */}
              <th className="px-3 py-1.5 text-right font-medium text-gray-600 bg-gray-100 border-b border-gray-200">
                Bruttó SZD
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-600 bg-gray-100 border-b border-gray-200 border-r border-gray-200">
                Nettó SZD
              </th>
              {/* Célértékek sub-cols */}
              <th className="px-3 py-1.5 text-right font-medium text-green-600 bg-green-50 border-b border-green-100">
                Célóradíj
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-green-600 bg-green-50 border-b border-green-100 border-r border-green-100">
                Cél SZD
              </th>
              {/* Kiegészítők sub-cols */}
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100">
                Prémium
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100">
                Túlóra kif.
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100 border-r border-yellow-100">
                Korrekció
              </th>
              {/* Összesítés sub-cols */}
              <th className="px-3 py-1.5 text-right font-medium text-purple-600 bg-purple-50 border-b border-purple-100">
                Végső cél
              </th>
              <th className="px-3 py-1.5 text-right font-medium text-purple-600 bg-purple-50 border-b border-purple-100 border-r border-purple-100">
                Jóváhagyott
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const isSaving = savingRows.has(entry.id);
              const isDirty = dirtyRows.has(entry.id);
              const finalTarget =
                (entry.targetServiceChargeAmount ?? 0) +
                entry.bonus +
                entry.overtimePayment +
                entry.manualCorrection;
              const isOverride = entry.overrideFlag;

              return (
                <tr
                  key={entry.id}
                  className={`${
                    isOverride
                      ? "bg-yellow-50"
                      : isDirty
                      ? "bg-amber-50"
                      : "hover:bg-gray-50"
                  } ${isDirty ? "border-l-4 border-l-amber-400" : ""}`}
                >
                  {/* Sticky name */}
                  <td className="px-3 py-2 font-medium sticky left-0 bg-inherit z-10 border-r border-gray-100">
                    {entry.employee?.name ?? entry.employeeId}
                  </td>
                  <td className="px-3 py-2 text-gray-500 border-r border-gray-100">
                    {entry.position?.name ?? entry.positionId}
                  </td>

                  {/* Bevitel */}
                  <td className="px-2 py-1.5 text-right bg-blue-50/30">
                    {inputCell(entry, "workedHours", "w-16")}
                  </td>
                  <td className="px-2 py-1.5 text-right bg-blue-50/30">
                    {inputCell(entry, "overtimeHours", "w-16")}
                  </td>
                  <td className="px-2 py-1.5 text-right bg-blue-50/30 border-r border-blue-100">
                    {inputCell(entry, "netWaiterSales", "w-20", "number", "0")}
                  </td>

                  {/* Számított */}
                  <td className="px-3 py-1.5 text-right text-gray-600">
                    {entry.calculatedGrossServiceCharge != null
                      ? formatCurrency(entry.calculatedGrossServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-600 border-r border-gray-100">
                    {entry.calculatedNetServiceCharge != null
                      ? formatCurrency(entry.calculatedNetServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>

                  {/* Célértékek */}
                  <td className="px-3 py-1.5 text-right text-green-700">
                    {entry.targetNetHourlyServiceCharge != null
                      ? formatCurrency(entry.targetNetHourlyServiceCharge)
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-green-700 border-r border-green-100">
                    {entry.targetServiceChargeAmount != null
                      ? formatCurrency(entry.targetServiceChargeAmount)
                      : <span className="text-gray-300">-</span>}
                  </td>

                  {/* Kiegészítők */}
                  <td className="px-2 py-1.5 text-right bg-yellow-50/40">
                    {inputCell(entry, "bonus", "w-16")}
                  </td>
                  <td className="px-2 py-1.5 text-right bg-yellow-50/40">
                    {inputCell(entry, "overtimePayment", "w-16")}
                  </td>
                  <td className="px-2 py-1.5 text-right bg-yellow-50/40 border-r border-yellow-100">
                    {inputCell(entry, "manualCorrection", "w-16")}
                  </td>

                  {/* Összesítés */}
                  <td className="px-3 py-1.5 text-right font-semibold text-purple-700">
                    {formatCurrency(finalTarget)}
                  </td>
                  <td className="px-2 py-1.5 text-right bg-purple-50/30 border-r border-purple-100">
                    {inputCell(entry, "finalApprovedAmount", "w-20", "number", "= cél")}
                  </td>

                  {/* Notes */}
                  <td className="px-2 py-1.5 text-gray-500 max-w-[120px] truncate">
                    {editable ? (
                      <input
                        type="text"
                        value={rowValues[entry.id]?.notes ?? ""}
                        onChange={(e) => updateField(entry.id, "notes", e.target.value)}
                        onBlur={() => handleBlurSave(entry)}
                        className="w-28 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      entry.notes ?? ""
                    )}
                  </td>

                  {/* Status column: saving indicator + override badge */}
                  <td className="px-2 py-1.5 text-center min-w-[80px]">
                    {isSaving ? (
                      <span className="text-xs text-blue-500 italic">mentés...</span>
                    ) : isOverride ? (
                      <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-medium">
                        Felülbírálat
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 && (
              <tr>
                <td colSpan={16} className="px-4 py-10 text-center text-gray-400">
                  <div className="text-base font-medium mb-1">Még nincsenek bejegyzések</div>
                  <div className="text-sm">
                    Kattints az &ldquo;Összes hozzáadása&rdquo; gombra, vagy adj hozzá dolgozókat egyenként.
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {entries.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-xs">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-gray-50 border-r border-gray-200" colSpan={2}>
                  Összesítés
                </td>
                {/* Bevitel totals */}
                <td className="px-3 py-2 text-right text-blue-700">
                  {formatHours(entries.reduce((s, e) => s + e.workedHours, 0))}
                </td>
                <td className="px-3 py-2 text-right text-blue-700">
                  {formatHours(entries.reduce((s, e) => s + e.overtimeHours, 0))}
                </td>
                <td className="px-3 py-2 border-r border-blue-100"></td>
                {/* Számított totals */}
                <td className="px-3 py-2 text-right text-gray-600">
                  {formatCurrency(entries.reduce((s, e) => s + (e.calculatedGrossServiceCharge ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 border-r border-gray-200">
                  {formatCurrency(entries.reduce((s, e) => s + (e.calculatedNetServiceCharge ?? 0), 0))}
                </td>
                {/* Célértékek totals */}
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-green-700 border-r border-green-100">
                  {formatCurrency(entries.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0), 0))}
                </td>
                {/* Kiegészítők totals */}
                <td className="px-3 py-2 text-right text-yellow-700">
                  {formatCurrency(entries.reduce((s, e) => s + e.bonus, 0))}
                </td>
                <td className="px-3 py-2 text-right text-yellow-700">
                  {formatCurrency(entries.reduce((s, e) => s + e.overtimePayment, 0))}
                </td>
                <td className="px-3 py-2 text-right text-yellow-700 border-r border-yellow-100">
                  {formatCurrency(entries.reduce((s, e) => s + e.manualCorrection, 0))}
                </td>
                {/* Összesítés totals */}
                <td className="px-3 py-2 text-right text-purple-700">
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
                <td className="px-3 py-2 text-right text-purple-700 border-r border-purple-100">
                  {formatCurrency(entries.reduce((s, e) => s + (e.finalApprovedAmount ?? 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isLocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          Ez a periódus {period.status === "CLOSED" ? "lezárva" : "jóváhagyva"} — módosítás nem lehetséges.
        </div>
      )}
    </div>
  );
}
