"use client";

import { useState, useCallback, useRef } from "react";
import {
  MonthlyPeriod,
  MonthlyEmployeeEntry,
  MonthlyExtraTask,
  Employee,
  Position,
  Location,
  Role,
} from "@/types";
import { formatCurrency, formatHours } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";
import { ExportButton } from "@/components/allocation/ExportButton";
import { ImportModal } from "@/components/allocation/ImportModal";
import { hasPermission } from "@/lib/permissions";
import { Plus, X, ArrowRightLeft } from "lucide-react";

interface AllocationTableProps {
  period: MonthlyPeriod;
  initialEntries: MonthlyEmployeeEntry[];
  availableEmployees: Employee[];
  availablePositions: Position[];
  locations: Location[];
  initialExtraTasks: MonthlyExtraTask[];
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

// Extra task type from the catalog (fetched once)
interface TaskTypeOption {
  id: string;
  name: string;
  bonusType: "FIXED_AMOUNT" | "HOURLY_RATE";
  bonusAmount: number;
  active?: boolean;
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

function calcBaseSalary(entry: MonthlyEmployeeEntry, workedHoursStr: string): number {
  const emp = entry.employee;
  if (!emp) return 0;
  if (emp.baseSalaryType === "HOURLY") {
    return Math.round(emp.baseSalaryAmount * (parseFloat(workedHoursStr) || 0));
  }
  return Math.round(emp.baseSalaryAmount);
}

export function AllocationTable({
  period,
  initialEntries,
  availableEmployees,
  availablePositions,
  locations,
  initialExtraTasks,
  userRole,
}: AllocationTableProps) {
  const [entries, setEntries] = useState<MonthlyEmployeeEntry[]>(initialEntries);
  const [extraTasks, setExtraTasks] = useState<MonthlyExtraTask[]>(initialExtraTasks);
  const [rowValues, setRowValues] = useState<Record<string, RowValues>>(() => {
    const map: Record<string, RowValues> = {};
    for (const e of initialEntries) map[e.id] = entryToRowValues(e);
    return map;
  });
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [groupByPosition, setGroupByPosition] = useState(false);

  // "Add with role" form state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addPosId, setAddPosId] = useState("");
  const [addLocId, setAddLocId] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addIsLoan, setAddIsLoan] = useState(false);
  const [addingOne, setAddingOne] = useState(false);

  // Extra task modal state
  const [extraTaskModal, setExtraTaskModal] = useState<{
    employeeId: string;
    employeeName: string;
  } | null>(null);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [taskTypeId, setTaskTypeId] = useState("");
  const [taskHours, setTaskHours] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const rowValuesRef = useRef(rowValues);
  rowValuesRef.current = rowValues;

  const isLocked = period.status === "CLOSED" || period.status === "APPROVED";
  const canWrite = hasPermission(userRole, "periods:write");
  const canApprove = userRole === "ADMIN" || userRole === "BUSINESS_UNIT_LEAD";
  const canSubmit = hasPermission(userRole, "periods:submit");
  const editable = !isLocked && canWrite;

  // Summary numbers
  const totalApproved = entries.reduce((s, e) => s + (e.finalApprovedAmount ?? 0), 0);
  const totalTarget = entries.reduce(
    (s, e) => s + (e.targetServiceChargeAmount ?? 0) + e.bonus + e.overtimePayment + e.manualCorrection,
    0
  );
  const totalExtraTasks = extraTasks.reduce((s, t) => s + t.amount, 0);
  const closingBalance = period.distributableBalance - totalApproved;

  // Extra tasks per employee map
  const extraTasksByEmployee = extraTasks.reduce<Record<string, MonthlyExtraTask[]>>((acc, t) => {
    if (!acc[t.employeeId]) acc[t.employeeId] = [];
    acc[t.employeeId].push(t);
    return acc;
  }, {});

  const updateField = useCallback((entryId: string, field: keyof RowValues, value: string) => {
    setRowValues((prev) => ({ ...prev, [entryId]: { ...prev[entryId], [field]: value } }));
    setDirtyRows((prev) => new Set(prev).add(entryId));
  }, []);

