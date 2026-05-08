import { Warning } from "@/types";
import { AlertTriangle, Info, XCircle } from "lucide-react";

interface WarningsPanelProps {
  warnings: Warning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning, idx) => {
        const Icon =
          warning.severity === "error"
            ? XCircle
            : warning.severity === "warning"
            ? AlertTriangle
            : Info;

        const colors =
          warning.severity === "error"
            ? "bg-red-50 border-red-200 text-red-800"
            : warning.severity === "warning"
            ? "bg-yellow-50 border-yellow-200 text-yellow-800"
            : "bg-blue-50 border-blue-200 text-blue-800";

        return (
          <div
            key={idx}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors}`}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="text-sm">{warning.message}</span>
          </div>
        );
      })}
    </div>
  );
}
