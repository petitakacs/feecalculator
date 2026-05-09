import {
  calculateWaiterServiceCharge,
  calculateWaiterReferenceHourlyRate,
  applySeasonMode,
  calculateEmployeeTarget,
  calculatePeriod,
  calculateClosingBalance,
  calculateDistributableBalance,
  BusinessRuleParams,
  WaiterEntry,
  PositionEntry,
  SeasonParams,
} from "./calculation-engine";

const defaultRules: BusinessRuleParams = {
  serviceChargePercent: 0.039,
  employeeContribution: 0.185,
};

describe("calculateWaiterServiceCharge", () => {
  test("calculates gross and net SC correctly", () => {
    // 10000 EUR net sales = 1000000 cents
    const netSales = 1000000; // €10,000
    const result = calculateWaiterServiceCharge(netSales, defaultRules);

    // gross = 1000000 * 0.039 = 39000
    expect(result.gross).toBe(39000);
    // net = 39000 * (1 - 0.185) = 39000 * 0.815 = 31785
    expect(result.net).toBe(31785);
  });

  test("calculates zero for zero sales", () => {
    const result = calculateWaiterServiceCharge(0, defaultRules);
    expect(result.gross).toBe(0);
    expect(result.net).toBe(0);
  });

  test("rounds correctly", () => {
    const result = calculateWaiterServiceCharge(100, defaultRules);
    // gross = 100 * 0.039 = 3.9 → round → 4
    expect(result.gross).toBe(4);
    // net = 4 * 0.815 = 3.26 → round → 3
    expect(result.net).toBe(3);
  });

  test("handles large values without floating point errors", () => {
    const netSales = 50000000; // €500,000
    const result = calculateWaiterServiceCharge(netSales, defaultRules);
    expect(result.gross).toBe(1950000);
    expect(result.net).toBe(Math.round(1950000 * 0.815));
  });
});

describe("calculateWaiterReferenceHourlyRate", () => {
  test("calculates rate with single waiter", () => {
    const waiters: WaiterEntry[] = [
      { employeeId: "w1", workedHours: 160, netSalesCents: 1000000 },
    ];
    const rate = calculateWaiterReferenceHourlyRate(waiters, defaultRules);
    // net SC = 31785, hours = 160
    // rate = Math.round(31785 / 160) = Math.round(198.65625) = 199
    expect(rate).toBe(199);
  });

  test("calculates rate with multiple waiters", () => {
    const waiters: WaiterEntry[] = [
      { employeeId: "w1", workedHours: 160, netSalesCents: 1000000 },
      { employeeId: "w2", workedHours: 80, netSalesCents: 500000 },
    ];
    const rate = calculateWaiterReferenceHourlyRate(waiters, defaultRules);
    // w1: net SC = 31785, w2: net SC = 15892 (rounded)
    const w1Net = Math.round(Math.round(1000000 * 0.039) * 0.815);
    const w2Net = Math.round(Math.round(500000 * 0.039) * 0.815);
    const totalNet = w1Net + w2Net;
    const totalHours = 160 + 80;
    expect(rate).toBe(Math.round(totalNet / totalHours));
  });

  test("returns 0 for empty waiters", () => {
    const rate = calculateWaiterReferenceHourlyRate([], defaultRules);
    expect(rate).toBe(0);
  });

  test("returns 0 if all waiters have 0 hours", () => {
    const waiters: WaiterEntry[] = [
      { employeeId: "w1", workedHours: 0, netSalesCents: 1000000 },
    ];
    const rate = calculateWaiterReferenceHourlyRate(waiters, defaultRules);
    expect(rate).toBe(0);
  });
});

describe("applySeasonMode", () => {
  const rawRate = 200; // 200 cents per hour

  test("SALES_BASED mode returns raw rate unchanged", () => {
    const params: SeasonParams = { mode: "SALES_BASED" };
    expect(applySeasonMode(rawRate, params)).toBe(200);
  });

  test("MANUAL_TARGET mode returns manual rate", () => {
    const params: SeasonParams = {
      mode: "MANUAL_TARGET",
      manualWaiterTargetHourlyCents: 250,
    };
    expect(applySeasonMode(rawRate, params)).toBe(250);
  });

  test("MANUAL_TARGET with no manual rate falls back to raw", () => {
    const params: SeasonParams = { mode: "MANUAL_TARGET" };
    expect(applySeasonMode(rawRate, params)).toBe(200);
  });

  test("SALES_BASED_WITH_LIMITS clamps rate to min", () => {
    const params: SeasonParams = {
      mode: "SALES_BASED_WITH_LIMITS",
      minHourlyCents: 250,
      maxHourlyCents: 300,
    };
    expect(applySeasonMode(rawRate, params)).toBe(250);
  });

  test("SALES_BASED_WITH_LIMITS clamps rate to max", () => {
    const params: SeasonParams = {
      mode: "SALES_BASED_WITH_LIMITS",
      minHourlyCents: 100,
      maxHourlyCents: 180,
    };
    expect(applySeasonMode(rawRate, params)).toBe(180);
  });

  test("SALES_BASED_WITH_LIMITS keeps rate within bounds", () => {
    const params: SeasonParams = {
      mode: "SALES_BASED_WITH_LIMITS",
      minHourlyCents: 100,
      maxHourlyCents: 300,
    };
    expect(applySeasonMode(rawRate, params)).toBe(200);
  });

  test("SALES_BASED_WITH_LIMITS with only min", () => {
    const params: SeasonParams = {
      mode: "SALES_BASED_WITH_LIMITS",
      minHourlyCents: 250,
    };
    expect(applySeasonMode(rawRate, params)).toBe(250);
  });

  test("SALES_BASED_WITH_LIMITS with only max", () => {
    const params: SeasonParams = {
      mode: "SALES_BASED_WITH_LIMITS",
      maxHourlyCents: 150,
    };
    expect(applySeasonMode(rawRate, params)).toBe(150);
  });
});

