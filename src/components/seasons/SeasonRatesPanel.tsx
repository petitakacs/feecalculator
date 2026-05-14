"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/format";
import { Role } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { Trash2 } from "lucide-react";

interface Position {
  id: string;
  name: string;
  multiplier: number;
  fixedHourlySZD: number | null;
  variations: Variation[];
  locationRates: { locationId: string; fixedHourlySZD: number }[];
}

interface Variation {
  id: string;
  name: string;
  multiplierDelta: number;
  fixedHourlySZD: number | null;
  locationRates: { locationId: string; fixedHourlySZD: number }[];
}

interface Location {
  id: string;
  name: string;
}

interface ExtraTaskType {
  id: string;
  name: string;
  bonusType: string;
  bonusAmount: number;
  rateMultiplier: number | null;
}

interface SeasonRates {
  positionRules: {
    id: string; positionId: string; multiplier: number; fixedHourlySZD: number | null;
    position: { id: string; name: string; multiplier: number; fixedHourlySZD: number | null };
  }[];
  variationRules: {
    id: string; variationId: string; multiplierDelta: number; fixedHourlySZD: number | null;
    variation: { id: string; name: string; multiplierDelta: number; fixedHourlySZD: number | null; position: { id: string; name: string } };
  }[];
  positionLocationRates: {
    id: string; positionId: string; locationId: string; fixedHourlySZD: number;
    position: { id: string; name: string };
    location: { id: string; name: string };
  }[];
  variationLocationRates: {
    id: string; variationId: string; locationId: string; fixedHourlySZD: number;
    variation: { id: string; name: string; position: { id: string; name: string } };
    location: { id: string; name: string };
  }[];
  extraTaskRates: {
    id: string; extraTaskTypeId: string; bonusAmount: number; rateMultiplier: number | null;
    extraTaskType: { id: string; name: string; bonusType: string; bonusAmount: number; rateMultiplier: number | null };
  }[];
}

interface SeasonRatesPanelProps {
  seasonId: string;
  positions: Position[];
  locations: Location[];
  extraTaskTypes: ExtraTaskType[];
  userRole: Role;
}

function isMultiplierBonusType(t: string) {
  return t === "MULTIPLIER_FULL_HOURLY" || t === "MULTIPLIER_SERVICE_CHARGE_HOURLY";
}

