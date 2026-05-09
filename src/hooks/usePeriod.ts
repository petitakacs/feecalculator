import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MonthlyPeriod, MonthlyEmployeeEntry } from "@/types";

export function usePeriod(id: string) {
  return useQuery<MonthlyPeriod>({
    queryKey: ["period", id],
    queryFn: async () => {
      const res = await fetch(`/api/periods/${id}`);
      if (!res.ok) throw new Error("Failed to fetch period");
      return res.json();
    },
    enabled: !!id,
  });
}

export function usePeriods() {
  return useQuery<MonthlyPeriod[]>({
    queryKey: ["periods"],
    queryFn: async () => {
      const res = await fetch("/api/periods");
      if (!res.ok) throw new Error("Failed to fetch periods");
      return res.json();
    },
  });
}

export function usePeriodEntries(periodId: string) {
  return useQuery<MonthlyEmployeeEntry[]>({
    queryKey: ["period-entries", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/periods/${periodId}/entries`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
    enabled: !!periodId,
  });
}

export function useCalculatePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) => {
      const res = await fetch(`/api/periods/${periodId}/calculate`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Calculation failed");
      }
      return res.json();
    },
    onSuccess: (_data, periodId) => {
      queryClient.invalidateQueries({ queryKey: ["period", periodId] });
      queryClient.invalidateQueries({ queryKey: ["period-entries", periodId] });
    },
  });
}
