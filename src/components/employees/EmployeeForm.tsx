"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Employee, Position, Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";

interface EmployeeFormProps {
  employee: Partial<Employee> | null;
  positions: Position[];
  userRole: Role;
}

export function EmployeeForm({ employee, positions, userRole }: EmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const canWrite = hasPermission(userRole, "employees:write");
  const isNew = !employee?.id;

  const [form, setForm] = useState({
    name: employee?.name ?? "",
    positionId: employee?.positionId ?? positions[0]?.id ?? "",
    baseSalaryType: employee?.baseSalaryType ?? "MONTHLY" as const,
    baseSalaryAmount: (employee?.baseSalaryAmount ?? 0),
    eligibleForServiceCharge: employee?.eligibleForServiceCharge ?? true,
    startDate: employee?.startDate?.split("T")[0] ?? new Date().toISOString().split("T")[0],
    endDate: employee?.endDate?.split("T")[0] ?? "",
    location: employee?.location ?? "",
    notes: employee?.notes ?? "",
    active: employee?.active ?? true,
  });

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      baseSalaryAmount: Math.round(form.baseSalaryAmount),
      endDate: form.endDate || null,
      location: form.location || null,
      notes: form.notes || null,
    };

    try {
      const url = isNew ? "/api/employees" : `/api/employees/${employee?.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Save failed", "error");
        return;
      }

      showToast(isNew ? "Employee created" : "Employee updated", "success");
      router.push("/employees");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Full Name *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={!canWrite}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Position *</label>
            <select
              required
              value={form.positionId}
              onChange={(e) => set("positionId", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Salary Type *</label>
            <select
              value={form.baseSalaryType}
              onChange={(e) => set("baseSalaryType", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            >
              <option value="HOURLY">Hourly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Base Salary (Ft/{form.baseSalaryType === "HOURLY" ? "hr" : "month"}) *
            </label>
            <input
              required
              type="number"
              value={form.baseSalaryAmount}
              onChange={(e) => set("baseSalaryAmount", parseFloat(e.target.value) || 0)}
              step="0.01"
              min="0"
              disabled={!canWrite}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>End Date (if left company)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.eligibleForServiceCharge}
              onChange={(e) => set("eligibleForServiceCharge", e.target.checked)}
              disabled={!canWrite}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">Eligible for Service Charge</span>
          </label>

          {!isNew && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
                disabled={!canWrite}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          )}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={!canWrite}
            rows={3}
            className={inputClass}
          />
        </div>

        {canWrite && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving..." : isNew ? "Create Employee" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/employees")}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
