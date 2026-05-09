import { formatCurrency } from "@/lib/format";

interface BalanceSummaryCardProps {
  title: string;
  amount: number;
  description?: string;
  highlight?: "positive" | "negative" | "neutral";
}

export function BalanceSummaryCard({
  title,
  amount,
  description,
  highlight,
}: BalanceSummaryCardProps) {
  const amountColor =
    highlight === "negative"
      ? "text-red-600"
      : highlight === "positive"
      ? "text-green-600"
      : amount < 0
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${amountColor}`}>
        {formatCurrency(amount)}
      </div>
      {description && (
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      )}
    </div>
  );
}
