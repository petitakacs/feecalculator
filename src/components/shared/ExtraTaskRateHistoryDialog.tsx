"use client";

import { useState, useEffect, useCallback } from "react";
import { History, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";
import { ExtraBonusType } from "@/types";

interface ExtraTaskRateHistoryEntry {
  id: string;
  bonusType: ExtraBonusType;
  bonusAmount: number;
  rateMultiplier: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

interface ExtraTaskRateHistoryDialogProps {
  extraTaskTypeId: string;
  taskName: string;
  currentBonusType: ExtraBonusType;
  currentBonusAmount: number;
  currentRateMultiplier?: number | null;
  trigger?: React.ReactNode;
}

const BONUS_TYPE_LABELS: Record<ExtraBonusType, string> = {
  FIXED_AMOUNT: "Fix összeg",
  HOURLY_RATE: "Órabér",
  MULTIPLIER_FULL_HOURLY: "Teljes órabér ×",
  MULTIPLIER_SERVICE_CHARGE_HOURLY: "Szervíz órabér ×",
};

function isMultiplierType(t: ExtraBonusType) {
  return t === "MULTIPLIER_FULL_HOURLY" || t === "MULTIPLIER_SERVICE_CHARGE_HOURLY";
}

function formatAmount(entry: ExtraTaskRateHistoryEntry) {
  if (isMultiplierType(entry.bonusType)) return `${entry.rateMultiplier}×`;
  return `${formatCurrency(entry.bonusAmount)}${entry.bonusType === "HOURLY_RATE" ? "/óra" : "/hó"}`;
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

export function ExtraTaskRateHistoryDialog({
  extraTaskTypeId,
  taskName,
  currentBonusType,
  currentBonusAmount,
  currentRateMultiplier,
  trigger,
}: ExtraTaskRateHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ExtraTaskRateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formBonusType, setFormBonusType] = useState<ExtraBonusType>(currentBonusType);
  const [formAmount, setFormAmount] = useState(String(currentBonusAmount));
  const [formMultiplier, setFormMultiplier] = useState(String(currentRateMultiplier ?? 1));
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(today());
  const [formNote, setFormNote] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/extra-task-types/${extraTaskTypeId}/rate-history`);
      if (res.ok) setHistory(await res.json());
    } finally {
      setLoading(false);
    }
  }, [extraTaskTypeId]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  const handleSave = async () => {
    if (!formEffectiveFrom) { showToast("Az érvényesség kezdete kötelező", "error"); return; }
    const multiplierType = isMultiplierType(formBonusType);
    const bonusAmount = multiplierType ? 0 : parseInt(formAmount);
    const rateMultiplier = multiplierType ? parseFloat(formMultiplier) : null;
    if (!multiplierType && isNaN(bonusAmount)) { showToast("Érvénytelen összeg", "error"); return; }
    if (multiplierType && isNaN(rateMultiplier!)) { showToast("Érvénytelen szorzó", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/extra-task-types/${extraTaskTypeId}/rate-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bonusType: formBonusType,
          bonusAmount,
          rateMultiplier,
          effectiveFrom: formEffectiveFrom,
          note: formNote || undefined,
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Új díjszabás mentve", "success");
      setShowForm(false);
      setFormNote("");
      await fetchHistory();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <button type="button" className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
            <History size={13} />
            Előzmények
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Díjszabás előzmények</h2>
                  <p className="text-xs text-gray-500">{taskName}</p>
                </div>
              </div>
              <button onClick={() => { setOpen(false); setShowForm(false); }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {showForm ? (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-900">Új díjszabás rögzítése</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Típus</label>
                      <select
                        value={formBonusType}
                        onChange={(e) => setFormBonusType(e.target.value as ExtraBonusType)}
                        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="FIXED_AMOUNT">Fix összeg (Ft/hó)</option>
                        <option value="HOURLY_RATE">Órabér (Ft/óra)</option>
                        <option value="MULTIPLIER_FULL_HOURLY">Teljes órabér szorzója</option>
                        <option value="MULTIPLIER_SERVICE_CHARGE_HOURLY">Szervíz órabér szorzója</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Érvényesség kezdete</label>
                      <input
                        type="date"
                        value={formEffectiveFrom}
                        onChange={(e) => setFormEffectiveFrom(e.target.value)}
                        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {isMultiplierType(formBonusType) ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Szorzó (×)</label>
                      <input
                        type="number" step="0.1" min="0"
                        value={formMultiplier}
                        onChange={(e) => setFormMultiplier(e.target.value)}
                        className="w-32 border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Összeg ({formBonusType === "HOURLY_RATE" ? "Ft/óra" : "Ft/hó"})
                      </label>
                      <input
                        type="number" step="1" min="0"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-40 border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Megjegyzés (opcionális)</label>
                    <input
                      type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="pl. Éves bérfelülvizsgálat 2025" maxLength={500}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50">Mégse</button>
                    <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "Mentés..." : "Mentés"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                  <Plus size={15} />
                  Új díjszabás rögzítése
                </button>
              )}

              {loading ? (
                <p className="text-sm text-gray-500 py-4 text-center">Betöltés...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Nincs rögzített előzmény.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left pb-2 pr-4">Érvényesség</th>
                        <th className="text-left pb-2 pr-4">Típus</th>
                        <th className="text-right pb-2 pr-4">Összeg</th>
                        <th className="text-left pb-2">Megjegyzés</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((h) => (
                        <tr key={h.id} className={h.effectiveTo === null ? "bg-green-50" : "text-gray-500"}>
                          <td className="py-2 pr-4 whitespace-nowrap text-xs">
                            {formatDate(h.effectiveFrom)}
                            {" – "}
                            {h.effectiveTo ? formatDate(h.effectiveTo) : <span className="text-green-700 font-medium">jelenleg</span>}
                          </td>
                          <td className="py-2 pr-4 text-xs">{BONUS_TYPE_LABELS[h.bonusType]}</td>
                          <td className="py-2 pr-4 text-right font-mono text-xs">{formatAmount(h)}</td>
                          <td className="py-2 text-xs text-gray-500 max-w-[200px] truncate">{h.note ?? ""}</td>
                        </tr>
                      ))}
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
