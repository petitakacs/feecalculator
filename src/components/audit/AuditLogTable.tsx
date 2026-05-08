"use client";

import { useState } from "react";
import { AuditLog } from "@/types";
import { formatDate } from "@/lib/format";

interface AuditLogTableProps {
  logs: AuditLog[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filtered = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entityType.toLowerCase().includes(search.toLowerCase()) ||
      log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search by action, entity, or user..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
      />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Entity Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Entity ID</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium">
                  {log.user?.name ?? log.userId}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      log.action === "CREATE"
                        ? "bg-green-100 text-green-800"
                        : log.action === "UPDATE" || log.action === "UPDATE_ENTRY"
                        ? "bg-blue-100 text-blue-800"
                        : log.action === "DELETE"
                        ? "bg-red-100 text-red-800"
                        : log.action === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : log.action === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{log.entityType}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[120px]">
                  {log.entityId}
                </td>
                <td className="px-4 py-3 text-right">
                  {(log.before || log.after) && (
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Details
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No audit logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Audit Detail</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Action: </span>
                {selectedLog.action}
              </div>
              <div>
                <span className="font-medium">Entity: </span>
                {selectedLog.entityType} ({selectedLog.entityId})
              </div>
              <div>
                <span className="font-medium">Date: </span>
                {formatDate(selectedLog.createdAt)}
              </div>
              {selectedLog.before && (
                <div>
                  <div className="font-medium mb-1">Before:</div>
                  <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.after && (
                <div>
                  <div className="font-medium mb-1">After:</div>
                  <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
