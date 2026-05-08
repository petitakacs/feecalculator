import { useMutation } from "@tanstack/react-query";

interface SimulationParams {
  openingBalance: number;
  collectedServiceCharge: number;
  waiterNetSales: number;
  waiterWorkedHours: number;
  mode: "SALES_BASED" | "MANUAL_TARGET" | "SALES_BASED_WITH_LIMITS";
  manualWaiterTargetHourly?: number;
  minHourlyCents?: number;
  maxHourlyCents?: number;
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

export function useSimulation() {
  return useMutation<SimulationResult, Error, SimulationParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Simulation failed");
      }
      return res.json();
    },
  });
}
