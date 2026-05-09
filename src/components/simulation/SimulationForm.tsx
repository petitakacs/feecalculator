"use client";

import { useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";

interface SimulationState {
  openingBalance: number;
  collectedServiceCharge: number;
  waiterNetSales: number;
  waiterWorkedHours: number;
  mode: "SALES_BASED" | "MANUAL_TARGET" | "SALES_BASED_WITH_LIMITS";
  manualWaiterTargetHourly: number;
  minHourlyCents: number;
  maxHourlyCents: number;
  serviceChargePercent: number;
  employeeContribution: number;
}

interface SimulationResult {
  waiterReferenceHourlyRate: number;
  waiterGrossServiceCharge: number;
  waiterNetServiceCharge: number;
  distributableBalance: number;
  simulatedDistribution: number;
  closingBalance: number;
}

export function SimulationForm() {
  const [form, setForm] = useState<SimulationState>({
    openingBalance: 0,
    collectedServiceCharge: 500000,
    waiterNetSales: 10000000,
    waiterWorkedHours: 160,
    mode: "SALES_BASED",
    manualWaiterTargetHourly: 200,
    minHourlyCents: 150,
    maxHourlyCents: 300,
    serviceChargePercent: 0.039,
    employeeContribution: 0.185,
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof SimulationState, value: number | string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Simulation failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        <h2 className="text-base font-semibold">Parameters</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Opening Balance (Ft)</label>
            <input
              type="number"
              value={form.openingBalance}
              onChange={(e) => set("openingBalance", Math.round(parseFloat(e.target.value || "0")))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Collected Service Charge (Ft)</label>
            <input
              type="number"
              value={form.collectedServiceCharge}
              onChange={(e) => set("collectedServiceCharge", Math.round(parseFloat(e.target.value || "0")))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Waiter Net Sales (Ft)</label>
            <input
              type="number"
              value={form.waiterNetSales}
              onChange={(e) => set("waiterNetSales", Math.round(parseFloat(e.target.value || "0")))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Waiter Worked Hours</label>
            <input
              type="number"
              value={form.waiterWorkedHours}
              onChange={(e) => set("waiterWorkedHours", parseFloat(e.target.value || "0"))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Calculation Mode</label>
          <select
            value={form.mode}
            onChange={(e) => set("mode", e.target.value)}
            className={inputClass}
          >
            <option value="SALES_BASED">A: Sales Based (auto-calculate)</option>
            <option value="MANUAL_TARGET">B: Manual Seasonal Target</option>
            <option value="SALES_BASED_WITH_LIMITS">C: Sales Based with Min/Max</option>
          </select>
        </div>

        {form.mode === "MANUAL_TARGET" && (
          <div>
            <label className={labelClass}>Manual Waiter Target Hourly Rate (Ft/hr)</label>
            <input
              type="number"
              value={form.manualWaiterTargetHourly}
              onChange={(e) => set("manualWaiterTargetHourly", Math.round(parseFloat(e.target.value || "0")))}
              className={inputClass}
            />
          </div>
        )}

        {form.mode === "SALES_BASED_WITH_LIMITS" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Min Hourly Rate (Ft/hr)</label>
              <input
                type="number"
                value={form.minHourlyCents}
                onChange={(e) => set("minHourlyCents", Math.round(parseFloat(e.target.value || "0")))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Hourly Rate (Ft/hr)</label>
              <input
                type="number"
                value={form.maxHourlyCents}
                onChange={(e) => set("maxHourlyCents", Math.round(parseFloat(e.target.value || "0")))}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Service Charge % (current: {formatPercent(form.serviceChargePercent)})
            </label>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.001"
              value={form.serviceChargePercent}
              onChange={(e) => set("serviceChargePercent", parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">{formatPercent(form.serviceChargePercent)}</div>
          </div>
          <div>
            <label className={labelClass}>
              Employee Contribution % (current: {formatPercent(form.employeeContribution)})
            </label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={form.employeeContribution}
              onChange={(e) => set("employeeContribution", parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">{formatPercent(form.employeeContribution)}</div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Simulating..." : "Run Simulation"}
        </button>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-base font-semibold mb-4">Results</h2>

        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ResultCard
                label="Waiter Reference Hourly Rate"
                value={formatCurrency(result.waiterReferenceHourlyRate)}
                sub="/hour"
              />
              <ResultCard
                label="Waiter Gross SC"
                value={formatCurrency(result.waiterGrossServiceCharge)}
              />
              <ResultCard
                label="Waiter Net SC"
                value={formatCurrency(result.waiterNetServiceCharge)}
              />
              <ResultCard
                label="Distributable Balance"
                value={formatCurrency(result.distributableBalance)}
                highlight={result.distributableBalance > 0 ? "positive" : "neutral"}
              />
              <ResultCard
                label="Simulated Distribution"
                value={formatCurrency(result.simulatedDistribution)}
              />
              <ResultCard
                label="Projected Closing Balance"
                value={formatCurrency(result.closingBalance)}
                highlight={result.closingBalance < 0 ? "negative" : "positive"}
              />
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-md text-xs text-gray-600">
              Note: Distribution simulated using waiter net SC only. Actual distribution includes all
              employee positions.
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div>Run a simulation to see results</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    highlight === "positive"
      ? "text-green-600"
      : highlight === "negative"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueColor}`}>
        {value}
        {sub && <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>}
      </div>
    </div>
  );
}
