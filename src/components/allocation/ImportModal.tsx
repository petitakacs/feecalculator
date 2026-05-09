"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { showToast } from "@/components/ui/toaster";

export function ImportModal({ periodId }: { periodId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matchedCount: number;
    errorCount: number;
    errors: { row: number; message: string }[];
    unmatchedNames: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      showToast("Please select a file", "error");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/periods/${periodId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Import failed", "error");
        return;
      }
      setResult(data);
      showToast(
        `Imported ${data.matchedCount} of ${data.totalRows} rows`,
        data.errorCount > 0 ? "info" : "success"
      );
      if (data.matchedCount > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      showToast("Import failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
      >
        <Upload size={14} />
        Import
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-lg font-semibold">Import Employee Data</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload an Excel or CSV file with columns: Employee Name, Hours, OT
              Hours, Waiter Sales, Bonus, OT Payment, Correction, Notes
            </p>

            <div className="mt-4">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            {result && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
                <div className="font-medium">
                  Matched: {result.matchedCount} rows
                  {result.errorCount > 0 && (
                    <span className="text-red-600 ml-2">
                      ({result.errorCount} errors)
                    </span>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="text-red-600 text-xs">
                        Row {err.row}: {err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false);
                  setResult(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
