"use client";

import { useState } from "react";
import { BusinessRule, Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatPercent } from "@/lib/format";

interface BusinessRulesManagerProps {
  rules: BusinessRule[];
  userRole: Role;
}

export function BusinessRulesManager({ rules: initial, userRole }: BusinessRulesManagerProps) {
  const [rules, setRules] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const canWrite = hasPermission(userRole, "rules:write");

  const [form, setForm] = useState({
    effectiveFrom: new Date().toISOString().split("T")[0],
    effectiveTo: "",
    serviceChargePercent: 3.9,
    employeeContribution: 18.5,
    notes: "",
  });

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          serviceChargePercent: form.serviceChargePercent / 100,
          employeeContribution: form.employeeContribution / 100,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Create failed", "error");
        return;
      }
      setRules((prev) => [
        {
          ...data,
          serviceChargePercent: Number(data.serviceChargePercent),
          employeeContribution: Number(data.employeeContribution),
        },
        ...prev,
      ]);
      setAdding(false);
      showToast("Business rule created", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
          >
            + New Rule
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Effective From</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Effective To</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">SC Percent</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Employee Contribution</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{formatDate(rule.effectiveFrom)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {rule.effectiveTo ? formatDate(rule.effectiveTo) : "Current"}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatPercent(rule.serviceChargePercent)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatPercent(rule.employeeContribution)}
                </td>
                <td className="px-4 py-3 text-gray-500">{rule.notes ?? ""}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No business rules configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold">New Business Rule</h2>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Charge % (e.g., 3.9 for 3.9%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.serviceChargePercent}
                  onChange={(e) => setForm((f) => ({ ...f, serviceChargePercent: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Contribution % (e.g., 18.5 for 18.5%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.employeeContribution}
                  onChange={(e) => setForm((f) => ({ ...f, employeeContribution: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setAdding(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
