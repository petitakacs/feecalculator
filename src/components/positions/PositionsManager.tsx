"use client";

import { useState } from "react";
import { Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { ChevronRight, ChevronDown, Plus, X } from "lucide-react";

interface VariationRow {
  id: string;
  name: string;
  multiplierDelta: number;
  active: boolean;
}

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
  variations: VariationRow[];
}

const DeltaBadge = ({ delta }: { delta: number }) => {
  if (delta === 0) return <span className="text-xs text-gray-400">±0</span>;
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${color}`}>
      {sign}{delta.toFixed(2)}x
    </span>
  );
};

export function PositionsManager({ positions: initial, userRole }: { positions: PositionRow[]; userRole: Role }) {
  const [positions, setPositions] = useState(initial);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PositionRow>>({});
  const [adding, setAdding] = useState(false);
  const [newPos, setNewPos] = useState({ name: "", multiplier: 1.0, eligibleForServiceCharge: true, active: true });
  const [loading, setLoading] = useState(false);

  // Variation state
  const [addingVarFor, setAddingVarFor] = useState<string | null>(null);
  const [newVar, setNewVar] = useState({ name: "", multiplierDelta: 0 });
  const [togglingVar, setTogglingVar] = useState<string | null>(null);
  const [deletingVar, setDeletingVar] = useState<string | null>(null);

  const canWrite = hasPermission(userRole, "positions:write");

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Position CRUD ────────────────────────────────────────────────────────────

  const startEdit = (pos: PositionRow) => { setEditing(pos.id); setEditValues({ ...pos }); };

  const saveEdit = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === id ? { ...p, ...data, multiplier: Number(data.multiplier) } : p));
      setEditing(null);
      showToast("Pozíció frissítve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
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
      if (!res.ok) { showToast(data.error ?? "Létrehozás sikertelen", "error"); return; }
      setPositions((prev) => [...prev, { ...data, multiplier: Number(data.multiplier), employeeCount: 0, variations: [] }]);
      setAdding(false);
      setNewPos({ name: "", multiplier: 1.0, eligibleForServiceCharge: true, active: true });
      showToast("Pozíció létrehozva", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
  };

  const handleTogglePosition = async (pos: PositionRow) => {
    try {
      const res = await fetch(`/api/positions/${pos.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pos.active }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Hiba", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === pos.id ? { ...p, active: !pos.active } : p));
      showToast(pos.active ? `${pos.name} inaktiválva` : `${pos.name} aktiválva`, "success");
    } catch { showToast("Hálózati hiba", "error"); }
  };

  // ── Variation CRUD ───────────────────────────────────────────────────────────

  const handleAddVariation = async (positionId: string) => {
    if (!newVar.name.trim()) { showToast("Adj meg egy nevet", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVar),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Létrehozás sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) =>
        p.id === positionId
          ? { ...p, variations: [...p.variations, { ...data, multiplierDelta: Number(data.multiplierDelta) }] }
          : p
      ));
      setAddingVarFor(null);
      setNewVar({ name: "", multiplierDelta: 0 });
      showToast("Változat hozzáadva", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
  };

  const handleToggleVariation = async (positionId: string, v: VariationRow) => {
    setTogglingVar(v.id);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !v.active }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Hiba", "error"); return; }
      setPositions((prev) => prev.map((p) =>
        p.id === positionId
          ? { ...p, variations: p.variations.map((vv) => vv.id === v.id ? { ...vv, active: !v.active } : vv) }
          : p
      ));
      showToast(v.active ? "Változat inaktiválva" : "Változat aktiválva", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setTogglingVar(null); }
  };

  const handleDeleteVariation = async (positionId: string, varId: string) => {
    if (!confirm("Biztosan törlöd ezt a változatot?")) return;
    setDeletingVar(varId);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations/${varId}`, { method: "DELETE" });
      if (!res.ok) { showToast("Törlés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) =>
        p.id === positionId ? { ...p, variations: p.variations.filter((v) => v.id !== varId) } : p
      ));
      showToast("Változat törölve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setDeletingVar(null); }
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <button onClick={() => setAdding(true)} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700">
            + Új pozíció
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-6"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pozíció neve</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Szorzó</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">SZD jogos.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Dolgozók</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Aktív</th>
              {canWrite && <th className="px-4 py-3 w-24"></th>}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const isExpanded = expanded.has(pos.id);
              return (
                <>
                  {/* ── Position row ── */}
                  <tr key={pos.id} className={`border-b ${pos.active ? "hover:bg-gray-50" : "bg-gray-50 opacity-70"}`}>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggleExpand(pos.id)}
                        className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                        title={isExpanded ? "Változatok elrejtése" : "Változatok mutatása"}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {editing === pos.id ? (
                        <input type="text" value={editValues.name} onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      ) : (
                        <span className={pos.active ? "" : "line-through text-gray-400"}>{pos.name}</span>
                      )}
                      {pos.variations.length > 0 && (
                        <span className="ml-2 text-xs text-indigo-500 font-normal">
                          {pos.variations.filter((v) => v.active).length} változat
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {editing === pos.id ? (
                        <input type="number" step="0.05" value={editValues.multiplier}
                          onChange={(e) => setEditValues((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                      ) : (
                        `${pos.multiplier.toFixed(2)}x`
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pos.eligibleForServiceCharge ? <span className="text-emerald-600">✓</span> : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{pos.employeeCount}</td>
                    <td className="px-4 py-3 text-center">
                      {canWrite ? (
                        <button
                          onClick={() => handleTogglePosition(pos)}
                          title={pos.active ? "Inaktiválás" : "Aktiválás"}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${pos.active ? "bg-emerald-500" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pos.active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                        </button>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${pos.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                          {pos.active ? "Aktív" : "Inaktív"}
                        </span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        {editing === pos.id ? (
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => saveEdit(pos.id)} disabled={loading} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Mentés</button>
                            <button onClick={() => setEditing(null)} className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs">Mégse</button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(pos)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Szerkesztés</button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* ── Variation rows (expanded) ── */}
                  {isExpanded && (
                    <>
                      {pos.variations.map((v) => (
                        <tr key={v.id} className={`border-b bg-indigo-50/40 ${v.active ? "" : "opacity-50"}`}>
                          <td className="px-2 py-2"></td>
                          <td className="px-4 py-2 pl-8 text-indigo-800 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                              <span className={v.active ? "font-medium" : "line-through text-gray-400"}>{v.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <DeltaBadge delta={v.multiplierDelta} />
                              <span className="text-xs font-mono text-gray-700">
                                = {(pos.multiplier + v.multiplierDelta).toFixed(2)}x
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2" colSpan={2} />
                          <td className="px-4 py-2 text-center">
                            {canWrite && (
                              <button
                                onClick={() => handleToggleVariation(pos.id, v)}
                                disabled={togglingVar === v.id}
                                title={v.active ? "Inaktiválás" : "Aktiválás"}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${v.active ? "bg-emerald-500" : "bg-gray-300"}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${v.active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                              </button>
                            )}
                          </td>
                          {canWrite && (
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => handleDeleteVariation(pos.id, v.id)}
                                disabled={deletingVar === v.id}
                                className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40"
                                title="Változat törlése"
                              >
                                <X size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* ── Add variation row ── */}
                      {canWrite && (
                        <tr className="border-b bg-indigo-50/20">
                          <td className="px-2 py-2"></td>
                          <td className="px-4 py-2 pl-8" colSpan={canWrite ? 5 : 4}>
                            {addingVarFor === pos.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Változat neve (pl. Diák)"
                                  value={newVar.name}
                                  onChange={(e) => setNewVar((v) => ({ ...v, name: e.target.value }))}
                                  className="border border-gray-300 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                  autoFocus
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">Delta:</span>
                                  <input
                                    type="number"
                                    step="0.05"
                                    placeholder="0.00"
                                    value={newVar.multiplierDelta}
                                    onChange={(e) => setNewVar((v) => ({ ...v, multiplierDelta: parseFloat(e.target.value) || 0 }))}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs w-20 text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                  />
                                  <span className="text-xs text-gray-400">
                                    → {(pos.multiplier + newVar.multiplierDelta).toFixed(2)}x
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleAddVariation(pos.id)}
                                  disabled={loading}
                                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  Hozzáadás
                                </button>
                                <button
                                  onClick={() => { setAddingVarFor(null); setNewVar({ name: "", multiplierDelta: 0 }); }}
                                  className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"
                                >
                                  Mégse
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingVarFor(pos.id); setNewVar({ name: "", multiplierDelta: 0 }); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                <Plus size={12} /> Változat hozzáadása
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New position modal ── */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold mb-4">Új pozíció</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
                <input type="text" value={newPos.name} onChange={(e) => setNewPos((v) => ({ ...v, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Szorzó</label>
                <input type="number" step="0.05" value={newPos.multiplier}
                  onChange={(e) => setNewPos((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newPos.eligibleForServiceCharge}
                  onChange={(e) => setNewPos((v) => ({ ...v, eligibleForServiceCharge: e.target.checked }))} />
                <span className="text-sm text-gray-700">SZD jogosult</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Mégse</button>
              <button onClick={handleCreate} disabled={loading || !newPos.name}
                className="px-3 py-2 text-sm text-white bg-gray-900 rounded-md disabled:opacity-50 hover:bg-gray-700">
                Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