export function SeasonRatesPanel({ seasonId, positions, locations, extraTaskTypes, userRole }: SeasonRatesPanelProps) {
  const canWrite = hasPermission(userRole, "settings:write");
  const [rates, setRates] = useState<SeasonRates | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/rates`);
    if (res.ok) setRates(await res.json());
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  // ── Position rules ──────────────────────────────────────────────────────────
  const [posForm, setPosForm] = useState({ positionId: "", multiplier: "", fixedHourlySZD: "" });
  const [posSaving, setPosSaving] = useState(false);

  const savePositionRule = async () => {
    if (!posForm.positionId || !posForm.multiplier) return;
    setPosSaving(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/position-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: posForm.positionId,
          multiplier: parseFloat(posForm.multiplier),
          fixedHourlySZD: posForm.fixedHourlySZD ? parseInt(posForm.fixedHourlySZD) : null,
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Mentve", "success");
      setPosForm({ positionId: "", multiplier: "", fixedHourlySZD: "" });
      await fetchRates();
    } finally { setPosSaving(false); }
  };

  const deletePositionRule = async (positionId: string) => {
    await fetch(`/api/seasons/${seasonId}/position-rules?positionId=${positionId}`, { method: "DELETE" });
    await fetchRates();
  };

  // ── Variation rules ─────────────────────────────────────────────────────────
  const [varForm, setVarForm] = useState({ variationId: "", multiplierDelta: "", fixedHourlySZD: "" });
  const [varSaving, setVarSaving] = useState(false);

  const allVariations = positions.flatMap((p) => p.variations.map((v) => ({ ...v, positionName: p.name })));

  const saveVariationRule = async () => {
    if (!varForm.variationId || !varForm.multiplierDelta) return;
    setVarSaving(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/variation-rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variationId: varForm.variationId,
          multiplierDelta: parseFloat(varForm.multiplierDelta),
          fixedHourlySZD: varForm.fixedHourlySZD ? parseInt(varForm.fixedHourlySZD) : null,
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Mentve", "success");
      setVarForm({ variationId: "", multiplierDelta: "", fixedHourlySZD: "" });
      await fetchRates();
    } finally { setVarSaving(false); }
  };

  const deleteVariationRule = async (variationId: string) => {
    await fetch(`/api/seasons/${seasonId}/variation-rules?variationId=${variationId}`, { method: "DELETE" });
    await fetchRates();
  };

  // ── Position+Location rates ─────────────────────────────────────────────────
  const [posLocForm, setPosLocForm] = useState({ positionId: "", locationId: "", fixedHourlySZD: "" });
  const [posLocSaving, setPosLocSaving] = useState(false);

  const savePosLocRate = async () => {
    if (!posLocForm.positionId || !posLocForm.locationId || !posLocForm.fixedHourlySZD) return;
    setPosLocSaving(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/position-location-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: posLocForm.positionId,
          locationId: posLocForm.locationId,
          fixedHourlySZD: parseInt(posLocForm.fixedHourlySZD),
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Mentve", "success");
      setPosLocForm({ positionId: "", locationId: "", fixedHourlySZD: "" });
      await fetchRates();
    } finally { setPosLocSaving(false); }
  };

  const deletePosLocRate = async (positionId: string, locationId: string) => {
    await fetch(`/api/seasons/${seasonId}/position-location-rates?positionId=${positionId}&locationId=${locationId}`, { method: "DELETE" });
    await fetchRates();
  };

  // ── Variation+Location rates ────────────────────────────────────────────────
  const [varLocForm, setVarLocForm] = useState({ variationId: "", locationId: "", fixedHourlySZD: "" });
  const [varLocSaving, setVarLocSaving] = useState(false);

  const saveVarLocRate = async () => {
    if (!varLocForm.variationId || !varLocForm.locationId || !varLocForm.fixedHourlySZD) return;
    setVarLocSaving(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/variation-location-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variationId: varLocForm.variationId,
          locationId: varLocForm.locationId,
          fixedHourlySZD: parseInt(varLocForm.fixedHourlySZD),
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Mentve", "success");
      setVarLocForm({ variationId: "", locationId: "", fixedHourlySZD: "" });
      await fetchRates();
    } finally { setVarLocSaving(false); }
  };

  const deleteVarLocRate = async (variationId: string, locationId: string) => {
    await fetch(`/api/seasons/${seasonId}/variation-location-rates?variationId=${variationId}&locationId=${locationId}`, { method: "DELETE" });
    await fetchRates();
  };

  // ── Extra task rates ────────────────────────────────────────────────────────
  const [etForm, setEtForm] = useState({ extraTaskTypeId: "", bonusAmount: "", rateMultiplier: "" });
  const [etSaving, setEtSaving] = useState(false);

  const selectedEt = extraTaskTypes.find((e) => e.id === etForm.extraTaskTypeId);
  const etIsMultiplier = selectedEt ? isMultiplierBonusType(selectedEt.bonusType) : false;

  const saveEtRate = async () => {
    if (!etForm.extraTaskTypeId) return;
    setEtSaving(true);
    try {
      const res = await fetch(`/api/seasons/${seasonId}/extra-task-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraTaskTypeId: etForm.extraTaskTypeId,
          bonusAmount: etIsMultiplier ? 0 : parseInt(etForm.bonusAmount),
          rateMultiplier: etIsMultiplier ? parseFloat(etForm.rateMultiplier) : null,
        }),
      });
      if (!res.ok) { showToast((await res.json()).error ?? "Hiba", "error"); return; }
      showToast("Mentve", "success");
      setEtForm({ extraTaskTypeId: "", bonusAmount: "", rateMultiplier: "" });
      await fetchRates();
    } finally { setEtSaving(false); }
  };

  const deleteEtRate = async (extraTaskTypeId: string) => {
    await fetch(`/api/seasons/${seasonId}/extra-task-rates?extraTaskTypeId=${extraTaskTypeId}`, { method: "DELETE" });
    await fetchRates();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const inputClass = "border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";
  const btnClass = "px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50";

  if (loading) return <div className="text-sm text-gray-400 py-4">Betöltés...</div>;
  if (!rates) return null;

  return (
    <div className="space-y-8 mt-8">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Szezonális díjszabás felülírások</h2>
      <p className="text-sm text-gray-500 -mt-6">
        Az itt beállított értékek ebben a szezonban felülírják az érvényes dátum alapú díjszabást.
      </p>

      {/* ── Position multiplier rules ── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pozíció szorzók</h3>
        {rates.positionRules.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="text-left pb-1 pr-4">Pozíció</th>
                <th className="text-right pb-1 pr-4">Szorzó</th>
                <th className="text-right pb-1 pr-4">Fix óradíj</th>
                {canWrite && <th className="pb-1" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.positionRules.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-4">{r.position.name}</td>
                  <td className="py-1.5 pr-4 text-right font-mono">{Number(r.multiplier).toFixed(2)}×</td>
                  <td className="py-1.5 pr-4 text-right font-mono">
                    {r.fixedHourlySZD != null ? formatCurrency(r.fixedHourlySZD) + "/óra" : "—"}
                  </td>
                  {canWrite && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => deletePositionRule(r.positionId)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canWrite && (
          <div className="flex flex-wrap gap-2 items-end">
            <select value={posForm.positionId} onChange={(e) => setPosForm((f) => ({ ...f, positionId: e.target.value }))} className={inputClass}>
              <option value="">Pozíció kiválasztása...</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Szorzó</label>
              <input type="number" step="0.01" placeholder="pl. 1.15" value={posForm.multiplier}
                onChange={(e) => setPosForm((f) => ({ ...f, multiplier: e.target.value }))}
                className={`${inputClass} w-24`} />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Fix óradíj (opcionális)</label>
              <input type="number" step="1" placeholder="Ft/óra" value={posForm.fixedHourlySZD}
                onChange={(e) => setPosForm((f) => ({ ...f, fixedHourlySZD: e.target.value }))}
                className={`${inputClass} w-28`} />
            </div>
            <button onClick={savePositionRule} disabled={posSaving || !posForm.positionId || !posForm.multiplier} className={btnClass}>
              {posSaving ? "..." : "Mentés"}
            </button>
          </div>
        )}
      </section>

      {/* ── Variation delta rules ── */}
      {allVariations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Variáció szorzó delta</h3>
          {rates.variationRules.length > 0 && (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left pb-1 pr-4">Pozíció / Variáció</th>
                  <th className="text-right pb-1 pr-4">Delta szorzó</th>
                  <th className="text-right pb-1 pr-4">Fix óradíj</th>
                  {canWrite && <th className="pb-1" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rates.variationRules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-4">
                      <span className="text-gray-400">{r.variation.position.name} /</span> {r.variation.name}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {Number(r.multiplierDelta) >= 0 ? "+" : ""}{Number(r.multiplierDelta).toFixed(2)}×
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {r.fixedHourlySZD != null ? formatCurrency(r.fixedHourlySZD) + "/óra" : "—"}
                    </td>
                    {canWrite && (
                      <td className="py-1.5 text-right">
                        <button onClick={() => deleteVariationRule(r.variationId)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canWrite && (
            <div className="flex flex-wrap gap-2 items-end">
              <select value={varForm.variationId} onChange={(e) => setVarForm((f) => ({ ...f, variationId: e.target.value }))} className={inputClass}>
                <option value="">Variáció kiválasztása...</option>
                {allVariations.map((v) => <option key={v.id} value={v.id}>{v.positionName} / {v.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Delta</label>
                <input type="number" step="0.01" placeholder="pl. -0.10" value={varForm.multiplierDelta}
                  onChange={(e) => setVarForm((f) => ({ ...f, multiplierDelta: e.target.value }))}
                  className={`${inputClass} w-24`} />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fix óradíj (opcionális)</label>
                <input type="number" step="1" placeholder="Ft/óra" value={varForm.fixedHourlySZD}
                  onChange={(e) => setVarForm((f) => ({ ...f, fixedHourlySZD: e.target.value }))}
                  className={`${inputClass} w-28`} />
              </div>
              <button onClick={saveVariationRule} disabled={varSaving || !varForm.variationId || !varForm.multiplierDelta} className={btnClass}>
                {varSaving ? "..." : "Mentés"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Position+Location rates ── */}
      {locations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Pozíció × Lokáció fix óradíj</h3>
          {rates.positionLocationRates.length > 0 && (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left pb-1 pr-4">Pozíció</th>
                  <th className="text-left pb-1 pr-4">Lokáció</th>
                  <th className="text-right pb-1 pr-4">Fix óradíj</th>
                  {canWrite && <th className="pb-1" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rates.positionLocationRates.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-4">{r.position.name}</td>
                    <td className="py-1.5 pr-4">{r.location.name}</td>
                    <td className="py-1.5 pr-4 text-right font-mono">{formatCurrency(r.fixedHourlySZD)}/óra</td>
                    {canWrite && (
                      <td className="py-1.5 text-right">
                        <button onClick={() => deletePosLocRate(r.positionId, r.locationId)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canWrite && (
            <div className="flex flex-wrap gap-2 items-end">
              <select value={posLocForm.positionId} onChange={(e) => setPosLocForm((f) => ({ ...f, positionId: e.target.value }))} className={inputClass}>
                <option value="">Pozíció...</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={posLocForm.locationId} onChange={(e) => setPosLocForm((f) => ({ ...f, locationId: e.target.value }))} className={inputClass}>
                <option value="">Lokáció...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fix óradíj</label>
                <input type="number" step="1" placeholder="Ft/óra" value={posLocForm.fixedHourlySZD}
                  onChange={(e) => setPosLocForm((f) => ({ ...f, fixedHourlySZD: e.target.value }))}
                  className={`${inputClass} w-28`} />
              </div>
              <button onClick={savePosLocRate} disabled={posLocSaving || !posLocForm.positionId || !posLocForm.locationId || !posLocForm.fixedHourlySZD} className={btnClass}>
                {posLocSaving ? "..." : "Mentés"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Variation+Location rates ── */}
      {locations.length > 0 && allVariations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Variáció × Lokáció fix óradíj</h3>
          {rates.variationLocationRates.length > 0 && (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left pb-1 pr-4">Variáció</th>
                  <th className="text-left pb-1 pr-4">Lokáció</th>
                  <th className="text-right pb-1 pr-4">Fix óradíj</th>
                  {canWrite && <th className="pb-1" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rates.variationLocationRates.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 pr-4">
                      <span className="text-gray-400">{r.variation.position.name} /</span> {r.variation.name}
                    </td>
                    <td className="py-1.5 pr-4">{r.location.name}</td>
                    <td className="py-1.5 pr-4 text-right font-mono">{formatCurrency(r.fixedHourlySZD)}/óra</td>
                    {canWrite && (
                      <td className="py-1.5 text-right">
                        <button onClick={() => deleteVarLocRate(r.variationId, r.locationId)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canWrite && (
            <div className="flex flex-wrap gap-2 items-end">
              <select value={varLocForm.variationId} onChange={(e) => setVarLocForm((f) => ({ ...f, variationId: e.target.value }))} className={inputClass}>
                <option value="">Variáció...</option>
                {allVariations.map((v) => <option key={v.id} value={v.id}>{v.positionName} / {v.name}</option>)}
              </select>
              <select value={varLocForm.locationId} onChange={(e) => setVarLocForm((f) => ({ ...f, locationId: e.target.value }))} className={inputClass}>
                <option value="">Lokáció...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Fix óradíj</label>
                <input type="number" step="1" placeholder="Ft/óra" value={varLocForm.fixedHourlySZD}
                  onChange={(e) => setVarLocForm((f) => ({ ...f, fixedHourlySZD: e.target.value }))}
                  className={`${inputClass} w-28`} />
              </div>
              <button onClick={saveVarLocRate} disabled={varLocSaving || !varLocForm.variationId || !varLocForm.locationId || !varLocForm.fixedHourlySZD} className={btnClass}>
                {varLocSaving ? "..." : "Mentés"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Extra task rates ── */}
      {extraTaskTypes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Extra feladat díjak</h3>
          {rates.extraTaskRates.length > 0 && (
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="text-left pb-1 pr-4">Típus</th>
                  <th className="text-right pb-1 pr-4">Összeg / Szorzó</th>
                  {canWrite && <th className="pb-1" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rates.extraTaskRates.map((r) => {
                  const isM = isMultiplierBonusType(r.extraTaskType.bonusType);
                  return (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-4">{r.extraTaskType.name}</td>
                      <td className="py-1.5 pr-4 text-right font-mono">
                        {isM
                          ? `${r.rateMultiplier}×`
                          : `${formatCurrency(r.bonusAmount)}${r.extraTaskType.bonusType === "HOURLY_RATE" ? "/óra" : "/hó"}`}
                      </td>
                      {canWrite && (
                        <td className="py-1.5 text-right">
                          <button onClick={() => deleteEtRate(r.extraTaskTypeId)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {canWrite && (
            <div className="flex flex-wrap gap-2 items-end">
              <select value={etForm.extraTaskTypeId}
                onChange={(e) => {
                  const et = extraTaskTypes.find((t) => t.id === e.target.value);
                  setEtForm((f) => ({
                    ...f,
                    extraTaskTypeId: e.target.value,
                    bonusAmount: et && !isMultiplierBonusType(et.bonusType) ? String(et.bonusAmount) : "",
                    rateMultiplier: et && isMultiplierBonusType(et.bonusType) ? String(et.rateMultiplier ?? 1) : "",
                  }));
                }}
                className={inputClass}
              >
                <option value="">Extra feladat típus...</option>
                {extraTaskTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              {etIsMultiplier ? (
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">Szorzó (×)</label>
                  <input type="number" step="0.1" min="0" value={etForm.rateMultiplier}
                    onChange={(e) => setEtForm((f) => ({ ...f, rateMultiplier: e.target.value }))}
                    className={`${inputClass} w-24`} />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <label className="text-xs text-gray-500">
                    {selectedEt?.bonusType === "HOURLY_RATE" ? "Összeg (Ft/óra)" : "Összeg (Ft/hó)"}
                  </label>
                  <input type="number" step="1" min="0" value={etForm.bonusAmount}
                    onChange={(e) => setEtForm((f) => ({ ...f, bonusAmount: e.target.value }))}
                    className={`${inputClass} w-28`} />
                </div>
              )}
              <button
                onClick={saveEtRate}
                disabled={etSaving || !etForm.extraTaskTypeId || (etIsMultiplier ? !etForm.rateMultiplier : !etForm.bonusAmount)}
                className={btnClass}
              >
                {etSaving ? "..." : "Mentés"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
