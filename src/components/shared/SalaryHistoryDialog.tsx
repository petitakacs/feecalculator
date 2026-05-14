"use client";

import { useState, useEffect, useCallback } from "react";
import { History, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { showToast } from "@/components/ui/toaster";

interface SalaryHistoryEntry {
  id: string;
  baseSalaryType: "HOURLY" | "MONTHLY";
  baseSalaryAmount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  createdAt: string;
}

interface SalaryHistoryDialogProps {
  employeeId: string;
  employeeName: string;
  currentType: "HOURLY" | "MONTHLY";
  currentAmount: number;
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

export function SalaryHistoryDialog({
  employeeId,
  employeeName,
  currentType,
  currentAmount,
  trigger,
}: SalaryHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<SalaryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formType, setFormType] = useState<"HOURLY" | "MONTHLY">(currentType);
  const [formAmount, setFormAmount] = useState(String(currentAmount));
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(today());
  const [formNote, setFormNote] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/salary-history`);
      if (res.ok) setHistory(await res.json());
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  const handleSave = async () => {
    const amount = parseInt(formAmount);
    if (isNaN(amount) || amount < 0) {
      showToast("Érvénytelen alapbér összeg", "error");
      return;
    }
    if (!formEffectiveFrom) {
      showToast("Az érvényesség kezdete kötelező", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/salary-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseSalaryType: formType,
          baseSalaryAmount: amount,
          effectiveFrom: formEffectiveFrom,
          note: formNote || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? "Hiba a mentés során", "error");
        return;
      }
      showToast("Új alapbér mentve", "success");
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
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
          >
            <History size={13} />
            Alapbér előzmények
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
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Alapbér előzmények</h2>
                  <p className="text-xs text-gray-500">{employeeName}</p>
                </div>
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
              {showForm ? (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-900">Új alapbér rögzítése</h3>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Típus</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as "HOURLY" | "MONTHLY")}
                        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="HOURLY">Órabér</option>
                        <option value="MONTHLY">Havi bér</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Összeg ({formType === "HOURLY" ? "Ft/óra" : "Ft/hó"})
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
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
                  Új alapbér rögzítése
                </button>
              )}

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
                        <th className="text-right pb-2 pr-4">Típus</th>
                        <th className="text-right pb-2 pr-4">Összeg</th>
                        <th className="text-left pb-2">Megjegyzés</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((h) => {
                        const isActive = h.effectiveTo === null;
                        return (
                          <tr key={h.id} className={isActive ? "bg-green-50" : "text-gray-500"}>
                            <td className="py-2 pr-4 whitespace-nowrap text-xs">
                              {formatDate(h.effectiveFrom)}
                              {" – "}
                              {h.effectiveTo ? (
                                formatDate(h.effectiveTo)
                              ) : (
                                <span className="text-green-700 font-medium">jelenleg</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-right text-xs">
                              {h.baseSalaryType === "HOURLY" ? "Órabér" : "Havi bér"}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-xs">
                              {formatCurrency(h.baseSalaryAmount)}
                              {h.baseSalaryType === "HOURLY" ? "/óra" : "/hó"}
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
