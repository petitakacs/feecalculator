"use client";

import { useState, useEffect, useCallback } from "react";
import { History, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";

interface RateHistoryEntry {
  id: string;
  multiplier?: number;
  multiplierDelta?: number;
  fixedHourlySZD: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt: string;
}

interface RateHistoryDialogProps {
  title: string;
  fetchUrl: string;
  postUrl: string;
  /** position/variation: shows multiplier + optional fixed. fixedOnly: only fixed rate (for location rates). */
  mode: "position" | "variation" | "fixedOnly";
  currentMultiplier?: number;
  currentFixedHourlySZD?: number | null;
  /** Extra fields merged into the POST payload (e.g. locationId for location-specific rates). */
  extraPayload?: Record<string, unknown>;
  trigger?: React.ReactNode;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

export function RateHistoryDialog({
  title,
  fetchUrl,
  postUrl,
  mode,
  currentMultiplier,
  currentFixedHourlySZD,
  extraPayload,
  trigger,
}: RateHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<RateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formMultiplier, setFormMultiplier] = useState(
    String(currentMultiplier ?? 1.0)
  );
  const [formFixed, setFormFixed] = useState(
    currentFixedHourlySZD != null ? String(currentFixedHourlySZD) : ""
  );
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(today());
  const [formNote, setFormNote] = useState("");
  const [useFixed, setUseFixed] = useState(mode === "fixedOnly" || currentFixedHourlySZD != null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  const handleSave = async () => {
    const multiplierVal = parseFloat(formMultiplier);
    if (isNaN(multiplierVal) || multiplierVal <= 0) {
      showToast("Érvénytelen szorzó érték", "error");
      return;
    }
    if (!formEffectiveFrom) {
      showToast("Az érvényesség kezdete kötelező", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      ...(extraPayload ?? {}),
      effectiveFrom: formEffectiveFrom,
      note: formNote || undefined,
    };

    if (mode === "fixedOnly") {
      if (!formFixed) { showToast("Add meg a fix óradíjat", "error"); return; }
      payload.fixedHourlySZD = parseInt(formFixed);
    } else if (mode === "position") {
      payload.multiplier = multiplierVal;
      payload.fixedHourlySZD = useFixed && formFixed !== "" ? parseInt(formFixed) : null;
    } else {
      payload.multiplierDelta = multiplierVal;
      payload.fixedHourlySZD = useFixed && formFixed !== "" ? parseInt(formFixed) : null;
    }

    setSaving(true);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Hiba a mentés során", "error");
        return;
      }
      showToast("Új díjszabás mentve", "success");
      setShowForm(false);
      setFormNote("");
      await fetchHistory();
    } finally {
      setSaving(false);
    }
  };

  const multiplierLabel = mode === "position" ? "Szorzó" : "Szorzó delta";

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
          >
            <History size={13} />
            Előzmények
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              </div>
              <button
                onClick={() => { setOpen(false); setShowForm(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Add new entry form */}
              {showForm ? (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-900">Új díjszabás rögzítése</h3>

                  <div className="grid grid-cols-2 gap-3">
                    {mode !== "fixedOnly" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {multiplierLabel}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formMultiplier}
                          onChange={(e) => setFormMultiplier(e.target.value)}
                          className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={mode === "position" ? "pl. 1.15" : "pl. -0.10"}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Érvényesség kezdete
                      </label>
                      <input
                        type="date"
                        value={formEffectiveFrom}
                        onChange={(e) => setFormEffectiveFrom(e.target.value)}
                        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {mode === "fixedOnly" ? (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-700">Fix óradíj (Ft/óra)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formFixed}
                        onChange={(e) => setFormFixed(e.target.value)}
                        className="w-32 border rounded px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="pl. 1800"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useFixed"
                        checked={useFixed}
                        onChange={(e) => setUseFixed(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="useFixed" className="text-xs text-gray-700">
                        Fix óradíj (felülírja a szorzót)
                      </label>
                      {useFixed && (
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={formFixed}
                          onChange={(e) => setFormFixed(e.target.value)}
                          className="ml-2 w-32 border rounded px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="pl. 1800"
                        />
                      )}
                      {useFixed && <span className="text-xs text-gray-500">Ft/óra</span>}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Megjegyzés (opcionális)
                    </label>
                    <input
                      type="text"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Éves bérfelülvizsgálat 2025"
                      maxLength={500}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setShowForm(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50"
                    >
                      Mégse
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Mentés..." : "Mentés"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Plus size={15} />
                  Új díjszabás rögzítése
                </button>
              )}

              {/* History table */}
              {loading ? (
                <p className="text-sm text-gray-500 py-4 text-center">Betöltés...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  Nincs rögzített előzmény. Az első bejegyzés létrehozásával indul el a nyomon követés.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left pb-2 pr-4">Érvényesség</th>
                        <th className="text-right pb-2 pr-4">{multiplierLabel}</th>
                        <th className="text-right pb-2 pr-4">Fix óradíj</th>
                        <th className="text-left pb-2">Megjegyzés</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((h) => {
                        const isActive = h.effectiveTo === null;
                        return (
                          <tr
                            key={h.id}
                            className={isActive ? "bg-green-50" : "text-gray-500"}
                          >
                            <td className="py-2 pr-4 whitespace-nowrap">
                              <span className="text-xs">
                                {formatDate(h.effectiveFrom)}
                                {" – "}
                                {h.effectiveTo ? formatDate(h.effectiveTo) : (
                                  <span className="text-green-700 font-medium">jelenleg</span>
                                )}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-xs">
                              {h.multiplier !== undefined
                                ? `${Number(h.multiplier).toFixed(2)}x`
                                : h.multiplierDelta !== undefined
                                ? `${Number(h.multiplierDelta) >= 0 ? "+" : ""}${Number(h.multiplierDelta).toFixed(2)}x`
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-right text-xs font-mono">
                              {h.fixedHourlySZD != null
                                ? formatCurrency(h.fixedHourlySZD) + "/óra"
                                : "—"}
                            </td>
                            <td className="py-2 text-xs text-gray-500 max-w-[200px] truncate">
                              {h.note ?? ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
