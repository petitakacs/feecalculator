"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AnalyticsRecord } from "@/types/analytics";
import { formatCurrency, formatHours } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeStats {
  employeeId: string;
  employeeName: string;
  positionName: string;
  monthCount: number;
  avgSZD: number;
  avgTotal: number;
  avgHours: number;
  minSZD: number;
  maxSZD: number;
  avgBonus: number;
  avgExtra: number;
  trend: "up" | "down" | "stable";
  trendTooltip: string;
  lastYear: number;
  lastMonth: number;
  yearlyAvgs: { year: number; avgSZD: number; months: number }[];
  yoyChange: { amount: number; pct: number } | null;
  seasonAvgs: { seasonId: string; seasonName: string; avgSZD: number; months: number }[];
}

interface AnomalyInfo {
  anomalyHigh: boolean;
  anomalyLow: boolean;
}

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------

function Sparkline({
  values,
  anomalyFlags,
  width = 120,
  height = 32,
}: {
  values: number[];
  anomalyFlags?: boolean[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const barW = width / values.length;
  return (
    <svg width={width} height={height} className="inline-block">
      {values.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * (height - 4));
        const isAnomaly = anomalyFlags?.[i];
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={height - h - 2}
            width={barW - 2}
            height={h}
            rx={1}
            fill={isAnomaly ? "#ef4444" : "#6366f1"}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Employee Multi-Select Dropdown
// ---------------------------------------------------------------------------

function EmployeeMultiSelect({
  employees,
  selected,
  onChange,
}: {
  employees: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = selected.length === employees.length;

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(employees.map((e) => e.id));
    }
  }

  function toggleEmployee(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const label =
    selected.length === 0
      ? "0 dolgozó kiválasztva"
      : allSelected
      ? "Összes dolgozó"
      : `${selected.length} dolgozó kiválasztva`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 border border-gray-300 rounded-md bg-white text-sm text-gray-700 flex items-center gap-2 min-w-[180px] hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg w-64 max-h-72 flex flex-col">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Keresés..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Összes
              </span>
            </label>
            {filtered.map((emp) => (
              <label
                key={emp.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(emp.id)}
                  onChange={() => toggleEmployee(emp.id)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 truncate">
                  {emp.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc";

function sortedBy<T>(
  arr: T[],
  field: keyof T,
  dir: SortDir
): T[] {
  return [...arr].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), "hu");
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Anomaly detection (per-employee stddev across ALL records)
// ---------------------------------------------------------------------------

function computeAnomalyMap(
  allRecords: AnalyticsRecord[]
): Map<string, AnomalyInfo> {
  // Group effectiveSZD by employeeId
  const byEmployee = new Map<string, number[]>();
  for (const r of allRecords) {
    const arr = byEmployee.get(r.employeeId) ?? [];
    arr.push(r.effectiveSZD);
    byEmployee.set(r.employeeId, arr);
  }

  // Compute mean + stddev per employee
  const stats = new Map<string, { mean: number; std: number; count: number }>();
  byEmployee.forEach((values, empId) => {
    const count = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / count;
    const variance =
      count > 1
        ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (count - 1)
        : 0;
    const std = Math.sqrt(variance);
    stats.set(empId, { mean, std, count });
  });

  // Map each record to its anomaly flags using a compound key periodId:employeeId
  const result = new Map<string, AnomalyInfo>();
  for (const r of allRecords) {
    const key = `${r.periodId}:${r.employeeId}`;
    const s = stats.get(r.employeeId);
    if (!s || s.count < 4) {
      result.set(key, { anomalyHigh: false, anomalyLow: false });
      continue;
    }
    const { mean, std } = s;
    const anomalyHigh = r.effectiveSZD > mean + 2 * std;
    const anomalyLow =
      r.effectiveSZD < mean - 2 * std && r.effectiveSZD < mean * 0.5;
    result.set(key, { anomalyHigh, anomalyLow });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Trend computation
// ---------------------------------------------------------------------------

function computeTrend(
  records: AnalyticsRecord[]
): { trend: "up" | "down" | "stable"; tooltip: string } {
  // Sort by year, month ascending
  const sorted = [...records].sort(
    (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)
  );
  if (sorted.length < 4) {
    return { trend: "stable", tooltip: "Nincs elég adat a trendhez" };
  }

  // Last 3 vs 3 before that
  const last3 = sorted.slice(-3);
  const prev3 = sorted.slice(-6, -3);
  if (prev3.length < 3) {
    return { trend: "stable", tooltip: "Nincs elég adat a trendhez" };
  }

  const avgLast = last3.reduce((s, r) => s + r.effectiveSZD, 0) / 3;
  const avgPrev = prev3.reduce((s, r) => s + r.effectiveSZD, 0) / 3;

  if (avgPrev === 0) {
    return { trend: "stable", tooltip: "Nincs összehasonlítási alap" };
  }

  const change = (avgLast - avgPrev) / avgPrev;
  const pct = (change * 100).toFixed(1);

  if (change > 0.1) {
    return {
      trend: "up",
      tooltip: `Utolsó 3 hó átl.: ${formatCurrency(Math.round(avgLast))} vs előző 3 hó: ${formatCurrency(Math.round(avgPrev))} (+${pct}%)`,
    };
  } else if (change < -0.1) {
    return {
      trend: "down",
      tooltip: `Utolsó 3 hó átl.: ${formatCurrency(Math.round(avgLast))} vs előző 3 hó: ${formatCurrency(Math.round(avgPrev))} (${pct}%)`,
    };
  } else {
    return {
      trend: "stable",
      tooltip: `Utolsó 3 hó átl.: ${formatCurrency(Math.round(avgLast))} vs előző 3 hó: ${formatCurrency(Math.round(avgPrev))} (${pct}%)`,
    };
  }
}

// ---------------------------------------------------------------------------
// Flag badge
// ---------------------------------------------------------------------------

function FlagBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort header button
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: string;
  sortField: string;
  sortDir: SortDir;
  onSort: (field: string) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}{" "}
      {active ? (
        <span className="text-indigo-600">{sortDir === "asc" ? "▲" : "▼"}</span>
      ) : (
        <span className="text-gray-300">▲</span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsView({ records }: { records: AnalyticsRecord[] }) {
  // --- Derive filter options from records ---
  const allEmployees = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      map.set(r.employeeId, r.employeeName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "hu"));
  }, [records]);

  const allYears = useMemo(() => {
    const years = new Set<number>();
    for (const r of records) years.add(r.year);
    return Array.from(years).sort();
  }, [records]);

  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    for (const r of records) {
      if (r.locationName) locs.add(r.locationName);
    }
    return Array.from(locs).sort();
  }, [records]);

  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const r of records) s.add(r.periodStatus);
    return Array.from(s).sort();
  }, [records]);

  const allSeasons = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) map.set(r.seasonId, r.seasonName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "hu"));
  }, [records]);

  const minYear = allYears[0] ?? new Date().getFullYear();
  const maxYear = allYears[allYears.length - 1] ?? new Date().getFullYear();

  // --- State ---
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    () => allEmployees.map((e) => e.id)
  );
  const [yearFrom, setYearFrom] = useState<number>(minYear);
  const [yearTo, setYearTo] = useState<number>(maxYear);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"overview" | "detail">("overview");
  const [selectedDetailEmployee, setSelectedDetailEmployee] = useState<
    string | null
  >(null);
  const [periodGrouping, setPeriodGrouping] = useState<"year" | "season">("year");

  // Overview sort
  const [overviewSortField, setOverviewSortField] =
    useState<string>("employeeName");
  const [overviewSortDir, setOverviewSortDir] = useState<SortDir>("asc");

  // Detail sort
  const [detailSortField, setDetailSortField] = useState<string>("year");
  const [detailSortDir, setDetailSortDir] = useState<SortDir>("desc");

  // --- Anomaly map (over ALL records) ---
  const anomalyMap = useMemo(() => computeAnomalyMap(records), [records]);

  // --- Filter records ---
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (r.year < yearFrom || r.year > yearTo) return false;
      if (locationFilter !== "all" && r.locationName !== locationFilter)
        return false;
      if (statusFilter !== "all" && r.periodStatus !== statusFilter)
        return false;
      if (seasonFilter !== "all" && r.seasonId !== seasonFilter)
        return false;
      if (
        selectedEmployeeIds.length > 0 &&
        !selectedEmployeeIds.includes(r.employeeId)
      )
        return false;
      return true;
    });
  }, [records, yearFrom, yearTo, locationFilter, statusFilter, seasonFilter, selectedEmployeeIds]);

  // --- Per-employee stats ---
  const employeeStats = useMemo((): EmployeeStats[] => {
    const byEmp = new Map<string, AnalyticsRecord[]>();
    for (const r of filteredRecords) {
      const arr = byEmp.get(r.employeeId) ?? [];
      arr.push(r);
      byEmp.set(r.employeeId, arr);
    }

    const result: EmployeeStats[] = [];
    byEmp.forEach((empRecords, employeeId) => {
      const sorted = [...empRecords].sort(
        (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)
      );
      const n = sorted.length;
      const avgSZD = sorted.reduce((s, r) => s + r.effectiveSZD, 0) / n;
      const avgTotal = sorted.reduce((s, r) => s + r.totalPayout, 0) / n;
      const avgHours = sorted.reduce((s, r) => s + r.workedHours, 0) / n;
      const minSZD = Math.min(...sorted.map((r) => r.effectiveSZD));
      const maxSZD = Math.max(...sorted.map((r) => r.effectiveSZD));
      const avgBonus = sorted.reduce((s, r) => s + r.bonus, 0) / n;
      const avgExtra = sorted.reduce((s, r) => s + r.extraTasksTotal, 0) / n;
      const last = sorted[n - 1];
      const { trend, tooltip } = computeTrend(sorted);

      // Yearly averages
      const byYear = new Map<number, number[]>();
      for (const r of sorted) {
        const arr = byYear.get(r.year) ?? [];
        arr.push(r.effectiveSZD);
        byYear.set(r.year, arr);
      }
      const yearlyAvgs = Array.from(byYear.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, vals]) => ({
          year,
          avgSZD: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
          months: vals.length,
        }));

      // Year-over-year change: last year vs the one before it
      let yoyChange: { amount: number; pct: number } | null = null;
      if (yearlyAvgs.length >= 2) {
        const prev = yearlyAvgs[yearlyAvgs.length - 2];
        const curr = yearlyAvgs[yearlyAvgs.length - 1];
        if (prev.avgSZD > 0) {
          const amount = curr.avgSZD - prev.avgSZD;
          const pct = (amount / prev.avgSZD) * 100;
          yoyChange = { amount, pct };
        }
      }

      // Season averages (sorted by first occurrence in sorted records)
      const seasonOrder: string[] = [];
      const bySeason = new Map<string, { name: string; vals: number[] }>();
      for (const r of sorted) {
        if (!bySeason.has(r.seasonId)) {
          bySeason.set(r.seasonId, { name: r.seasonName, vals: [] });
          seasonOrder.push(r.seasonId);
        }
        bySeason.get(r.seasonId)!.vals.push(r.effectiveSZD);
      }
      const seasonAvgs = seasonOrder.map((sid) => {
        const { name, vals } = bySeason.get(sid)!;
        return {
          seasonId: sid,
          seasonName: name,
          avgSZD: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
          months: vals.length,
        };
      });

      result.push({
        employeeId,
        employeeName: empRecords[0].employeeName,
        positionName: empRecords[0].positionName,
        monthCount: n,
        avgSZD: Math.round(avgSZD),
        avgTotal: Math.round(avgTotal),
        avgHours,
        minSZD,
        maxSZD,
        avgBonus: Math.round(avgBonus),
        avgExtra: Math.round(avgExtra),
        trend,
        trendTooltip: tooltip,
        lastYear: last.year,
        lastMonth: last.month,
        yearlyAvgs,
        yoyChange,
        seasonAvgs,
      });
    });
    return result;
  }, [filteredRecords]);

  // --- Summary stats ---
  const summaryStats = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { nEmployees: 0, nRecords: 0, dateRange: "-", avgSZD: 0 };
    }
    const nEmployees = new Set(filteredRecords.map((r) => r.employeeId)).size;
    const nRecords = filteredRecords.length;
    const sorted = [...filteredRecords].sort(
      (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const dateRange = `${first.year}/${String(first.month).padStart(2, "0")} – ${last.year}/${String(last.month).padStart(2, "0")}`;
    const avgSZD = Math.round(
      filteredRecords.reduce((s, r) => s + r.effectiveSZD, 0) /
        filteredRecords.length
    );
    return { nEmployees, nRecords, dateRange, avgSZD };
  }, [filteredRecords]);

  // --- Detail records ---
  const detailEmployeeId =
    viewMode === "detail" ? selectedDetailEmployee : null;
  const detailRecords = useMemo(() => {
    if (!detailEmployeeId) return filteredRecords;
    return filteredRecords.filter((r) => r.employeeId === detailEmployeeId);
  }, [filteredRecords, detailEmployeeId]);

  const detailEmployeeName = useMemo(() => {
    if (!detailEmployeeId) return null;
    return (
      allEmployees.find((e) => e.id === detailEmployeeId)?.name ?? null
    );
  }, [detailEmployeeId, allEmployees]);

  // --- Sparkline data for detail employee ---
  const sparklineData = useMemo(() => {
    if (!detailEmployeeId) return { values: [], anomalyFlags: [] };
    // All records for this employee (not just filtered), last 12 sorted
    const empRecords = records
      .filter((r) => r.employeeId === detailEmployeeId)
      .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
      .slice(-12);
    const values = empRecords.map((r) => r.effectiveSZD);
    const anomalyFlags = empRecords.map((r) => {
      const key = `${r.periodId}:${r.employeeId}`;
      return anomalyMap.get(key)?.anomalyHigh ?? false;
    });
    return { values, anomalyFlags };
  }, [detailEmployeeId, records, anomalyMap]);

  // --- Sorted overview ---
  const sortedOverview = useMemo(() => {
    return sortedBy(
      employeeStats,
      overviewSortField as keyof EmployeeStats,
      overviewSortDir
    );
  }, [employeeStats, overviewSortField, overviewSortDir]);

  // --- Sorted detail ---
  const sortedDetail = useMemo(() => {
    return sortedBy(
      detailRecords,
      detailSortField as keyof AnalyticsRecord,
      detailSortDir
    );
  }, [detailRecords, detailSortField, detailSortDir]);

  // --- Sort handlers ---
  function handleOverviewSort(field: string) {
    if (overviewSortField === field) {
      setOverviewSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOverviewSortField(field);
      setOverviewSortDir("asc");
    }
  }

  function handleDetailSort(field: string) {
    if (detailSortField === field) {
      setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDetailSortField(field);
      setDetailSortDir("asc");
    }
  }

  // --- Navigate to employee detail ---
  function openEmployeeDetail(employeeId: string) {
    setSelectedDetailEmployee(employeeId);
    setViewMode("detail");
  }

  function backToOverview() {
    setSelectedDetailEmployee(null);
    setViewMode("overview");
  }

  // --- Trend display ---
  function TrendIcon({ trend, tooltip }: { trend: "up" | "down" | "stable"; tooltip: string }) {
    if (trend === "up") {
      return (
        <span title={tooltip} className="text-green-600 text-base cursor-help">
          ▲
        </span>
      );
    } else if (trend === "down") {
      return (
        <span title={tooltip} className="text-red-600 text-base cursor-help">
          ▼
        </span>
      );
    } else {
      return (
        <span title={tooltip} className="text-gray-400 text-base cursor-help">
          —
        </span>
      );
    }
  }

  // --- Month label ---
  function monthLabel(month: number, year: number) {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("hu-HU", { year: "numeric", month: "short" });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ---- Filters bar ---- */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Year from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Év (tól)
            </label>
            <select
              value={yearFrom}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYearFrom(v);
                if (v > yearTo) setYearTo(v);
              }}
              className="h-9 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Year to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Év (ig)
            </label>
            <select
              value={yearTo}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYearTo(v);
                if (v < yearFrom) setYearFrom(v);
              }}
              className="h-9 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Helyszín
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Összes helyszín</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Státusz
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Összes státusz</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Season */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Szezon
            </label>
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="h-9 px-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Összes szezon</option>
              {allSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee multi-select */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Dolgozók
            </label>
            <EmployeeMultiSelect
              employees={allEmployees}
              selected={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
            />
          </div>

          {/* View toggle */}
          <div className="flex flex-col gap-1 ml-auto">
            <label className="text-xs font-medium text-gray-500">Nézet</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setViewMode("overview");
                  setSelectedDetailEmployee(null);
                }}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  viewMode === "overview"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Összesítő
              </button>
              <button
                type="button"
                onClick={() => setViewMode("detail")}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  viewMode === "detail"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Részletes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Summary stats row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500">Dolgozók</p>
          <p className="text-2xl font-bold text-gray-900">
            {summaryStats.nEmployees}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500">Bejegyzések</p>
          <p className="text-2xl font-bold text-gray-900">
            {summaryStats.nRecords}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500">Időszak</p>
          <p className="text-lg font-semibold text-gray-900 truncate">
            {summaryStats.dateRange}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow px-4 py-3">
          <p className="text-xs text-gray-500">Átl. SZD</p>
          <p className="text-xl font-bold text-indigo-600">
            {formatCurrency(summaryStats.avgSZD)}
          </p>
        </div>
      </div>

      {/* ---- Main table ---- */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Detail view header */}
        {viewMode === "detail" && (
          <div className="px-6 py-4 border-b flex items-center gap-4 flex-wrap">
            {detailEmployeeId ? (
              <>
                <button
                  type="button"
                  onClick={backToOverview}
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  ← Összes dolgozó
                </button>
                <span className="text-gray-300">|</span>
                <span className="font-medium text-gray-900">
                  {detailEmployeeName}
                </span>
                {sparklineData.values.length >= 2 && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Utolsó 12 hó SZD trend:
                    </span>
                    <Sparkline
                      values={sparklineData.values}
                      anomalyFlags={sparklineData.anomalyFlags}
                      width={144}
                      height={36}
                    />
                  </div>
                )}
              </>
            ) : (
              <span className="font-medium text-gray-900">
                Részletes nézet — összes szűrt bejegyzés
              </span>
            )}
          </div>
        )}

        {/* ---- Period grouping panel (employee detail only) ---- */}
        {viewMode === "detail" && detailEmployeeId && (() => {
          const stat = employeeStats.find((s) => s.employeeId === detailEmployeeId);
          const items =
            periodGrouping === "year"
              ? stat?.yearlyAvgs.map((ya, idx, arr) => ({
                  key: String(ya.year),
                  label: String(ya.year),
                  avgSZD: ya.avgSZD,
                  months: ya.months,
                  prev: arr[idx - 1] ?? null,
                }))
              : stat?.seasonAvgs.map((sa, idx, arr) => ({
                  key: sa.seasonId,
                  label: sa.seasonName,
                  avgSZD: sa.avgSZD,
                  months: sa.months,
                  prev: arr[idx - 1] ?? null,
                }));
          if (!items || items.length === 0) return null;
          return (
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Átlagok és változások
                </p>
                <div className="flex rounded-md border border-gray-300 overflow-hidden ml-auto">
                  <button
                    type="button"
                    onClick={() => setPeriodGrouping("year")}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      periodGrouping === "year"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Évek
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodGrouping("season")}
                    className={`px-2.5 py-1 text-xs transition-colors ${
                      periodGrouping === "season"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Szezonok
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {items.map((item) => {
                  const change =
                    item.prev && item.prev.avgSZD > 0
                      ? {
                          amount: item.avgSZD - item.prev.avgSZD,
                          pct:
                            ((item.avgSZD - item.prev.avgSZD) /
                              item.prev.avgSZD) *
                            100,
                        }
                      : null;
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col items-center bg-white rounded-lg border border-gray-200 px-4 py-2.5 min-w-[120px] shadow-sm"
                    >
                      <span className="text-xs font-semibold text-gray-500 mb-1 text-center leading-tight">
                        {item.label}
                      </span>
                      <span className="text-base font-bold text-gray-900">
                        {formatCurrency(item.avgSZD)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {item.months} hó átl.
                      </span>
                      {change != null ? (
                        <span
                          className={`mt-1 text-xs font-medium ${
                            change.amount >= 0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {change.amount >= 0 ? "+" : ""}
                          {formatCurrency(change.amount)}{" "}
                          <span className="opacity-75">
                            ({change.pct >= 0 ? "+" : ""}
                            {change.pct.toFixed(1)}%)
                          </span>
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-gray-300">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="overflow-x-auto">
          {/* ---- OVERVIEW TABLE ---- */}
          {viewMode === "overview" && (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader
                    label="Dolgozó"
                    field="employeeName"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                  />
                  <SortHeader
                    label="Pozíció"
                    field="positionName"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                  />
                  <SortHeader
                    label="Hónapok"
                    field="monthCount"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Átl. SZD"
                    field="avgSZD"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                    className="text-right"
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Min/Max SZD
                  </th>
                  <SortHeader
                    label="Átl. prémium"
                    field="avgBonus"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Átl. extra"
                    field="avgExtra"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Átl. összesen"
                    field="avgTotal"
                    sortField={overviewSortField}
                    sortDir={overviewSortDir}
                    onSort={handleOverviewSort}
                    className="text-right"
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Éves emelés
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Utolsó periódus
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedOverview.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Nincs megjeleníthető adat a szűrőknek megfelelően.
                    </td>
                  </tr>
                )}
                {sortedOverview.map((stat) => (
                  <tr
                    key={stat.employeeId}
                    onClick={() => openEmployeeDetail(stat.employeeId)}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {stat.employeeName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {stat.positionName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {stat.monthCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(stat.avgSZD)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="text-blue-700">
                        {formatCurrency(stat.minSZD)}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-green-700">
                        {formatCurrency(stat.maxSZD)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {stat.avgBonus > 0
                        ? formatCurrency(stat.avgBonus)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {stat.avgExtra > 0
                        ? formatCurrency(stat.avgExtra)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(stat.avgTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <TrendIcon
                        trend={stat.trend}
                        tooltip={stat.trendTooltip}
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {stat.yoyChange != null ? (
                        <span
                          className={`text-sm font-medium ${stat.yoyChange.amount >= 0 ? "text-green-700" : "text-red-600"}`}
                          title={`${stat.yearlyAvgs[stat.yearlyAvgs.length - 2]?.year} → ${stat.yearlyAvgs[stat.yearlyAvgs.length - 1]?.year} éves átlag változás`}
                        >
                          {stat.yoyChange.amount >= 0 ? "+" : ""}
                          {formatCurrency(stat.yoyChange.amount)}
                          <span className="text-xs ml-1 opacity-75">
                            ({stat.yoyChange.pct >= 0 ? "+" : ""}
                            {stat.yoyChange.pct.toFixed(1)}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {stat.lastYear}/{String(stat.lastMonth).padStart(2, "0")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ---- DETAIL TABLE ---- */}
          {viewMode === "detail" && (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader
                    label="Év/Hó"
                    field="year"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                  />
                  {!detailEmployeeId && (
                    <SortHeader
                      label="Dolgozó"
                      field="employeeName"
                      sortField={detailSortField}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                  )}
                  <SortHeader
                    label="Helyszín"
                    field="locationName"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                  />
                  <SortHeader
                    label="Ledolg. óra"
                    field="workedHours"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="SZD cél"
                    field="targetSZD"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Jóváhagyott SZD"
                    field="effectiveSZD"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Prémium"
                    field="bonus"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Túlóra kif."
                    field="overtimePayment"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Korrekció"
                    field="manualCorrection"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Extra feladatok"
                    field="extraTasksTotal"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Összesen"
                    field="totalPayout"
                    sortField={detailSortField}
                    sortDir={detailSortDir}
                    onSort={handleDetailSort}
                    className="text-right"
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jelzők
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedDetail.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Nincs megjeleníthető adat.
                    </td>
                  </tr>
                )}
                {sortedDetail.map((record) => {
                  const anomalyKey = `${record.periodId}:${record.employeeId}`;
                  const anomaly = anomalyMap.get(anomalyKey) ?? {
                    anomalyHigh: false,
                    anomalyLow: false,
                  };
                  const rowBg = anomaly.anomalyHigh
                    ? "bg-red-50"
                    : anomaly.anomalyLow
                    ? "bg-blue-50"
                    : "";

                  const flags: React.ReactNode[] = [];
                  if (anomaly.anomalyHigh)
                    flags.push(
                      <FlagBadge
                        key="high"
                        label="Kiugró ↑"
                        color="bg-red-100 text-red-800"
                      />
                    );
                  if (anomaly.anomalyLow)
                    flags.push(
                      <FlagBadge
                        key="low"
                        label="Kiugró ↓"
                        color="bg-blue-100 text-blue-800"
                      />
                    );
                  if (record.bonus > 0)
                    flags.push(
                      <FlagBadge
                        key="bonus"
                        label="Prémium"
                        color="bg-yellow-100 text-yellow-800"
                      />
                    );
                  if (record.extraTasksTotal > 0)
                    flags.push(
                      <FlagBadge
                        key="extra"
                        label="Extra"
                        color="bg-green-100 text-green-800"
                      />
                    );
                  if (record.overrideFlag)
                    flags.push(
                      <FlagBadge
                        key="override"
                        label="Felülbírált"
                        color="bg-orange-100 text-orange-800"
                      />
                    );
                  if (record.periodStatus === "DRAFT")
                    flags.push(
                      <FlagBadge
                        key="draft"
                        label="Tervezet"
                        color="bg-gray-100 text-gray-500"
                      />
                    );

                  return (
                    <tr
                      key={`${record.periodId}:${record.employeeId}`}
                      className={`${rowBg} hover:brightness-95 transition-colors`}
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {monthLabel(record.month, record.year)}
                      </td>
                      {!detailEmployeeId && (
                        <td
                          className="px-4 py-3 font-medium text-indigo-700 cursor-pointer hover:underline whitespace-nowrap"
                          onClick={() =>
                            openEmployeeDetail(record.employeeId)
                          }
                        >
                          {record.employeeName}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {record.locationName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatHours(record.workedHours)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCurrency(record.targetSZD)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(record.effectiveSZD)}
                        {record.approvedSZD !== null &&
                          record.approvedSZD !== record.targetSZD && (
                            <span className="ml-1 text-xs text-orange-500">
                              *
                            </span>
                          )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {record.bonus > 0 ? formatCurrency(record.bonus) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {record.overtimePayment > 0
                          ? formatCurrency(record.overtimePayment)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {record.manualCorrection !== 0
                          ? formatCurrency(record.manualCorrection)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {record.extraTasksTotal > 0
                          ? formatCurrency(record.extraTasksTotal)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(record.totalPayout)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {flags.length > 0 ? flags : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
