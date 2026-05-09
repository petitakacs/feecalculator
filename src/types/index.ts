// Central types file for the application

export type Role =
  | "ADMIN"
  | "BUSINESS_UNIT_LEAD"
  | "STORE_MANAGER"
  | "FINANCE_VIEWER"
  | "PAYROLL_EXPORT_USER";

export type PeriodStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "CLOSED";

export type ReferenceMode =
  | "SALES_BASED"
  | "MANUAL_TARGET"
  | "SALES_BASED_WITH_LIMITS";

export type SalaryType = "HOURLY" | "MONTHLY";

export type ApprovalAction =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "REOPENED"
  | "CLOSED";

export type ExtraBonusType =
  | "FIXED_AMOUNT"
  | "HOURLY_RATE"
  | "MULTIPLIER_FULL_HOURLY"
  | "MULTIPLIER_SERVICE_CHARGE_HOURLY";

export interface Location {
  id: string;
  name: string;
  address?: string;
  serviceChargePercent?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  name: string;
  multiplier: number;
  eligibleForServiceCharge: boolean;
  defaultOvertimeRule?: string;
  minHourlyServiceCharge?: number;
  maxHourlyServiceCharge?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionVariation {
  id: string;
  positionId: string;
  name: string;
  multiplierDelta: number;
  active: boolean;
}

export interface Employee {
  id: string;
  name: string;
  active: boolean;
  positionId: string;
  position?: Position;
  variationId?: string;
  variation?: PositionVariation;
  baseSalaryType: SalaryType;
  baseSalaryAmount: number;
  eligibleForServiceCharge: boolean;
  startDate: string;
  endDate?: string;
  locationId?: string;
  location?: Location;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  referenceMode: ReferenceMode;
  manualWaiterTargetHourly?: number;
  minAllowedVariance?: number;
  maxAllowedVariance?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessRule {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string;
  serviceChargePercent: number;
  employeeContribution: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyPeriod {
  id: string;
  month: number;
  year: number;
  locationId?: string;
  location?: Location;
  seasonId: string;
  season?: Season;
  openingBalance: number;
  collectedServiceCharge: number;
  distributableBalance: number;
  targetDistributionTotal: number;
  approvedDistributionTotal: number;
  closingBalance: number;
  waiterReferenceHourlyRate?: number;
  status: PeriodStatus;
  notes?: string;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
  entries?: MonthlyEmployeeEntry[];
  approvals?: PeriodApproval[];
}

export interface MonthlyEmployeeEntry {
  id: string;
  periodId: string;
  employeeId: string;
  employee?: Employee;
  positionId: string;
  position?: Position;
  workingLocationId?: string;
  workingLocation?: Location;
  isLoanEntry: boolean;
  entryLabel?: string;
  workedHours: number;
  overtimeHours: number;
  netWaiterSales?: number;
  calculatedGrossServiceCharge?: number;
  calculatedNetServiceCharge?: number;
  targetNetHourlyServiceCharge?: number;
  calculatedTargetNetHourlyServiceCharge?: number;
  targetServiceChargeAmount?: number;
  bonus: number;
  overtimePayment: number;
  manualCorrection: number;
  manualCorrectionReason?: string;
  finalApprovedAmount?: number;
  notes?: string;
  overrideFlag: boolean;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtraTaskType {
  id: string;
  name: string;
  description?: string;
  bonusType: ExtraBonusType;
  bonusAmount: number;
  rateMultiplier?: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyExtraTask {
  id: string;
  periodId: string;
  employeeId: string;
  employee?: Employee;
  extraTaskTypeId: string;
  extraTaskType?: ExtraTaskType;
  hours?: number;
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodApproval {
  id: string;
  periodId: string;
  userId: string;
  user?: User;
  action: ApprovalAction;
  comment?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  periodId?: string;
  userId: string;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSummary {
  period?: MonthlyPeriod;
  collectedServiceCharge: number;
  openingBalance: number;
  targetDistribution: number;
  approvedDistribution: number;
  closingBalance: number;
  warnings: Warning[];
}

export interface Warning {
  type: "negative_balance" | "pending_approval" | "unmatched_employee" | "missing_data";
  message: string;
  severity: "error" | "warning" | "info";
}

export interface SimulationParams {
  openingBalance: number;
  collectedServiceCharge: number;
  waiterNetSales: number;
  waiterWorkedHours: number;
  mode: ReferenceMode;
  manualWaiterTargetHourly?: number;
  minAllowedVariance?: number;
  maxAllowedVariance?: number;
  serviceChargePercent: number;
  employeeContribution: number;
}

export interface SimulationResult {
  waiterReferenceHourlyRate: number;
  distributableBalance: number;
  targetDistributionTotal: number;
  closingBalance: number;
}

// Next Auth types extension
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
