"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/ui/toaster";

interface Season {
  id: string;
  name: string;
}

export function CreatePeriodButton({ seasons }: { seasons: Season[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    seasonId: seasons[0]?.id ?? "",
    openingBalance: 0,
    collectedServiceCharge: 0,
    notes: "",
  });

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to create period", "error");
        return;
      }
      showToast("Period created", "success");
      setOpen(false);
      router.push(`/periods/${data.id}`);
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    "Január", "Február", "Március", "Április", "Május", "Június",
    "Július", "Augusztus", "Szeptember", "Október", "November", "December",
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
      >
        + New Period
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold">Új periódus létrehozása</h2>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {monthNames.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Season</label>
                <select
                  value={form.seasonId}
                  onChange={(e) => setForm((f) => ({ ...f, seasonId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nyitó egyenleg (Ft)
                </label>
                <input
                  type="number"
                  value={form.openingBalance}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      openingBalance: Math.round(parseFloat(e.target.value || "0")),
                    }))
                  }
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Befolyt szervízdíj (Ft)
                </label>
                <input
                  type="number"
                  value={form.collectedServiceCharge}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      collectedServiceCharge: Math.round(parseFloat(e.target.value || "0")),
                    }))
                  }
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Megjegyzés</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Mégsem
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !form.seasonId}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Létrehozás..." : "Létrehozás"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