describe("calculateEmployeeTarget", () => {
  test("calculates basic target with multiplier 1.0", () => {
    const result = calculateEmployeeTarget(160, 200, 1.0, 0, 0, 0);
    // targetSC = 160 * Math.round(200 * 1.0) = 160 * 200 = 32000
    expect(result.targetSC).toBe(32000);
    expect(result.finalTarget).toBe(32000);
  });

  test("applies multiplier for non-waiter positions", () => {
    const result = calculateEmployeeTarget(160, 200, 1.3, 0, 0, 0);
    // positionRate = Math.round(200 * 1.3) = Math.round(260) = 260
    // targetSC = 160 * 260 = 41600
    expect(result.targetSC).toBe(41600);
  });

  test("adds bonus, overtime, and correction to final target", () => {
    const result = calculateEmployeeTarget(160, 200, 1.0, 5000, 2000, 1000);
    expect(result.targetSC).toBe(32000);
    expect(result.finalTarget).toBe(32000 + 5000 + 2000 + 1000);
  });

  test("handles zero hours", () => {
    const result = calculateEmployeeTarget(0, 200, 1.0, 5000, 0, 0);
    expect(result.targetSC).toBe(0);
    expect(result.finalTarget).toBe(5000);
  });

  test("handles negative correction", () => {
    const result = calculateEmployeeTarget(160, 200, 1.0, 0, 0, -5000);
    expect(result.finalTarget).toBe(32000 - 5000);
  });
});

describe("calculatePeriod", () => {
  const waiters: WaiterEntry[] = [
    { employeeId: "emp1", workedHours: 160, netSalesCents: 2000000 },
  ];

  const allEntries: PositionEntry[] = [
    {
      entryId: "entry1",
      employeeId: "emp1",
      positionId: "pos1",
      multiplier: 1.0,
      workedHours: 160,
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
    },
    {
      entryId: "entry2",
      employeeId: "emp2",
      positionId: "pos2",
      multiplier: 0.9,
      workedHours: 120,
      bonus: 1000,
      overtimePayment: 0,
      manualCorrection: 0,
    },
  ];

  const seasonParams: SeasonParams = { mode: "SALES_BASED" };

  test("calculates period correctly", () => {
    const result = calculatePeriod(waiters, allEntries, defaultRules, seasonParams);

    expect(result.waiterReferenceHourlyRateCents).toBeGreaterThan(0);
    expect(result.entries).toHaveLength(2);
    expect(result.targetDistributionTotalCents).toBeGreaterThan(0);
  });

  test("includes waiter SC in waiter entries", () => {
    const result = calculatePeriod(waiters, allEntries, defaultRules, seasonParams);
    const waiterEntry = result.entries.find((e) => e.employeeId === "emp1");
    expect(waiterEntry?.calculatedGrossServiceChargeCents).not.toBeNull();
    expect(waiterEntry?.calculatedNetServiceChargeCents).not.toBeNull();
  });

  test("non-waiter entries have null SC values", () => {
    const result = calculatePeriod(waiters, allEntries, defaultRules, seasonParams);
    const nonWaiterEntry = result.entries.find((e) => e.employeeId === "emp2");
    expect(nonWaiterEntry?.calculatedGrossServiceChargeCents).toBeNull();
    expect(nonWaiterEntry?.calculatedNetServiceChargeCents).toBeNull();
  });

  test("handles empty period with no waiters", () => {
    const result = calculatePeriod([], [], defaultRules, seasonParams);
    expect(result.waiterReferenceHourlyRateCents).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.targetDistributionTotalCents).toBe(0);
  });

  test("handles zero sales waiter", () => {
    const zeroWaiters: WaiterEntry[] = [
      { employeeId: "w1", workedHours: 160, netSalesCents: 0 },
    ];
    const result = calculatePeriod(zeroWaiters, allEntries, defaultRules, seasonParams);
    expect(result.waiterReferenceHourlyRateCents).toBe(0);
  });
});

describe("calculateDistributableBalance", () => {
  test("adds opening balance and collected SC", () => {
    expect(calculateDistributableBalance(10000, 5000)).toBe(15000);
  });

  test("handles zero values", () => {
    expect(calculateDistributableBalance(0, 0)).toBe(0);
  });

  test("handles negative opening balance (carry-over debt)", () => {
    expect(calculateDistributableBalance(-2000, 10000)).toBe(8000);
  });
});

describe("calculateClosingBalance", () => {
  test("calculates closing balance correctly", () => {
    // closing = opening + collected - approved
    expect(calculateClosingBalance(10000, 20000, 25000)).toBe(5000);
  });

  test("can result in negative balance", () => {
    expect(calculateClosingBalance(0, 10000, 15000)).toBe(-5000);
  });

  test("handles zero distribution", () => {
    expect(calculateClosingBalance(5000, 10000, 0)).toBe(15000);
  });
});
