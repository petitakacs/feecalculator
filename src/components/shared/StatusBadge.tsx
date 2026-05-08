import { PeriodStatus } from "@/types";

const statusConfig: Record<
  PeriodStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    className: "bg-yellow-100 text-yellow-800",
  },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-800" },
  CLOSED: { label: "Closed", className: "bg-blue-100 text-blue-800" },
};

export function StatusBadge({ status }: { status: PeriodStatus }) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
