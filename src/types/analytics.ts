export interface AnalyticsRecord {
  // IDs
  periodId: string;
  employeeId: string;
  // Display
  employeeName: string;
  positionName: string;
  locationName: string | null;
  // Period
  month: number;
  year: number;
  periodStatus: string;
  // Work
  workedHours: number;
  // SZD
  targetSZD: number; // targetServiceChargeAmount ?? 0
  approvedSZD: number | null; // finalApprovedAmount (null = not overridden)
  effectiveSZD: number; // approvedSZD ?? targetSZD
  // Supplements
  bonus: number;
  overtimePayment: number;
  manualCorrection: number;
  // Extra tasks
  extraTasksTotal: number;
  // Totals
  totalPayout: number; // effectiveSZD + bonus + overtimePayment + manualCorrection + extraTasksTotal
  // Flags
  overrideFlag: boolean;
}
