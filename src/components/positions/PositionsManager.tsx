"use client";

import React, { useState } from "react";
import { Role } from "@/types";
import { showToast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/format";
import { ChevronRight, ChevronDown, Plus, X, GripVertical } from "lucide-react";

interface LocationRate {
  id: string;
  locationId: string;
  fixedHourlySZD: number;
  location: { id: string; name: string };
}

interface VariationRow {
  id: string;
  name: string;
  multiplierDelta: number;
  fixedHourlySZD: number | null;
  active: boolean;
  locationRates: LocationRate[];
}

interface PositionRow {
  id: string;
  name: string;
  multiplier: number;
  fixedHourlySZD: number | null;
  eligibleForServiceCharge: boolean;
  defaultOvertimeRule?: string;
  minHourlyServiceCharge?: number;
  maxHourlyServiceCharge?: number;
  sortOrder: number;
  active: boolean;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
  variations: VariationRow[];
  locationRates: LocationRate[];
}

const RateDisplay = ({ multiplier, fixedHourlySZD }: { multiplier: number; fixedHourlySZD: number | null }) => {
  if (fixedHourlySZD != null) {
    return (
      <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
        Fix: {formatCurrency(fixedHourlySZD)}/óra
      </span>
    );
  }
  return <span className="font-mono text-gray-700">{multiplier.toFixed(2)}x</span>;
};

const VariationRateDisplay = ({
  baseMultiplier,
  baseFixed,
  delta,
  fixedHourlySZD,
}: {
  baseMultiplier: number;
  baseFixed: number | null;
  delta: number;
  fixedHourlySZD: number | null;
}) => {
  if (fixedHourlySZD != null) {
    return (
      <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
        Fix: {formatCurrency(fixedHourlySZD)}/óra
      </span>
    );
  }
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? "text-emerald-700 bg-emerald-50" : delta < 0 ? "text-red-700 bg-red-50" : "text-gray-400";
  if (delta === 0) {
    return (
      <span className={`text-xs ${color}`}>
        ±0 {baseFixed != null ? `(Fix: ${formatCurrency(baseFixed)})` : `→ ${baseMultiplier.toFixed(2)}x`}
      </span>
    );
  }
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${color}`}>
        {sign}{delta.toFixed(2)}x
      </span>
      {baseFixed == null && (
        <span className="text-xs font-mono text-gray-700">= {(baseMultiplier + delta).toFixed(2)}x</span>
      )}
    </span>
  );
};

export function PositionsManager({
  positions: initial,
  userRole,
  locations,
}: {
  positions: PositionRow[];
  userRole: Role;
  locations: { id: string; name: string }[];
}) {
  const [positions, setPositions] = useState(initial);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PositionRow & { useFixed: boolean }>>({});
  const [adding, setAdding] = useState(false);
  const [newPos, setNewPos] = useState({ name: "", multiplier: 1.0, fixedHourlySZD: null as number | null, useFixed: false, eligibleForServiceCharge: true, active: true });
  const [loading, setLoading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [addingVarFor, setAddingVarFor] = useState<string | null>(null);
  const [newVar, setNewVar] = useState({ name: "", multiplierDelta: 0, fixedHourlySZD: null as number | null, useFixed: false });
  const [togglingVar, setTogglingVar] = useState<string | null>(null);
  const [deletingVar, setDeletingVar] = useState<string | null>(null);

  const [addingLocRateFor, setAddingLocRateFor] = useState<string | null>(null);
  const [newLocRate, setNewLocRate] = useState({ locationId: "", fixedHourlySZD: null as number | null });
  const [savingLocRate, setSavingLocRate] = useState(false);
  const [deletingLocRate, setDeletingLocRate] = useState<string | null>(null);

  const [addingVarLocRateFor, setAddingVarLocRateFor] = useState<string | null>(null);
  const [newVarLocRate, setNewVarLocRate] = useState({ locationId: "", fixedHourlySZD: null as number | null });
  const [savingVarLocRate, setSavingVarLocRate] = useState(false);
  const [deletingVarLocRate, setDeletingVarLocRate] = useState<string | null>(null);

  const canWrite = hasPermission(userRole, "positions:write");

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Position CRUD ─────────────────────────────────────────────────────────────

  const startEdit = (pos: PositionRow) => {
    setEditing(pos.id);
    setEditValues({ ...pos, useFixed: pos.fixedHourlySZD != null });
  };

  const saveEdit = async (id: string) => {
    setLoading(true);
    const payload = {
      name: editValues.name,
      multiplier: editValues.multiplier,
      fixedHourlySZD: editValues.useFixed ? (editValues.fixedHourlySZD ?? null) : null,
      eligibleForServiceCharge: editValues.eligibleForServiceCharge,
    };
    try {
      const res = await fetch(`/api/positions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === id ? { ...p, ...data, multiplier: Number(data.multiplier), fixedHourlySZD: data.fixedHourlySZD ?? null } : p));
      setEditing(null);
      showToast("Pozíció frissítve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setLoading(true);
    const payload = { name: newPos.name, multiplier: newPos.multiplier, fixedHourlySZD: newPos.useFixed ? newPos.fixedHourlySZD : null, eligibleForServiceCharge: newPos.eligibleForServiceCharge, active: newPos.active };
    try {
      const res = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Létrehozás sikertelen", "error"); return; }
      setPositions((prev) => [...prev, { ...data, multiplier: Number(data.multiplier), fixedHourlySZD: data.fixedHourlySZD ?? null, employeeCount: 0, variations: [] }]);
      setAdding(false);
      setNewPos({ name: "", multiplier: 1.0, fixedHourlySZD: null, useFixed: false, eligibleForServiceCharge: true, active: true });
      showToast("Pozíció létrehozva", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
  };

  const handleTogglePosition = async (pos: PositionRow) => {
    try {
      const res = await fetch(`/api/positions/${pos.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !pos.active }) });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Hiba", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === pos.id ? { ...p, active: !pos.active } : p));
      showToast(pos.active ? `${pos.name} inaktiválva` : `${pos.name} aktiválva`, "success");
    } catch { showToast("Hálózati hiba", "error"); }
  };

  // ── Drag reorder ──────────────────────────────────────────────────────────────

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const reordered = [...positions];
    const fromIdx = reordered.findIndex((p) => p.id === dragId);
    const toIdx = reordered.findIndex((p) => p.id === targetId);
    const [item] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);
    setPositions(reordered);
    setDragId(null);
    setDragOverId(null);
    try {
      await fetch("/api/positions/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: reordered.map((p) => p.id) }) });
    } catch { showToast("Sorrend mentése sikertelen", "error"); }
  };

  // ── Variation CRUD ────────────────────────────────────────────────────────────

  const handleAddVariation = async (positionId: string) => {
    if (!newVar.name.trim()) { showToast("Adj meg egy nevet", "error"); return; }
    setLoading(true);
    const payload = { name: newVar.name, multiplierDelta: newVar.useFixed ? 0 : newVar.multiplierDelta, fixedHourlySZD: newVar.useFixed ? newVar.fixedHourlySZD : null };
    try {
      const res = await fetch(`/api/positions/${positionId}/variations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Létrehozás sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === positionId ? { ...p, variations: [...p.variations, { ...data, multiplierDelta: Number(data.multiplierDelta), fixedHourlySZD: data.fixedHourlySZD ?? null }] } : p));
      setAddingVarFor(null);
      setNewVar({ name: "", multiplierDelta: 0, fixedHourlySZD: null, useFixed: false });
      showToast("Változat hozzáadva", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setLoading(false); }
  };

  const handleToggleVariation = async (positionId: string, v: VariationRow) => {
    setTogglingVar(v.id);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !v.active }) });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Hiba", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === positionId ? { ...p, variations: p.variations.map((vv) => vv.id === v.id ? { ...vv, active: !v.active } : vv) } : p));
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
      setPositions((prev) => prev.map((p) => p.id === positionId ? { ...p, variations: p.variations.filter((v) => v.id !== varId) } : p));
      showToast("Változat törölve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setDeletingVar(null); }
  };

  // ── Location rate CRUD ────────────────────────────────────────────────────────

  const handleSaveLocRate = async (positionId: string) => {
    if (!newLocRate.locationId) { showToast("Válassz helyszínt", "error"); return; }
    if (newLocRate.fixedHourlySZD == null) { showToast("Add meg a díjat", "error"); return; }
    setSavingLocRate(true);
    try {
      const res = await fetch(`/api/positions/${positionId}/location-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: newLocRate.locationId, fixedHourlySZD: newLocRate.fixedHourlySZD }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => {
        if (p.id !== positionId) return p;
        const existing = p.locationRates.find((r) => r.locationId === data.locationId);
        const updated = existing
          ? p.locationRates.map((r) => r.locationId === data.locationId ? data : r)
          : [...p.locationRates, data];
        return { ...p, locationRates: updated };
      }));
      setAddingLocRateFor(null);
      setNewLocRate({ locationId: "", fixedHourlySZD: null });
      showToast("Lokáció díj mentve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setSavingLocRate(false); }
  };

  const handleDeleteLocRate = async (positionId: string, locationId: string) => {
    if (!confirm("Biztosan törlöd ezt a lokáció-specifikus díjat?")) return;
    setDeletingLocRate(locationId);
    try {
      const res = await fetch(`/api/positions/${positionId}/location-rates/${locationId}`, { method: "DELETE" });
      if (!res.ok) { showToast("Törlés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => p.id === positionId ? { ...p, locationRates: p.locationRates.filter((r) => r.locationId !== locationId) } : p));
      showToast("Lokáció díj törölve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setDeletingLocRate(null); }
  };

  const handleSaveVarLocRate = async (positionId: string, varId: string) => {
    if (!newVarLocRate.locationId) { showToast("Válassz helyszínt", "error"); return; }
    if (newVarLocRate.fixedHourlySZD == null) { showToast("Add meg a díjat", "error"); return; }
    setSavingVarLocRate(true);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations/${varId}/location-rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: newVarLocRate.locationId, fixedHourlySZD: newVarLocRate.fixedHourlySZD }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => {
        if (p.id !== positionId) return p;
        return {
          ...p,
          variations: p.variations.map((v) => {
            if (v.id !== varId) return v;
            const existing = v.locationRates.find((r) => r.locationId === data.locationId);
            const updated = existing
              ? v.locationRates.map((r) => r.locationId === data.locationId ? data : r)
              : [...v.locationRates, data];
            return { ...v, locationRates: updated };
          }),
        };
      }));
      setAddingVarLocRateFor(null);
      setNewVarLocRate({ locationId: "", fixedHourlySZD: null });
      showToast("Variáció lokáció díj mentve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setSavingVarLocRate(false); }
  };

  const handleDeleteVarLocRate = async (positionId: string, varId: string, locationId: string) => {
    if (!confirm("Biztosan törlöd ezt a lokáció-specifikus díjat?")) return;
    setDeletingVarLocRate(locationId);
    try {
      const res = await fetch(`/api/positions/${positionId}/variations/${varId}/location-rates/${locationId}`, { method: "DELETE" });
      if (!res.ok) { showToast("Törlés sikertelen", "error"); return; }
      setPositions((prev) => prev.map((p) => {
        if (p.id !== positionId) return p;
        return {
          ...p,
          variations: p.variations.map((v) =>
            v.id === varId ? { ...v, locationRates: v.locationRates.filter((r) => r.locationId !== locationId) } : v
          ),
        };
      }));
      showToast("Variáció lokáció díj törölve", "success");
    } catch { showToast("Hálózati hiba", "error"); }
    finally { setDeletingVarLocRate(null); }
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
              {canWrite && <th className="w-8 px-2 py-3" title="Húzd át a sorrendjük megváltoztatásához" />}
              <th className="text-left px-2 py-3 font-medium text-gray-500 w-6" />
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pozíció neve</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Szorzó / Fix óradíj</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">SZD jogos.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Dolgozók</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Aktív</th>
              {canWrite && <th className="px-4 py-3 w-24" />}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const isExpanded = expanded.has(pos.id);
              const isDragOver = dragOverId === pos.id && dragId !== pos.id;
              return (
                <React.Fragment key={pos.id}>
                  <tr
                    draggable={canWrite}
                    onDragStart={() => setDragId(pos.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(pos.id); }}
                    onDrop={() => handleDrop(pos.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    className={`border-b ${isDragOver ? "bg-indigo-50 outline outline-2 -outline-offset-2 outline-indigo-400" : ""} ${pos.active ? "hover:bg-gray-50" : "bg-gray-50 opacity-70"}`}
                  >
                    {canWrite && (
                      <td className="px-2 py-3 text-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                        <GripVertical size={14} />
                      </td>
                    )}
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => toggleExpand(pos.id)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
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
                        <span className="ml-2 text-xs text-indigo-500 font-normal">{pos.variations.filter((v) => v.active).length} változat</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editing === pos.id ? (
                        <div className="flex flex-col gap-1.5 items-end">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={editValues.useFixed ?? false}
                              onChange={(e) => setEditValues((v) => ({ ...v, useFixed: e.target.checked }))} className="rounded" />
                            Fix óradíj
                          </label>
                          {editValues.useFixed ? (
                            <input type="number" step="100" min="0" placeholder="Ft/óra"
                              value={editValues.fixedHourlySZD ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, fixedHourlySZD: e.target.value ? parseInt(e.target.value) : null }))}
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                          ) : (
                            <input type="number" step="0.05" value={editValues.multiplier}
                              onChange={(e) => setEditValues((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                          )}
                        </div>
                      ) : (
                        <RateDisplay multiplier={pos.multiplier} fixedHourlySZD={pos.fixedHourlySZD} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pos.eligibleForServiceCharge ? <span className="text-emerald-600">✓</span> : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{pos.employeeCount}</td>
                    <td className="px-4 py-3 text-center">
                      {canWrite ? (
                        <button onClick={() => handleTogglePosition(pos)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${pos.active ? "bg-emerald-500" : "bg-gray-300"}`}>
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

                  {isExpanded && (
                    <>
                      {pos.variations.map((v) => (
                        <React.Fragment key={v.id}>
                          <tr className={`border-b bg-indigo-50/40 ${v.active ? "" : "opacity-50"}`}>
                            {canWrite && <td className="px-2 py-2" />}
                            <td className="px-2 py-2" />
                            <td className="px-4 py-2 pl-8 text-indigo-800 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                                <span className={v.active ? "font-medium" : "line-through text-gray-400"}>{v.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <VariationRateDisplay baseMultiplier={pos.multiplier} baseFixed={pos.fixedHourlySZD} delta={v.multiplierDelta} fixedHourlySZD={v.fixedHourlySZD} />
                            </td>
                            <td className="px-4 py-2" colSpan={2} />
                            <td className="px-4 py-2 text-center">
                              {canWrite && (
                                <button onClick={() => handleToggleVariation(pos.id, v)} disabled={togglingVar === v.id}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${v.active ? "bg-emerald-500" : "bg-gray-300"}`}>
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${v.active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                                </button>
                              )}
                            </td>
                            {canWrite && (
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => handleDeleteVariation(pos.id, v.id)} disabled={deletingVar === v.id}
                                  className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40">
                                  <X size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                          {(v.locationRates.length > 0 || canWrite) && (
                            <tr key={`${v.id}-locrates`} className="border-b bg-indigo-50/20">
                              {canWrite && <td className="px-2 py-1" />}
                              <td className="px-2 py-1" />
                              <td className="px-4 py-1.5 pl-12" colSpan={canWrite ? 6 : 5}>
                                <div className="py-0.5">
                                  <p className="text-xs font-medium text-indigo-500 mb-1">↳ Lokáció díjak ({v.name})</p>
                                  {v.locationRates.length > 0 && (
                                    <table className="w-full text-xs mb-1">
                                      <tbody>
                                        {v.locationRates.map((r) => (
                                          <tr key={r.locationId} className="border-t border-indigo-100">
                                            <td className="py-0.5 text-gray-700">{r.location.name}</td>
                                            <td className="py-0.5 text-right">
                                              <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
                                                {formatCurrency(r.fixedHourlySZD)}/óra
                                              </span>
                                            </td>
                                            {canWrite && (
                                              <td className="py-0.5 text-right w-8">
                                                <button
                                                  onClick={() => handleDeleteVarLocRate(pos.id, v.id, r.locationId)}
                                                  disabled={deletingVarLocRate === r.locationId}
                                                  className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40"
                                                >
                                                  <X size={11} />
                                                </button>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                  {canWrite && (
                                    addingVarLocRateFor === v.id ? (
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <select
                                          value={newVarLocRate.locationId}
                                          onChange={(e) => setNewVarLocRate((x) => ({ ...x, locationId: e.target.value }))}
                                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        >
                                          <option value="">Helyszín...</option>
                                          {locations
                                            .filter((loc) => !v.locationRates.some((r) => r.locationId === loc.id))
                                            .map((loc) => (
                                              <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                        <input
                                          type="number"
                                          step="10"
                                          min="0"
                                          placeholder="Ft/óra"
                                          value={newVarLocRate.fixedHourlySZD ?? ""}
                                          onChange={(e) => setNewVarLocRate((x) => ({ ...x, fixedHourlySZD: e.target.value ? parseInt(e.target.value) : null }))}
                                          className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right"
                                        />
                                        <button
                                          onClick={() => handleSaveVarLocRate(pos.id, v.id)}
                                          disabled={savingVarLocRate}
                                          className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                          Mentés
                                        </button>
                                        <button
                                          onClick={() => { setAddingVarLocRateFor(null); setNewVarLocRate({ locationId: "", fixedHourlySZD: null }); }}
                                          className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"
                                        >
                                          Mégse
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setAddingVarLocRateFor(v.id); setNewVarLocRate({ locationId: "", fixedHourlySZD: null }); }}
                                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium mt-0.5"
                                      >
                                        <Plus size={11} /> Lokáció díj hozzáadása
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}

                      <tr className="border-b bg-orange-50/30">
                        {canWrite && <td className="px-2 py-2" />}
                        <td className="px-2 py-2" />
                        <td className="px-4 py-2 pl-8" colSpan={canWrite ? 6 : 5}>
                          <div className="py-1">
                            <p className="text-xs font-medium text-orange-700 mb-1.5">Lokáció-specifikus díjak</p>
                            {pos.locationRates.length > 0 && (
                              <table className="w-full text-xs mb-1.5">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="text-left pb-0.5 font-medium">Lokáció</th>
                                    <th className="text-right pb-0.5 font-medium">Fix SZD óradíj</th>
                                    {canWrite && <th className="w-8" />}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pos.locationRates.map((r) => (
                                    <tr key={r.locationId} className="border-t border-orange-100">
                                      <td className="py-0.5 text-gray-700">{r.location.name}</td>
                                      <td className="py-0.5 text-right">
                                        <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
                                          {formatCurrency(r.fixedHourlySZD)}/óra
                                        </span>
                                      </td>
                                      {canWrite && (
                                        <td className="py-0.5 text-right">
                                          <button
                                            onClick={() => handleDeleteLocRate(pos.id, r.locationId)}
                                            disabled={deletingLocRate === r.locationId}
                                            className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40"
                                          >
                                            <X size={11} />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {canWrite && (
                              addingLocRateFor === pos.id ? (
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <select
                                    value={newLocRate.locationId}
                                    onChange={(e) => setNewLocRate((v) => ({ ...v, locationId: e.target.value }))}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                                  >
                                    <option value="">Helyszín...</option>
                                    {locations
                                      .filter((loc) => !pos.locationRates.some((r) => r.locationId === loc.id))
                                      .map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                      ))}
                                  </select>
                                  <input
                                    type="number"
                                    step="10"
                                    min="0"
                                    placeholder="Ft/óra"
                                    value={newLocRate.fixedHourlySZD ?? ""}
                                    onChange={(e) => setNewLocRate((v) => ({ ...v, fixedHourlySZD: e.target.value ? parseInt(e.target.value) : null }))}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right"
                                  />
                                  <button
                                    onClick={() => handleSaveLocRate(pos.id)}
                                    disabled={savingLocRate}
                                    className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50"
                                  >
                                    Mentés
                                  </button>
                                  <button
                                    onClick={() => { setAddingLocRateFor(null); setNewLocRate({ locationId: "", fixedHourlySZD: null }); }}
                                    className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"
                                  >
                                    Mégse
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAddingLocRateFor(pos.id); setNewLocRate({ locationId: "", fixedHourlySZD: null }); }}
                                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium mt-1"
                                >
                                  <Plus size={12} /> Lokáció díj hozzáadása
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>

                      {canWrite && (
                        <tr className="border-b bg-indigo-50/20">
                          <td className="px-2 py-2" />
                          <td className="px-2 py-2" />
                          <td className="px-4 py-2 pl-8" colSpan={canWrite ? 5 : 4}>
                            {addingVarFor === pos.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input type="text" placeholder="Változat neve (pl. Diák)" value={newVar.name}
                                  onChange={(e) => setNewVar((v) => ({ ...v, name: e.target.value }))}
                                  className="border border-gray-300 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus />
                                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                  <input type="checkbox" checked={newVar.useFixed}
                                    onChange={(e) => setNewVar((v) => ({ ...v, useFixed: e.target.checked }))} className="rounded" />
                                  Fix óradíj
                                </label>
                                {newVar.useFixed ? (
                                  <input type="number" step="100" min="0" placeholder="Ft/óra"
                                    value={newVar.fixedHourlySZD ?? ""}
                                    onChange={(e) => setNewVar((v) => ({ ...v, fixedHourlySZD: e.target.value ? parseInt(e.target.value) : null }))}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right" />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Delta:</span>
                                    <input type="number" step="0.05" placeholder="0.00" value={newVar.multiplierDelta}
                                      onChange={(e) => setNewVar((v) => ({ ...v, multiplierDelta: parseFloat(e.target.value) || 0 }))}
                                      className="border border-gray-300 rounded px-2 py-1 text-xs w-20 text-right" />
                                    {pos.fixedHourlySZD == null && (
                                      <span className="text-xs text-gray-400">→ {(pos.multiplier + newVar.multiplierDelta).toFixed(2)}x</span>
                                    )}
                                  </div>
                                )}
                                <button onClick={() => handleAddVariation(pos.id)} disabled={loading}
                                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50">
                                  Hozzáadás
                                </button>
                                <button onClick={() => { setAddingVarFor(null); setNewVar({ name: "", multiplierDelta: 0, fixedHourlySZD: null, useFixed: false }); }}
                                  className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs">
                                  Mégse
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setAddingVarFor(pos.id); setNewVar({ name: "", multiplierDelta: 0, fixedHourlySZD: null, useFixed: false }); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                <Plus size={12} /> Változat hozzáadása
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

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
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={newPos.useFixed}
                    onChange={(e) => setNewPos((v) => ({ ...v, useFixed: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-gray-700">Fix óradíj (nem szorzó alapú)</span>
                </label>
                {newPos.useFixed ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fix SZD óradíj (Ft)</label>
                    <input type="number" step="100" min="0" value={newPos.fixedHourlySZD ?? ""}
                      onChange={(e) => setNewPos((v) => ({ ...v, fixedHourlySZD: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Szorzó</label>
                    <input type="number" step="0.05" value={newPos.multiplier}
                      onChange={(e) => setNewPos((v) => ({ ...v, multiplier: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newPos.eligibleForServiceCharge}
                  onChange={(e) => setNewPos((v) => ({ ...v, eligibleForServiceCharge: e.target.checked }))} />
                <span className="text-sm text-gray-700">SZD jogosult</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Mégse</button>
              <button onClick={handleCreate} disabled={loading || !newPos.name || (newPos.useFixed && newPos.fixedHourlySZD == null)}
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
