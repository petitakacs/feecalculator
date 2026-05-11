"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/ui/toaster";
import { useLocationFilter } from "@/lib/location-context";
import { formatInteger, parseFormattedInteger } from "@/lib/format";

interface Season {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

export function CreatePeriodButton({
  seasons,
  locations,
}: {
  seasons: Season[];
  locations: Location[];
}) {
  const router = useRouter();
  const { selectedLocationId } = useLocationFilter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingBalanceStr, setOpeningBalanceStr] = useState("0");
  const [collectedSCStr, setCollectedSCStr] = useState("0");
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    seasonId: seasons[0]?.id ?? "",
    locationId: selectedLocationId ?? locations[0]?.id ?? "",
    openingBalance: 0,
    collectedServiceCharge: 0,
    notes: "",
    calculationMode: "STANDARD" as "STANDARD" | "FIXED_RATE",
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
        onClick={() => {
          setForm((f) => ({ ...f, locationId: selectedLocationId ?? locations[0]?.id ?? "" }));
          setOpeningBalanceStr("0");
          setCollectedSCStr("0");
          setOpen(true);
        }}
        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        title={seasons.length === 0 ? "Először hozz létre egy szezont" : undefined}
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

              {seasons.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                  Nincs aktív szezon. Először hozz létre egy szezont a Seasons oldalon.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Season</label>
                  <select
                    value={form.seasonId}
                    onChange={(e) => setForm((f) => ({ ...f, seasonId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {seasons.length === 0 && <option value="">— Nincs aktív szezon —</option>}
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lokáció</label>
                  <select
                    value={form.locationId}
                    onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">— Nincs —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nyitó egyenleg (Ft)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={openingBalanceStr}
                  onChange={(e) => {
                    const raw = parseFormattedInteger(e.target.value);
                    setOpeningBalanceStr(raw);
                    setForm((f) => ({ ...f, openingBalance: parseInt(raw, 10) || 0 }));
                  }}
                  onBlur={() => setOpeningBalanceStr(formatInteger(form.openingBalance) || "0")}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Befolyt szervízdíj (Ft)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={collectedSCStr}
                  onChange={(e) => {
                    const raw = parseFormattedInteger(e.target.value);
                    setCollectedSCStr(raw);
                    setForm((f) => ({ ...f, collectedServiceCharge: parseInt(raw, 10) || 0 }));
                  }}
                  onBlur={() => setCollectedSCStr(formatInteger(form.collectedServiceCharge) || "0")}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Számítási mód</label>
                <select
                  value={form.calculationMode}
                  onChange={(e) => setForm((f) => ({ ...f, calculationMode: e.target.value as "STANDARD" | "FIXED_RATE" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="STANDARD">Standard (pincér eladás alapú)</option>
                  <option value="FIXED_RATE">Rögzített óradíj (pozíciónkénti fix SZD)</option>
                </select>
                {form.calculationMode === "FIXED_RATE" && (
                  <p className="mt-1 text-xs text-amber-600">
                    Rögzített óradíj módban minden pozícióhoz be kell állítani a fix SZD óradíjat a Pozíciók oldalon.
                  </p>
                )}
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