  const handleBlurSave = useCallback(async (entry: MonthlyEmployeeEntry) => {
    const vals = rowValuesRef.current[entry.id];
    if (!vals) return;
    setSavingRows((prev) => new Set(prev).add(entry.id));
    setDirtyRows((prev) => { const n = new Set(prev); n.delete(entry.id); return n; });

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
      if (approvedAmt !== computedTarget) updateData.overrideFlag = true;
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
      setRowValues((prev) => ({ ...prev, [entry.id]: entryToRowValues(updated) }));
    } catch {
      showToast("Hálózati hiba", "error");
      setDirtyRows((prev) => new Set(prev).add(entry.id));
    } finally {
      setSavingRows((prev) => { const n = new Set(prev); n.delete(entry.id); return n; });
    }
  }, [period.id]);

  const refreshEntries = async () => {
    const res = await fetch(`/api/periods/${period.id}/entries`);
    if (res.ok) {
      const updated: MonthlyEmployeeEntry[] = await res.json();
      setEntries(updated);
      const map: Record<string, RowValues> = {};
      for (const e of updated) map[e.id] = entryToRowValues(e);
      setRowValues(map);
      setDirtyRows(new Set());
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/calculate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Számítás sikertelen", "error");
        return;
      }
      const data = await res.json();
      showToast(`Számítás kész. Ref díj: ${formatCurrency(data.waiterReferenceHourlyRateCents)}/óra`, "success");
      await refreshEntries();
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setCalculating(false);
    }
  };

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

  const handleAddAllEmployees = async () => {
    const primaryEntryKeys = new Set(entries.map((e) => `${e.employeeId}:${e.positionId}`));
    const addable = availableEmployees.filter(
      (emp) => !primaryEntryKeys.has(`${emp.id}:${emp.positionId}`)
    );
    if (addable.length === 0) return;
    setAddingAll(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/entries/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: addable.map((e) => e.id) }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Tömeges hozzáadás sikertelen", "error");
        return;
      }
      const result = await res.json();
      await refreshEntries();
      showToast(`${result.created} dolgozó hozzáadva, ${result.skipped} már szerepelt`, "success");
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setAddingAll(false);
    }
  };

  // Open add modal: pre-fill position from selected employee
  const openAddModal = () => {
    setAddEmpId("");
    setAddPosId("");
    setAddLocId("");
    setAddLabel("");
    setAddIsLoan(false);
    setAddModalOpen(true);
  };

  const handleAddOneSubmit = async () => {
    if (!addEmpId) return;
    setAddingOne(true);
    try {
      const body: Record<string, unknown> = { employeeId: addEmpId };
      if (addPosId) body.positionId = addPosId;
      if (addLabel) body.entryLabel = addLabel;
      if (addLocId) body.workingLocationId = addLocId;
      body.isLoanEntry = addIsLoan;

      const res = await fetch(`/api/periods/${period.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Hozzáadás sikertelen", "error");
        return;
      }
      const newEntry: MonthlyEmployeeEntry = await res.json();
      setEntries((prev) => {
        const exists = prev.find((e) => e.id === newEntry.id);
        return exists ? prev.map((e) => (e.id === newEntry.id ? newEntry : e)) : [...prev, newEntry];
      });
      setRowValues((prev) => ({ ...prev, [newEntry.id]: entryToRowValues(newEntry) }));
      showToast("Bejegyzés hozzáadva", "success");
      setAddModalOpen(false);
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setAddingOne(false);
    }
  };

  // Extra task management
  const openExtraTaskModal = async (employeeId: string, employeeName: string) => {
    setExtraTaskModal({ employeeId, employeeName });
    setTaskTypeId("");
    setTaskHours("");
    setTaskNotes("");
    if (taskTypes.length === 0) {
      const res = await fetch("/api/extra-task-types");
      if (res.ok) setTaskTypes(await res.json());
    }
  };

  const handleAddExtraTask = async () => {
    if (!extraTaskModal || !taskTypeId) return;
    setSavingTask(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: extraTaskModal.employeeId,
        extraTaskTypeId: taskTypeId,
        notes: taskNotes || null,
      };
      const chosen = taskTypes.find((t) => t.id === taskTypeId);
      if (chosen?.bonusType === "HOURLY_RATE") {
        body.hours = parseFloat(taskHours) || 0;
      }
      const res = await fetch(`/api/periods/${period.id}/extra-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Mentés sikertelen", "error");
        return;
      }
      const saved: MonthlyExtraTask = await res.json();
      setExtraTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        return idx >= 0 ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
      });
      showToast("Extra feladat mentve", "success");
      setTaskTypeId("");
      setTaskHours("");
      setTaskNotes("");
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setSavingTask(false);
    }
  };

  const handleRemoveExtraTask = async (taskId: string) => {
    const res = await fetch(`/api/periods/${period.id}/extra-tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Törlés sikertelen", "error");
      return;
    }
    setExtraTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast("Extra feladat eltávolítva", "success");
  };

  // Employees not yet in the period with their primary position
  const addableEmployees = availableEmployees.filter(
    (emp) => !entries.some((e) => e.employeeId === emp.id && e.positionId === emp.positionId)
  );

  const inputCell = (
    entry: MonthlyEmployeeEntry,
    field: keyof RowValues,
    width: string,
    type: "number" | "text" = "number",
    placeholder?: string
  ) => {
    const value = rowValues[entry.id]?.[field] ?? "";
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
    if (type === "text") return <span>{value}</span>;
    return value === "" ? <span className="text-gray-300">-</span> : <span>{value}</span>;
  };

  // Grouping
  type EntryGroup = { positionName: string; entries: MonthlyEmployeeEntry[] };
  const groupedEntries: EntryGroup[] = groupByPosition
    ? Array.from(
        entries.reduce((map, e) => {
          const key = e.position?.name ?? "Ismeretlen";
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(e);
          return map;
        }, new Map<string, MonthlyEmployeeEntry[]>())
      )
        .sort(([a], [b]) => a.localeCompare(b, "hu"))
        .map(([positionName, entries]) => ({ positionName, entries }))
    : [{ positionName: "", entries }];

  const TOTAL_COLS = 19;

  const renderEntryRow = (entry: MonthlyEmployeeEntry) => {
    const isSaving = savingRows.has(entry.id);
    const isDirty = dirtyRows.has(entry.id);
    const finalTarget =
      (entry.targetServiceChargeAmount ?? 0) + entry.bonus + entry.overtimePayment + entry.manualCorrection;
    const vals = rowValues[entry.id];
    const baseSalary = calcBaseSalary(entry, vals?.workedHours ?? String(entry.workedHours));
    const approvedOrTarget = entry.finalApprovedAmount != null ? entry.finalApprovedAmount : finalTarget;
    const empExtraTasks = extraTasksByEmployee[entry.employeeId] ?? [];
    const extraTotal = empExtraTasks.reduce((s, t) => s + t.amount, 0);
    const actualEarnings = baseSalary + approvedOrTarget + extraTotal;
    const isLoan = entry.isLoanEntry || !!entry.workingLocationId;

    return (
      <tr
        key={entry.id}
        className={`${
          entry.overrideFlag ? "bg-yellow-50" : isDirty ? "bg-amber-50" : "hover:bg-gray-50"
        } ${isDirty ? "border-l-4 border-l-amber-400" : ""}`}
      >
        {/* Name */}
        <td className="px-3 py-2 sticky left-0 bg-inherit z-10 border-r border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-xs">
              {entry.employee?.name ?? entry.employeeId}
            </span>
            {entry.entryLabel && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                {entry.entryLabel}
              </span>
            )}
            {isLoan && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs" title={entry.workingLocation?.name ?? "Kölcsönzés"}>
                <ArrowRightLeft size={10} />
                {entry.workingLocation?.name ?? "Kölcsön"}
              </span>
            )}
          </div>
        </td>
        {!groupByPosition && (
          <td className="px-3 py-2 text-gray-500 border-r border-gray-100 text-xs">
            {entry.position?.name ?? entry.positionId}
          </td>
        )}

        {/* Bevitel */}
        <td className="px-2 py-1.5 text-right bg-blue-50/30">{inputCell(entry, "workedHours", "w-16")}</td>
        <td className="px-2 py-1.5 text-right bg-blue-50/30">{inputCell(entry, "overtimeHours", "w-16")}</td>
        <td className="px-2 py-1.5 text-right bg-blue-50/30 border-r border-blue-100">
          {inputCell(entry, "netWaiterSales", "w-20", "number", "0")}
        </td>

        {/* Számított */}
        <td className="px-3 py-1.5 text-right text-gray-600 text-xs">
          {entry.calculatedGrossServiceCharge != null ? formatCurrency(entry.calculatedGrossServiceCharge) : <span className="text-gray-300">-</span>}
        </td>
        <td className="px-3 py-1.5 text-right text-gray-600 border-r border-gray-100 text-xs">
          {entry.calculatedNetServiceCharge != null ? formatCurrency(entry.calculatedNetServiceCharge) : <span className="text-gray-300">-</span>}
        </td>

        {/* Célértékek */}
        <td className="px-3 py-1.5 text-right text-green-700 text-xs">
          {entry.targetNetHourlyServiceCharge != null ? formatCurrency(entry.targetNetHourlyServiceCharge) : <span className="text-gray-300">-</span>}
        </td>
        <td className="px-3 py-1.5 text-right font-medium text-green-700 border-r border-green-100 text-xs">
          {entry.targetServiceChargeAmount != null ? formatCurrency(entry.targetServiceChargeAmount) : <span className="text-gray-300">-</span>}
        </td>

        {/* Kiegészítők */}
        <td className="px-2 py-1.5 text-right bg-yellow-50/40">{inputCell(entry, "bonus", "w-16")}</td>
        <td className="px-2 py-1.5 text-right bg-yellow-50/40">{inputCell(entry, "overtimePayment", "w-16")}</td>
        <td className="px-2 py-1.5 text-right bg-yellow-50/40 border-r border-yellow-100">
          {inputCell(entry, "manualCorrection", "w-16")}
        </td>

        {/* Összesítés */}
        <td className="px-3 py-1.5 text-right font-semibold text-purple-700 text-xs">{formatCurrency(finalTarget)}</td>
        <td className="px-2 py-1.5 text-right bg-purple-50/30 border-r border-purple-100">
          {inputCell(entry, "finalApprovedAmount", "w-20", "number", "= cél")}
        </td>

        {/* Extra feladatok */}
        <td className="px-2 py-1.5 text-right bg-teal-50/30">
          <div className="flex items-center justify-end gap-1">
            <span className={`text-xs font-medium ${extraTotal > 0 ? "text-teal-700" : "text-gray-300"}`}>
              {extraTotal > 0 ? formatCurrency(extraTotal) : "—"}
            </span>
            {editable && (
              <button
                onClick={() => openExtraTaskModal(entry.employeeId, entry.employee?.name ?? entry.employeeId)}
                className="p-0.5 text-teal-500 hover:text-teal-700 rounded"
                title="Extra feladat hozzáadása"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </td>

        {/* Kereset */}
        <td className="px-3 py-1.5 text-right text-orange-700 bg-orange-50/30 text-xs">{formatCurrency(baseSalary)}</td>
        <td className="px-3 py-1.5 text-right font-semibold text-orange-800 bg-orange-50/30 border-r border-orange-100 text-xs">
          {formatCurrency(actualEarnings)}
        </td>

        {/* Megjegyzés */}
        <td className="px-2 py-1.5 text-gray-500 max-w-[100px] truncate text-xs">
          {editable ? (
            <input
              type="text"
              value={rowValues[entry.id]?.notes ?? ""}
              onChange={(e) => updateField(entry.id, "notes", e.target.value)}
              onBlur={() => handleBlurSave(entry)}
              className="w-24 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          ) : (entry.notes ?? "")}
        </td>

        {/* Állapot */}
        <td className="px-2 py-1.5 text-center min-w-[72px]">
          {isSaving ? (
            <span className="text-xs text-blue-500 italic">mentés...</span>
          ) : entry.overrideFlag ? (
            <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs">Felülbírálat</span>
          ) : null}
        </td>
      </tr>
    );
  };

  const renderGroupSubtotal = (group: EntryGroup) => {
    const grp = group.entries;
    const grpTarget = grp.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0) + e.bonus + e.overtimePayment + e.manualCorrection, 0);
    const grpApproved = grp.reduce((s, e) => s + (e.finalApprovedAmount ?? 0), 0);
    const grpBase = grp.reduce((s, e) => s + calcBaseSalary(e, rowValues[e.id]?.workedHours ?? String(e.workedHours)), 0);
    const grpExtra = grp.reduce((s, e) => s + (extraTasksByEmployee[e.employeeId] ?? []).reduce((x, t) => x + t.amount, 0), 0);
    const grpActual = grp.reduce((s, e) => {
      const base = calcBaseSalary(e, rowValues[e.id]?.workedHours ?? String(e.workedHours));
      const ft = (e.targetServiceChargeAmount ?? 0) + e.bonus + e.overtimePayment + e.manualCorrection;
      const appOrT = e.finalApprovedAmount != null ? e.finalApprovedAmount : ft;
      const extra = (extraTasksByEmployee[e.employeeId] ?? []).reduce((x, t) => x + t.amount, 0);
      return s + base + appOrT + extra;
    }, 0);

    return (
      <tr key={`subtotal-${group.positionName}`} className="bg-gray-100 border-t border-b border-gray-300 text-xs font-semibold">
        <td className="px-3 py-1.5 sticky left-0 bg-gray-100 border-r border-gray-200 text-gray-600 italic" colSpan={groupByPosition ? 4 : 5}>
          Részösszeg: {group.positionName} ({grp.length} fő)
        </td>
        <td className="px-3 py-1.5 text-right text-blue-700">{formatHours(grp.reduce((s, e) => s + Number(e.workedHours), 0))}</td>
        <td className="px-3 py-1.5 text-right text-blue-700">{formatHours(grp.reduce((s, e) => s + Number(e.overtimeHours), 0))}</td>
        <td className="px-3 py-1.5 border-r border-blue-100" />
        <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(grp.reduce((s, e) => s + (e.calculatedGrossServiceCharge ?? 0), 0))}</td>
        <td className="px-3 py-1.5 text-right text-gray-600 border-r border-gray-200">{formatCurrency(grp.reduce((s, e) => s + (e.calculatedNetServiceCharge ?? 0), 0))}</td>
        <td className="px-3 py-1.5" />
        <td className="px-3 py-1.5 text-right text-green-700 border-r border-green-100">{formatCurrency(grp.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0), 0))}</td>
        <td className="px-3 py-1.5 text-right text-yellow-700">{formatCurrency(grp.reduce((s, e) => s + e.bonus, 0))}</td>
        <td className="px-3 py-1.5 text-right text-yellow-700">{formatCurrency(grp.reduce((s, e) => s + e.overtimePayment, 0))}</td>
        <td className="px-3 py-1.5 text-right text-yellow-700 border-r border-yellow-100">{formatCurrency(grp.reduce((s, e) => s + e.manualCorrection, 0))}</td>
        <td className="px-3 py-1.5 text-right text-purple-700">{formatCurrency(grpTarget)}</td>
        <td className="px-3 py-1.5 text-right text-purple-700 border-r border-purple-100">{formatCurrency(grpApproved)}</td>
        <td className="px-3 py-1.5 text-right text-teal-700">{grpExtra > 0 ? formatCurrency(grpExtra) : "—"}</td>
        <td className="px-3 py-1.5 text-right text-orange-700">{formatCurrency(grpBase)}</td>
        <td className="px-3 py-1.5 text-right text-orange-800 border-r border-orange-100">{formatCurrency(grpActual)}</td>
        <td colSpan={2} />
      </tr>
    );
  };

  const selectedEmpObj = availableEmployees.find((e) => e.id === addEmpId);
  const chosenTaskType = taskTypes.find((t) => t.id === taskTypeId);

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Felosztható egyenleg</div>
          <div className={`text-xl font-bold mt-1 ${period.distributableBalance < 0 ? "text-red-600" : "text-blue-700"}`}>
            {formatCurrency(period.distributableBalance)}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Cél szétosztás</div>
          <div className="text-xl font-bold mt-1 text-green-700">{formatCurrency(totalTarget + totalExtraTasks)}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Jóváhagyott összeg</div>
          <div className="text-xl font-bold mt-1 text-purple-700">{formatCurrency(totalApproved)}</div>
        </div>
        <div className={`${closingBalance < 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded-lg px-4 py-3`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>Várható záróegyenleg</div>
          <div className={`text-xl font-bold mt-1 ${closingBalance < 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(closingBalance)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow p-4">
        {editable && (
          <>
            {addableEmployees.length > 0 && (
              <button
                onClick={handleAddAllEmployees}
                disabled={addingAll}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium"
              >
                {addingAll ? "Hozzáadás..." : `Összes hozzáadása (${addableEmployees.length} dolgozó)`}
              </button>
            )}
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm rounded-md hover:bg-gray-50 font-medium"
            >
              + Egyéni / más szerepkör
            </button>
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

        <button
          onClick={() => setGroupByPosition((v) => !v)}
          className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${
            groupByPosition ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {groupByPosition ? "Csoportosítás: BE" : "Csoportosítás: KI"} (munkakör)
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ExportButton periodId={period.id} />
          {!isLocked && period.status === "DRAFT" && canSubmit && (
            <button onClick={() => handleAction("SUBMITTED")} disabled={actionLoading} className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 disabled:opacity-50">
              Jóváhagyásra küld
            </button>
          )}
          {period.status === "PENDING_APPROVAL" && canApprove && (
            <>
              <button onClick={() => handleAction("APPROVED")} disabled={actionLoading} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">Jóváhagy</button>
              <button onClick={() => { const c = prompt("Visszaküldés oka:"); if (c !== null) handleAction("REJECTED", c); }} disabled={actionLoading} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50">Visszaküld</button>
            </>
          )}
          {period.status === "APPROVED" && canApprove && (
            <button onClick={() => handleAction("CLOSED")} disabled={actionLoading} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">Periódus lezárása</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 border-b border-r border-gray-200 sticky left-0 z-20">Dolgozó</th>
              {!groupByPosition && <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 border-b border-r border-gray-200">Pozíció</th>}
              <th colSpan={3} className="px-3 py-1 text-center text-xs font-bold text-blue-700 bg-blue-100 border-b border-blue-200">Bevitel</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-bold text-gray-700 bg-gray-200 border-b border-gray-300">Számított</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-bold text-green-700 bg-green-100 border-b border-green-200">Célértékek</th>
              <th colSpan={3} className="px-3 py-1 text-center text-xs font-bold text-yellow-800 bg-yellow-100 border-b border-yellow-200">Kiegészítők</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-bold text-purple-700 bg-purple-100 border-b border-purple-200">Összesítés</th>
              <th colSpan={1} className="px-3 py-1 text-center text-xs font-bold text-teal-700 bg-teal-100 border-b border-teal-200">Extra</th>
              <th colSpan={2} className="px-3 py-1 text-center text-xs font-bold text-orange-700 bg-orange-100 border-b border-orange-200">Kereset</th>
              <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-100 border-b border-gray-200">Megjegyzés</th>
              <th rowSpan={2} className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-center text-gray-600 font-semibold">Állapot</th>
            </tr>
            <tr>
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100">Ledolg. óra</th>
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100">Túlóra</th>
              <th className="px-3 py-1.5 text-right font-medium text-blue-600 bg-blue-50 border-b border-blue-100 border-r border-blue-100">Pincér eladás</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-600 bg-gray-100 border-b border-gray-200">Bruttó SZD</th>
              <th className="px-3 py-1.5 text-right font-medium text-gray-600 bg-gray-100 border-b border-gray-200 border-r border-gray-200">Nettó SZD</th>
              <th className="px-3 py-1.5 text-right font-medium text-green-600 bg-green-50 border-b border-green-100">Célóradíj</th>
              <th className="px-3 py-1.5 text-right font-medium text-green-600 bg-green-50 border-b border-green-100 border-r border-green-100">Cél SZD</th>
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100">Prémium</th>
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100">Túlóra kif.</th>
              <th className="px-3 py-1.5 text-right font-medium text-yellow-700 bg-yellow-50 border-b border-yellow-100 border-r border-yellow-100">Korrekció</th>
              <th className="px-3 py-1.5 text-right font-medium text-purple-600 bg-purple-50 border-b border-purple-100">Végső cél</th>
              <th className="px-3 py-1.5 text-right font-medium text-purple-600 bg-purple-50 border-b border-purple-100 border-r border-purple-100">Jóváhagyott</th>
              <th className="px-3 py-1.5 text-right font-medium text-teal-600 bg-teal-50 border-b border-teal-100 border-r border-teal-100">Extra</th>
              <th className="px-3 py-1.5 text-right font-medium text-orange-600 bg-orange-50 border-b border-orange-100">Alapbér</th>
              <th className="px-3 py-1.5 text-right font-medium text-orange-700 bg-orange-50 border-b border-orange-100 border-r border-orange-100">Tényleges kereset</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={TOTAL_COLS} className="px-4 py-10 text-center text-gray-400">
                  <div className="text-base font-medium mb-1">Még nincsenek bejegyzések</div>
                  <div className="text-sm">Kattints az &ldquo;Összes hozzáadása&rdquo; gombra vagy adj hozzá dolgozókat egyenként.</div>
                </td>
              </tr>
            ) : (
              groupedEntries.map((group) => (
                <>
                  {groupByPosition && (
                    <tr key={`header-${group.positionName}`} className="bg-gray-800">
                      <td colSpan={TOTAL_COLS - 1} className="px-4 py-2 text-sm font-bold text-white sticky left-0">
                        {group.positionName}
                        <span className="ml-2 text-gray-300 font-normal text-xs">{group.entries.length} fő</span>
                      </td>
                    </tr>
                  )}
                  {group.entries.map(renderEntryRow)}
                  {groupByPosition && renderGroupSubtotal(group)}
                </>
              ))
            )}
          </tbody>

          {entries.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold text-xs">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-gray-50 border-r border-gray-200" colSpan={groupByPosition ? 1 : 2}>Összesítés</td>
                <td className="px-3 py-2 text-right text-blue-700">{formatHours(entries.reduce((s, e) => s + Number(e.workedHours), 0))}</td>
                <td className="px-3 py-2 text-right text-blue-700">{formatHours(entries.reduce((s, e) => s + Number(e.overtimeHours), 0))}</td>
                <td className="px-3 py-2 border-r border-blue-100" />
                <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(entries.reduce((s, e) => s + (e.calculatedGrossServiceCharge ?? 0), 0))}</td>
                <td className="px-3 py-2 text-right text-gray-600 border-r border-gray-200">{formatCurrency(entries.reduce((s, e) => s + (e.calculatedNetServiceCharge ?? 0), 0))}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-green-700 border-r border-green-100">{formatCurrency(entries.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0), 0))}</td>
                <td className="px-3 py-2 text-right text-yellow-700">{formatCurrency(entries.reduce((s, e) => s + e.bonus, 0))}</td>
                <td className="px-3 py-2 text-right text-yellow-700">{formatCurrency(entries.reduce((s, e) => s + e.overtimePayment, 0))}</td>
                <td className="px-3 py-2 text-right text-yellow-700 border-r border-yellow-100">{formatCurrency(entries.reduce((s, e) => s + e.manualCorrection, 0))}</td>
                <td className="px-3 py-2 text-right text-purple-700">{formatCurrency(entries.reduce((s, e) => s + (e.targetServiceChargeAmount ?? 0) + e.bonus + e.overtimePayment + e.manualCorrection, 0))}</td>
                <td className="px-3 py-2 text-right text-purple-700 border-r border-purple-100">{formatCurrency(totalApproved)}</td>
                <td className="px-3 py-2 text-right text-teal-700 border-r border-teal-100">{totalExtraTasks > 0 ? formatCurrency(totalExtraTasks) : "—"}</td>
                <td className="px-3 py-2 text-right text-orange-700">{formatCurrency(entries.reduce((s, e) => s + calcBaseSalary(e, rowValues[e.id]?.workedHours ?? String(e.workedHours)), 0))}</td>
                <td className="px-3 py-2 text-right text-orange-800 border-r border-orange-100">
                  {formatCurrency(entries.reduce((s, e) => {
                    const base = calcBaseSalary(e, rowValues[e.id]?.workedHours ?? String(e.workedHours));
                    const ft = (e.targetServiceChargeAmount ?? 0) + e.bonus + e.overtimePayment + e.manualCorrection;
                    const ao = e.finalApprovedAmount != null ? e.finalApprovedAmount : ft;
                    const extra = (extraTasksByEmployee[e.employeeId] ?? []).reduce((x, t) => x + t.amount, 0);
                    return s + base + ao + extra;
                  }, 0))}
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

      {/* ── Add employee / role modal ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Bejegyzés hozzáadása</h2>
              <button onClick={() => setAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dolgozó *</label>
                <select
                  value={addEmpId}
                  onChange={(e) => {
                    setAddEmpId(e.target.value);
                    const emp = availableEmployees.find((x) => x.id === e.target.value);
                    setAddPosId(emp?.positionId ?? "");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">— Válassz —</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.position?.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Szerepkör (pozíció)</label>
                <select
                  value={addPosId}
                  onChange={(e) => setAddPosId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">— Alap pozíció —</option>
                  {availablePositions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedEmpObj && addPosId && addPosId !== selectedEmpObj.positionId && (
                  <p className="text-xs text-indigo-600 mt-1">Extra szerepkör — külön bejegyzés jön létre</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés / sor neve</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="pl. Felszolgáló műszak"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              {locations.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Munkavégzés helyszíne</label>
                  <select
                    value={addLocId}
                    onChange={(e) => {
                      setAddLocId(e.target.value);
                      setAddIsLoan(!!e.target.value && e.target.value !== (selectedEmpObj?.locationId ?? ""));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">— Bázis lokáció —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  {addIsLoan && <p className="text-xs text-teal-600 mt-1">Kölcsönzési bejegyzés jelölve lesz</p>}
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Mégsem</button>
              <button
                onClick={handleAddOneSubmit}
                disabled={addingOne || !addEmpId}
                className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {addingOne ? "Hozzáadás..." : "Hozzáadás"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extra task modal ── */}
      {extraTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Extra feladatok — {extraTaskModal.employeeName}</h2>
              <button onClick={() => setExtraTaskModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* Existing tasks */}
            {(extraTasksByEmployee[extraTaskModal.employeeId] ?? []).length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Jelenlegi feladatok</p>
                {(extraTasksByEmployee[extraTaskModal.employeeId] ?? []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-teal-50 rounded px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{t.extraTaskType?.name ?? t.extraTaskTypeId}</span>
                      {t.hours && <span className="text-xs text-gray-500 ml-2">{Number(t.hours)}h</span>}
                      <span className="text-sm font-bold text-teal-700 ml-2">{formatCurrency(t.amount)}</span>
                    </div>
                    {editable && (
                      <button onClick={() => handleRemoveExtraTask(t.id)} className="text-red-400 hover:text-red-600 ml-2"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editable && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase">Új extra feladat hozzáadása</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feladat típusa *</label>
                  <select
                    value={taskTypeId}
                    onChange={(e) => { setTaskTypeId(e.target.value); setTaskHours(""); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">— Válassz —</option>
                    {taskTypes.filter((t) => t.active !== false).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.bonusType === "FIXED_AMOUNT" ? formatCurrency(t.bonusAmount) + "/hó" : formatCurrency(t.bonusAmount) + "/óra"})
                      </option>
                    ))}
                  </select>
                </div>
                {chosenTaskType?.bonusType === "HOURLY_RATE" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Órák száma</label>
                    <input
                      type="number"
                      value={taskHours}
                      onChange={(e) => setTaskHours(e.target.value)}
                      min={0}
                      step={0.5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    {taskHours && chosenTaskType && (
                      <p className="text-xs text-teal-700 mt-1">
                        Összeg: {formatCurrency(Math.round(chosenTaskType.bonusAmount * (parseFloat(taskHours) || 0)))}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés</label>
                  <input
                    type="text"
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <button
                  onClick={handleAddExtraTask}
                  disabled={savingTask || !taskTypeId || (chosenTaskType?.bonusType === "HOURLY_RATE" && !taskHours)}
                  className="w-full px-4 py-2 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 disabled:opacity-50 font-medium"
                >
                  {savingTask ? "Mentés..." : "Hozzáadás"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
