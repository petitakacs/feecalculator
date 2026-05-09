// Core calculation engine - pure functions, no side effects, no database calls
// All monetary values are in cents (integers)
// All percentages are decimals (0.039 = 3.9%)

export interface BusinessRuleParams {
  serviceChargePercent: number; // e.g., 0.039
  employeeContribution: number; // e.g., 0.185
}

export interface WaiterEntry {
  employeeId: string;
  workedHours: number;
  netSalesCents: number;
}

export interface PositionEntry {
  entryId: string;
  employeeId: string;
  positionId: string;
  multiplier: number;
  workedHours: number;
  bonus: number; // cents
  overtimePayment: number; // cents
  manualCorrection: number; // cents
}

export interface SeasonParams {
  mode: "SALES_BASED" | "MANUAL_TARGET" | "SALES_BASED_WITH_LIMITS";
  manualWaiterTargetHourlyCents?: number;
  minHourlyCents?: number;
  maxHourlyCents?: number;
}

export interface CalculationResult {
  waiterReferenceHourlyRateCents: number;
  entries: EntryResult[];
  targetDistributionTotalCents: number;
}

export interface EntryResult {
  entryId: string;
  employeeId: string;
  calculatedGrossServiceChargeCents: number | null;
  calculatedNetServiceChargeCents: number | null;
  targetNetHourlyServiceChargeCents: number;
  targetServiceChargeAmountCents: number;
  finalTargetAmountCents: number;
}

/**
 * Calculate waiter gross and net service charge from their net sales
 */
export function calculateWaiterServiceCharge(
  netSalesCents: number,
  rules: BusinessRuleParams
): { gross: number; net: number } {
  const gross = Math.round(netSalesCents * rules.serviceChargePercent);
  const net = Math.round(gross * (1 - rules.employeeContribution));
  return { gross, net };
}

/**
 * Calculate the reference hourly rate for waiters based on their sales
 * Returns 0 if no waiters have worked hours
 */
export function calculateWaiterReferenceHourlyRate(
  waiters: WaiterEntry[],
  rules: BusinessRuleParams
): number {
  if (waiters.length === 0) return 0;

  let totalNetSC = 0;
  let totalHours = 0;

  for (const waiter of waiters) {
    if (waiter.workedHours > 0) {
      const { net } = calculateWaiterServiceCharge(waiter.netSalesCents, rules);
      totalNetSC += net;
      totalHours += waiter.workedHours;
    }
  }

  if (totalHours === 0) return 0;

  return Math.round(totalNetSC / totalHours);
}

/**
 * Apply the season mode to the raw rate
 * Mode A (SALES_BASED): use raw rate as-is
 * Mode B (MANUAL_TARGET): use fixed manual rate
 * Mode C (SALES_BASED_WITH_LIMITS): clamp raw rate within min/max
 */
export function applySeasonMode(
  rawRateCents: number,
  params: SeasonParams
): number {
  switch (params.mode) {
    case "SALES_BASED":
      return rawRateCents;

    case "MANUAL_TARGET":
      return params.manualWaiterTargetHourlyCents ?? rawRateCents;

    case "SALES_BASED_WITH_LIMITS": {
      let rate = rawRateCents;
      if (params.minHourlyCents !== undefined) {
        rate = Math.max(rate, params.minHourlyCents);
      }
      if (params.maxHourlyCents !== undefined) {
        rate = Math.min(rate, params.maxHourlyCents);
      }
      return rate;
    }

    default:
      return rawRateCents;
  }
}

/**
 * Calculate employee target service charge
 */
export function calculateEmployeeTarget(
  workedHours: number,
  hourlyRateCents: number,
  multiplier: number,
  bonus: number,
  overtimePayment: number,
  manualCorrection: number
): { targetSC: number; finalTarget: number } {
  const positionHourlyRate = Math.round(hourlyRateCents * multiplier);
  const targetSC = Math.round(workedHours * positionHourlyRate);
  const finalTarget = targetSC + bonus + overtimePayment + manualCorrection;
  return { targetSC, finalTarget };
}

/**
 * Main period calculation function
 * Takes all input data and returns computed results
 */
export function calculatePeriod(
  waiters: WaiterEntry[],
  allEntries: PositionEntry[],
  rules: BusinessRuleParams,
  seasonParams: SeasonParams
): CalculationResult {
  // Step 1: Calculate waiter reference hourly rate
  const rawRateCents = calculateWaiterReferenceHourlyRate(waiters, rules);

  // Step 2: Apply season mode
  const waiterReferenceHourlyRateCents = applySeasonMode(rawRateCents, seasonParams);

  // Build a map of waiter results by employeeId
  const waiterMap = new Map<
    string,
    { gross: number | null; net: number | null }
  >();
  for (const waiter of waiters) {
    const { gross, net } = calculateWaiterServiceCharge(
      waiter.netSalesCents,
      rules
    );
    waiterMap.set(waiter.employeeId, { gross, net });
  }

  // Step 3: Calculate each employee's target
  const entries: EntryResult[] = [];
  let totalDistribution = 0;

  for (const entry of allEntries) {
    const positionHourlyRateCents = Math.round(
      waiterReferenceHourlyRateCents * entry.multiplier
    );

    const { targetSC, finalTarget } = calculateEmployeeTarget(
      entry.workedHours,
      waiterReferenceHourlyRateCents,
      entry.multiplier,
      entry.bonus,
      entry.overtimePayment,
      entry.manualCorrection
    );

    const waiterResult = waiterMap.get(entry.employeeId);

    entries.push({
      entryId: entry.entryId,
      employeeId: entry.employeeId,
      calculatedGrossServiceChargeCents: waiterResult?.gross ?? null,
      calculatedNetServiceChargeCents: waiterResult?.net ?? null,
      targetNetHourlyServiceChargeCents: positionHourlyRateCents,
      targetServiceChargeAmountCents: targetSC,
      finalTargetAmountCents: finalTarget,
    });

    totalDistribution += finalTarget;
  }

  return {
    waiterReferenceHourlyRateCents,
    entries,
    targetDistributionTotalCents: totalDistribution,
  };
}

/**
 * Calculate the distributable balance
 */
export function calculateDistributableBalance(
  openingBalance: number,
  collected: number
): number {
  return openingBalance + collected;
}

/**
 * Calculate the closing balance
 */
export function calculateClosingBalance(
  openingBalance: number,
  collected: number,
  approvedDistribution: number
): number {
  return openingBalance + collected - approvedDistribution;
}
