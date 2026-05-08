"use client";

import { useState } from "react";
import { MonthlyPeriod } from "@/types";
import { formatCurrency, formatPeriod } from "@/lib/format";

interface ReportsViewProps {
  periods: MonthlyPeriod[];
}

type ReportTab =
  | "summary"
  | "balance_trend"
  | "collection"
  | "distribution"
  | "override"
  | "export";

export function ReportsView({ periods }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    periods[0]?.id ?? ""
  );

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "summary", label: "Period Summary" },
    { id: "balance_trend", label: "Balance Trend" },
    { id: "collection", label: "Collection Report" },
    { id: "distribution", label: "Distribution Report" },
    { id: "override", label: "Override Report" },
    { id: "export", label: "Export" },
  ];

  const totalCollected = periods.reduce((s, p) => s + p.collectedServiceCharge, 0);
  const totalDistributed = periods.reduce((s, p) => s + p.approvedDistributionTotal, 0);

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Total Collected</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(totalCollected)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Total Distributed</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(totalDistributed)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Periods Count</div>
                  <div className="text-xl font-bold text-gray-900">{periods.length}</div>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Period</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Opening</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Collected</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Distributable</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Approved</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Closing</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {periods.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{formatPeriod(p.month, p.year)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.openingBalance)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.collectedServiceCharge)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.distributableBalance)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.approvedDistributionTotal)}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          p.closingBalance < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(p.closingBalance)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === "CLOSED"
                              ? "bg-blue-100 text-blue-800"
                              : p.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : p.status === "PENDING_APPROVAL"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "balance_trend" && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Balance Trend (Closing Balance per Period)
              </h3>
              <div className="space-y-2">
                {[...periods].reverse().map((p) => {
                  const maxVal = Math.max(...periods.map((x) => Math.abs(x.closingBalance)));
                  const pct = maxVal > 0 ? (Math.abs(p.closingBalance) / maxVal) * 100 : 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-gray-500 text-right">
                        {formatPeriod(p.month, p.year)}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            p.closingBalance < 0 ? "bg-red-400" : "bg-green-400"
                          }`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <div
                        className={`w-24 text-xs font-medium ${
                          p.closingBalance < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(p.closingBalance)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "collection" && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Collection Report</h3>
              <div className="space-y-2">
                {periods.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{formatPeriod(p.month, p.year)}</span>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">Collected: </span>
                        <span className="font-medium">{formatCurrency(p.collectedServiceCharge)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Target: </span>
                        <span className="font-medium">{formatCurrency(p.targetDistributionTotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "distribution" && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Distribution Report</h3>
              <div className="space-y-2">
                {periods.map((p) => {
                  const diff = p.approvedDistributionTotal - p.targetDistributionTotal;
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{formatPeriod(p.month, p.year)}</span>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-500">Target: </span>
                          <span className="font-medium">{formatCurrency(p.targetDistributionTotal)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Approved: </span>
                          <span className="font-medium">{formatCurrency(p.approvedDistributionTotal)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Diff: </span>
                          <span className={`font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : ""}`}>
                            {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "override" && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4">Override Report</h3>
              <div className="mb-4">
                <label className="text-sm text-gray-500 mr-2">Select Period:</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPeriod(p.month, p.year)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-500">
                View override details in the Allocation Table for the selected period.
              </p>
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Export Period Data</h3>
              <p className="text-sm text-gray-500">
                Select a period to export as Excel file.
              </p>
              <div className="space-y-2">
                {periods.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{formatPeriod(p.month, p.year)}</span>
                    <a
                      href={`/api/periods/${p.id}/export`}
                      download
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700"
                    >
                      Download Excel
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
