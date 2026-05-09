"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeletePeriodButtonProps {
  periodId: string;
  periodLabel: string;
}

export function DeletePeriodButton({ periodId, periodLabel }: DeletePeriodButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/periods/${periodId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Törlés sikertelen");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba történt");
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        {error && <span className="text-red-600 text-xs">{error}</span>}
        <span className="text-sm text-gray-700">Biztosan törlöd?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "..." : "Igen"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={loading}
          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Mégsem
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`${periodLabel} törlése`}
      className="text-gray-400 hover:text-red-600 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
