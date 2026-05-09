"use client";

import { useState } from "react";
import { Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";

interface PositionRow {
  id: string;
  name: string;
  multiplier: number;
  eligibleForServiceCharge: boolean;
  defaultOvertimeRule?: string;
  minHourlyServiceCharge?: number;
  maxHourlyServiceCharge?: number;
  active: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PositionsManagerProps {
  positions: PositionRow[];
  userRole: Role;
}

export function PositionsManager({ positions: initial, userRole }: PositionsManagerProps) {
  const [positions, setPositions] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PositionRow>>({});
  const [adding, setAdding] = useState(false);
  const [newPos, setNewPos] = useState({
    name: "",
    multiplier: 1.0,
    eligibleForServiceCharge: true,
    active: true,
  });
  const [loading, setLoading] = useState(false);

  const canWrite = hasPermission(userRole, "positions:write");

  const startEdit = (pos: PositionRow) => {
    setEditing(pos.id);
    setEditValues({ ...pos });
  };

  const saveEdit = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Save failed", "error");
        return;
      }
      setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...data, multiplier: Number(data.multiplier) } : p)));
      setEditing(null);
      showToast("Position updated", "success");
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPos),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Create failed", "error");
        return;
      }
      setPositions((prev) => [...prev, { ...data, multiplier: Number(data.multiplier), employeeCount: 0 }]);
      setAdding(false);
      setNewPos({ name: "", multiplier: 1.0, eligibleForServiceCharge: true, active: true });
      showToast("Position created", "success");
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
            + Add Position
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Multiplier</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">SC Eligible</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Employees</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Active</th>
              {canWrite && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {positions.map((pos) => (
              <tr key={pos.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {editing === pos.id ? (
                    <input
                      type="text"
                      value={editValues.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    pos.name
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editing === pos.id ? (
                    <input
                      type="number"
                      step="0.05"
                      value={editValues.multiplier}
                      onChange={(e) => setEditValues((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                    />
                  ) : (
                    `${pos.multiplier.toFixed(2)}x`
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {pos.eligibleForServiceCharge ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{pos.employeeCount}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${pos.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {pos.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    {editing === pos.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => saveEdit(pos.id)}
                          disabled={loading}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(pos)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold">New Position</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newPos.name}
                  onChange={(e) => setNewPos((v) => ({ ...v, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={newPos.multiplier}
                  onChange={(e) => setNewPos((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPos.eligibleForServiceCharge}
                  onChange={(e) => setNewPos((v) => ({ ...v, eligibleForServiceCharge: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">SC Eligible</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setAdding(false)}
                className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !newPos.name}
                className="px-3 py-2 text-sm text-white bg-gray-900 rounded-md disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
