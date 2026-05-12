"use client";

import { useState } from "react";
import { Role, ExtraBonusType } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { Pencil, Trash2 } from "lucide-react";

interface TaskTypeWithCount {
  id: string;
  name: string;
  description?: string;
  bonusType: ExtraBonusType;
  bonusAmount: number;
  rateMultiplier?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { assignments: number };
}

interface ExtraTaskTypesManagerProps {
  initialTypes: TaskTypeWithCount[];
  userRole: Role;
}

const emptyForm = {
  name: "",
  description: "",
  bonusType: "FIXED_AMOUNT" as ExtraBonusType,
  bonusAmount: 0,
  rateMultiplier: 1,
  active: true,
};

export function ExtraTaskTypesManager({ initialTypes, userRole }: ExtraTaskTypesManagerProps) {
  const canWrite = hasPermission(userRole, "settings:write");
  const [types, setTypes] = useState(initialTypes);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/extra-task-types");
    if (res.ok) setTypes(await res.json());
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const isMultiplierType =
        form.bonusType === "MULTIPLIER_FULL_HOURLY" ||
        form.bonusType === "MULTIPLIER_SERVICE_CHARGE_HOURLY";
      const url = editId ? `/api/extra-task-types/${editId}` : "/api/extra-task-types";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          bonusType: form.bonusType,
          bonusAmount: isMultiplierType ? 0 : Math.round(form.bonusAmount),
          rateMultiplier: isMultiplierType ? form.rateMultiplier : null,
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Mentés sikertelen", "error");
        return;
      }
      showToast(editId ? "Frissítve" : "Létrehozva", "success");
      setForm(emptyForm);
      setEditId(null);
      await refresh();
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Törlöd a(z) "${name}" típust?`)) return;
    const res = await fetch(`/api/extra-task-types/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Törlés sikertelen", "error");
      return;
    }
    showToast("Törölve", "success");
    await refresh();
  };

  const startEdit = (t: TaskTypeWithCount) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      bonusType: t.bonusType,
      bonusAmount: t.bonusAmount,
      rateMultiplier: t.rateMultiplier ?? 1,
      active: t.active,
    });
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold mb-4">
            {editId ? "Szerkesztés" : "Új extra feladat típus"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                placeholder="pl. HR feladatok"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leírás</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
                placeholder="Opcionális leírás"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Típus *</label>
              <select
                value={form.bonusType}
                onChange={(e) => setForm((f) => ({ ...f, bonusType: e.target.value as ExtraBonusType }))}
                className={inputClass}
              >
                <option value="FIXED_AMOUNT">Fix összeg (Ft/hó)</option>
                <option value="HOURLY_RATE">Órabér (Ft/óra)</option>
                <option value="MULTIPLIER_FULL_HOURLY">Teljes órabér szorzója</option>
                <option value="MULTIPLIER_SERVICE_CHARGE_HOURLY">Szervíz órabér szorzója</option>
              </select>
            </div>
            {(form.bonusType === "FIXED_AMOUNT" || form.bonusType === "HOURLY_RATE") ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Összeg (Ft{form.bonusType === "HOURLY_RATE" ? "/óra" : "/hó"}) *
                </label>
                <input
                  type="number"
                  value={form.bonusAmount}
                  onChange={(e) => setForm((f) => ({ ...f, bonusAmount: parseFloat(e.target.value) || 0 }))}
                  className={inputClass}
                  min={0}
                  step={1}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szorzó (×) *
                </label>
                <input
                  type="number"
                  value={form.rateMultiplier}
                  onChange={(e) => setForm((f) => ({ ...f, rateMultiplier: parseFloat(e.target.value) || 0 }))}
                  className={inputClass}
                  min={0}
                  step={0.1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.bonusType === "MULTIPLIER_FULL_HOURLY"
                    ? "Pl. 1.5 = az órabér 150%-a × ledolgozott órák"
                    : "Pl. 0.5 = a szervízdíj órabér 50%-a × ledolgozott órák"}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Aktív</span>
            </label>
            <button
              onClick={handleSave}
              disabled={loading || !form.name || (
                (form.bonusType === "FIXED_AMOUNT" || form.bonusType === "HOURLY_RATE")
                  ? form.bonusAmount <= 0
                  : !form.rateMultiplier || form.rateMultiplier <= 0
              )}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Mentés..." : editId ? "Frissítés" : "Létrehozás"}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setForm(emptyForm); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md text-sm hover:bg-gray-200"
              >
                Mégsem
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Név</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Leírás</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Típus</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Összeg</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Kiosztások</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Aktív</th>
              {canWrite && <th className="px-6 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{t.name}</td>
                <td className="px-6 py-4 text-gray-500">{t.description ?? "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.bonusType === "FIXED_AMOUNT" ? "bg-blue-100 text-blue-800"
                    : t.bonusType === "HOURLY_RATE" ? "bg-orange-100 text-orange-800"
                    : t.bonusType === "MULTIPLIER_FULL_HOURLY" ? "bg-purple-100 text-purple-800"
                    : "bg-teal-100 text-teal-800"
                  }`}>
                    {t.bonusType === "FIXED_AMOUNT" ? "Fix"
                      : t.bonusType === "HOURLY_RATE" ? "Órabér"
                      : t.bonusType === "MULTIPLIER_FULL_HOURLY" ? "Teljes órabér ×"
                      : "Szervíz órabér ×"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-medium">
                  {t.bonusType === "FIXED_AMOUNT"
                    ? `${formatCurrency(t.bonusAmount)}/hó`
                    : t.bonusType === "HOURLY_RATE"
                    ? `${formatCurrency(t.bonusAmount)}/óra`
                    : `${t.rateMultiplier}×`}
                </td>
                <td className="px-6 py-4 text-center text-gray-600">{t._count.assignments}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {t.active ? "Igen" : "Nem"}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(t)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 text-red-500 hover:text-red-700 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  Még nincs extra feladat típus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
