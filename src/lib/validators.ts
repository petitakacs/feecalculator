import { z } from "zod";

export const CreateLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional().nullable(),
  serviceChargePercent: z.number().min(0).max(1).optional().nullable(),
  active: z.boolean().default(true),
});

export const UpdateLocationSchema = CreateLocationSchema.partial();

export const CreateExtraTaskTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  bonusType: z.enum(["FIXED_AMOUNT", "HOURLY_RATE", "MULTIPLIER_FULL_HOURLY", "MULTIPLIER_SERVICE_CHARGE_HOURLY"]),
  bonusAmount: z.number().int().min(0).default(0),
  rateMultiplier: z.number().positive().optional().nullable(),
  active: z.boolean().default(true),
});

export const UpdateExtraTaskTypeSchema = CreateExtraTaskTypeSchema.partial();

export const AssignExtraTaskSchema = z.object({
  employeeId: z.string().min(1),
  extraTaskTypeId: z.string().min(1),
  hours: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  positionId: z.string().min(1, "Position is required"),
  baseSalaryType: z.enum(["HOURLY", "MONTHLY"]),
  baseSalaryAmount: z.number().int().min(0),
  eligibleForServiceCharge: z.boolean().default(true),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  variationId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();

export const CreatePositionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  multiplier: z.number().min(0),
  fixedHourlySZD: z.number().int().min(0).optional().nullable(),
  eligibleForServiceCharge: z.boolean().default(true),
  defaultOvertimeRule: z.string().optional().nullable(),
  minHourlyServiceCharge: z.number().int().optional().nullable(),
  maxHourlyServiceCharge: z.number().int().optional().nullable(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const UpdatePositionSchema = CreatePositionSchema.partial();

export const CreateSeasonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  referenceMode: z.enum(["SALES_BASED", "MANUAL_TARGET", "SALES_BASED_WITH_LIMITS"]),
  manualWaiterTargetHourly: z.number().int().optional().nullable(),
  minAllowedVariance: z.number().optional().nullable(),
  maxAllowedVariance: z.number().optional().nullable(),
  active: z.boolean().default(true),
});

export const UpdateSeasonSchema = CreateSeasonSchema.partial();

export const CreatePeriodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  seasonId: z.string().min(1, "Season is required"),
  locationId: z.string().optional().nullable(),
  openingBalance: z.number().int().default(0),
  collectedServiceCharge: z.number().int().min(0),
  notes: z.string().optional().nullable(),
});

export const UpdatePeriodSchema = z.object({
  openingBalance: z.number().int().optional(),
  collectedServiceCharge: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  seasonId: z.string().optional(),
});

export const UpdateEntrySchema = z.object({
  workedHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  netWaiterSales: z.number().int().optional().nullable(),
  bonus: z.number().int().optional(),
  overtimePayment: z.number().int().optional(),
  manualCorrection: z.number().int().optional(),
  manualCorrectionReason: z.string().optional().nullable(),
  finalApprovedAmount: z.number().int().optional().nullable(),
  targetNetHourlyServiceCharge: z.number().int().optional().nullable(),
  targetServiceChargeAmount: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  overrideFlag: z.boolean().optional(),
  overrideReason: z.string().optional().nullable(),
  workingLocationId: z.string().optional().nullable(),
  isLoanEntry: z.boolean().optional(),
  entryLabel: z.string().optional().nullable(),
});

export const ApprovalActionSchema = z.object({
  action: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "REOPENED", "CLOSED"]),
  comment: z.string().optional(),
});

export const BusinessRuleSchema = z.object({
  effectiveFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  effectiveTo: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  serviceChargePercent: z.number().min(0).max(1),
  employeeContribution: z.number().min(0).max(1),
  notes: z.string().optional().nullable(),
});

export const SimulationSchema = z.object({
  openingBalance: z.number().int(),
  collectedServiceCharge: z.number().int().min(0),
  waiterNetSales: z.number().int().min(0),
  waiterWorkedHours: z.number().min(0),
  mode: z.enum(["SALES_BASED", "MANUAL_TARGET", "SALES_BASED_WITH_LIMITS"]),
  manualWaiterTargetHourly: z.number().int().optional().nullable(),
  minHourlyCents: z.number().int().optional().nullable(),
  maxHourlyCents: z.number().int().optional().nullable(),
  serviceChargePercent: z.number().min(0).max(1),
  employeeContribution: z.number().min(0).max(1),
});
