import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { SimulationSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import {
  calculateWaiterServiceCharge,
  calculateWaiterReferenceHourlyRate,
  applySeasonMode,
  calculateDistributableBalance,
  calculateClosingBalance,
  WaiterEntry,
} from "@/lib/calculation-engine";

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "simulation:run")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = SimulationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const {
    openingBalance,
    collectedServiceCharge,
    waiterNetSales,
    waiterWorkedHours,
    mode,
    manualWaiterTargetHourly,
    minHourlyCents,
    maxHourlyCents,
    serviceChargePercent,
    employeeContribution,
  } = parsed.data;

  const rules = { serviceChargePercent, employeeContribution };

  const waiterEntry: WaiterEntry = {
    employeeId: "sim",
    workedHours: waiterWorkedHours,
    netSalesCents: waiterNetSales,
  };

  const rawRate = calculateWaiterReferenceHourlyRate([waiterEntry], rules);
  const adjustedRate = applySeasonMode(rawRate, {
    mode,
    manualWaiterTargetHourlyCents: manualWaiterTargetHourly ?? undefined,
    minHourlyCents: minHourlyCents ?? undefined,
    maxHourlyCents: maxHourlyCents ?? undefined,
  });

  const { net: waiterNetSC } = calculateWaiterServiceCharge(waiterNetSales, rules);

  const distributableBalance = calculateDistributableBalance(
    openingBalance,
    collectedServiceCharge
  );

  // Simulate distribution: assume waiter gets their net SC
  const simulatedDistribution = waiterNetSC;

  const closingBalance = calculateClosingBalance(
    openingBalance,
    collectedServiceCharge,
    simulatedDistribution
  );

  return NextResponse.json({
    waiterReferenceHourlyRate: adjustedRate,
    waiterGrossServiceCharge: Math.round(waiterNetSales * serviceChargePercent),
    waiterNetServiceCharge: waiterNetSC,
    distributableBalance,
    simulatedDistribution,
    closingBalance,
  });
}
