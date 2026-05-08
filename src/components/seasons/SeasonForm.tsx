"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Season, Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";

interface SeasonFormProps {
  season: Partial<Season> | null;
  userRole: Role;
}

export function SeasonForm({ season, userRole }: SeasonFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const canWrite = hasPermission(userRole, "seasons:write");
  const isNew = !season?.id;

  const [form, setForm] = useState({
    name: season?.name ?? "",
    startDate: season?.startDate?.split("T")[0] ?? "",
    endDate: season?.endDate?.split("T")[0] ?? "",
    referenceMode: season?.referenceMode ?? "SALES_BASED",
    manualWaiterTargetHourly: season?.manualWaiterTargetHourly
      ? season.manualWaiterTargetHourly / 100
      : 0,
    minAllowedVariance: season?.minAllowedVariance
      ? season.minAllowedVariance * 100
      : -15,
    maxAllowedVariance: season?.maxAllowedVariance
      ? season.maxAllowedVariance * 100
      : 20,
    active: season?.active ?? true,
  });

  const set = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      referenceMode: form.referenceMode,
      active: form.active,
    };

    if (form.referenceMode === "MANUAL_TARGET") {
      payload.manualWaiterTargetHourly = Math.round(form.manualWaiterTargetHourly * 100);
    }
    if (form.referenceMode === "SALES_BASED_WITH_LIMITS") {
      payload.minAllowedVariance = form.minAllowedVariance / 100;
      payload.maxAllowedVariance = form.maxAllowedVariance / 100;
    }

    try {
      const url = isNew ? "/api/seasons" : `/api/seasons/${season?.id}`;
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
      showToast(isNew ? "Season created" : "Season updated", "success");
      router.push("/seasons");
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
          <label className={labelClass}>Season Name *</label>
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
            <label className={labelClass}>End Date *</label>
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              disabled={!canWrite}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Calculation Mode *</label>
          <select
            value={form.referenceMode}
            onChange={(e) => set("referenceMode", e.target.value)}
            disabled={!canWrite}
            className={inputClass}
          >
            <option value="SALES_BASED">A: Sales Based (auto-calculate from waiter sales)</option>
            <option value="MANUAL_TARGET">B: Manual Seasonal Target (fixed waiter hourly rate)</option>
            <option value="SALES_BASED_WITH_LIMITS">C: Sales Based with Min/Max Limits</option>
          </select>
        </div>

        {form.referenceMode === "MANUAL_TARGET" && (
          <div>
            <label className={labelClass}>Manual Waiter Target Hourly Rate (€/hr)</label>
            <input
              type="number"
              step="0.01"
              value={form.manualWaiterTargetHourly}
              onChange={(e) => set("manualWaiterTargetHourly", parseFloat(e.target.value) || 0)}
              disabled={!canWrite}
              className={inputClass}
            />
          </div>
        )}

        {form.referenceMode === "SALES_BASED_WITH_LIMITS" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Min Variance (%)</label>
              <input
                type="number"
                step="1"
                value={form.minAllowedVariance}
                onChange={(e) => set("minAllowedVariance", parseFloat(e.target.value))}
                disabled={!canWrite}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1">e.g., -15 for -15%</p>
            </div>
            <div>
              <label className={labelClass}>Max Variance (%)</label>
              <input
                type="number"
                step="1"
                value={form.maxAllowedVariance}
                onChange={(e) => set("maxAllowedVariance", parseFloat(e.target.value))}
                disabled={!canWrite}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1">e.g., 20 for +20%</p>
            </div>
          </div>
        )}

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

        {canWrite && (
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving..." : isNew ? "Create Season" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/seasons")}
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
