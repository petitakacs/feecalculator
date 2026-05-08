import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create users
  const adminPassword = await hash("admin123", 12);
  const managerPassword = await hash("manager123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@cafe.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@cafe.com",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@cafe.com" },
    update: {},
    create: {
      name: "Store Manager",
      email: "manager@cafe.com",
      passwordHash: managerPassword,
      role: "STORE_MANAGER",
    },
  });

  const bulead = await prisma.user.upsert({
    where: { email: "lead@cafe.com" },
    update: {},
    create: {
      name: "Business Lead",
      email: "lead@cafe.com",
      passwordHash: await hash("lead123", 12),
      role: "BUSINESS_UNIT_LEAD",
    },
  });

  console.log(`Created users: ${admin.email}, ${manager.email}, ${bulead.email}`);

  // Create positions
  const positions = await Promise.all([
    prisma.position.upsert({
      where: { name: "Waiter" },
      update: { multiplier: 1.0 },
      create: {
        name: "Waiter",
        multiplier: 1.0,
        eligibleForServiceCharge: true,
        active: true,
      },
    }),
    prisma.position.upsert({
      where: { name: "Barista" },
      update: { multiplier: 0.9 },
      create: {
        name: "Barista",
        multiplier: 0.9,
        eligibleForServiceCharge: true,
        active: true,
      },
    }),
    prisma.position.upsert({
      where: { name: "Shift Lead" },
      update: { multiplier: 1.15 },
      create: {
        name: "Shift Lead",
        multiplier: 1.15,
        eligibleForServiceCharge: true,
        active: true,
      },
    }),
    prisma.position.upsert({
      where: { name: "Assistant Manager" },
      update: { multiplier: 1.3 },
      create: {
        name: "Assistant Manager",
        multiplier: 1.3,
        eligibleForServiceCharge: true,
        active: true,
      },
    }),
    prisma.position.upsert({
      where: { name: "Manager" },
      update: { multiplier: 1.5 },
      create: {
        name: "Manager",
        multiplier: 1.5,
        eligibleForServiceCharge: true,
        active: true,
      },
    }),
  ]);

  const [waiterPos, baristaPos, shiftLeadPos, asmPos, managerPos] = positions;
  console.log(`Created ${positions.length} positions`);

  // Create business rule
  const rule = await prisma.businessRule.upsert({
    where: { id: "default-rule" },
    update: {},
    create: {
      id: "default-rule",
      effectiveFrom: new Date("2024-01-01"),
      serviceChargePercent: 0.039, // 3.9%
      employeeContribution: 0.185, // 18.5%
      notes: "Standard service charge rates",
    },
  });
  console.log(`Created business rule: SC=${Number(rule.serviceChargePercent) * 100}%`);

  // Create season
  const season = await prisma.season.upsert({
    where: { id: "season-2024" },
    update: {},
    create: {
      id: "season-2024",
      name: "2024-2025 Season",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2025-12-31"),
      referenceMode: "SALES_BASED",
      active: true,
    },
  });
  console.log(`Created season: ${season.name}`);

  // Create employees
  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { id: "emp-1" },
      update: {},
      create: {
        id: "emp-1",
        name: "Alice Martin",
        positionId: waiterPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1200, // €12.00/hr
        eligibleForServiceCharge: true,
        startDate: new Date("2022-03-15"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-2" },
      update: {},
      create: {
        id: "emp-2",
        name: "Bob Johnson",
        positionId: waiterPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1200,
        eligibleForServiceCharge: true,
        startDate: new Date("2021-06-01"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-3" },
      update: {},
      create: {
        id: "emp-3",
        name: "Carol Smith",
        positionId: baristaPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1150,
        eligibleForServiceCharge: true,
        startDate: new Date("2023-01-10"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-4" },
      update: {},
      create: {
        id: "emp-4",
        name: "David Lee",
        positionId: baristaPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1150,
        eligibleForServiceCharge: true,
        startDate: new Date("2022-08-15"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-5" },
      update: {},
      create: {
        id: "emp-5",
        name: "Emma Wilson",
        positionId: shiftLeadPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1400,
        eligibleForServiceCharge: true,
        startDate: new Date("2020-11-01"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-6" },
      update: {},
      create: {
        id: "emp-6",
        name: "Frank Brown",
        positionId: shiftLeadPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 1400,
        eligibleForServiceCharge: true,
        startDate: new Date("2021-04-20"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-7" },
      update: {},
      create: {
        id: "emp-7",
        name: "Grace Taylor",
        positionId: asmPos.id,
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 280000, // €2800/month
        eligibleForServiceCharge: true,
        startDate: new Date("2019-09-01"),
        active: true,
      },
    }),
    prisma.employee.upsert({
      where: { id: "emp-8" },
      update: {},
      create: {
        id: "emp-8",
        name: "Henry Davis",
        positionId: managerPos.id,
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 350000, // €3500/month
        eligibleForServiceCharge: true,
        startDate: new Date("2018-05-15"),
        active: true,
      },
    }),
  ]);
  console.log(`Created ${employees.length} employees`);

  // Create a completed monthly period for December 2024
  const period = await prisma.monthlyPeriod.upsert({
    where: { month_year: { month: 12, year: 2024 } },
    update: {},
    create: {
      month: 12,
      year: 2024,
      seasonId: season.id,
      openingBalance: 150000, // €1500 carry-over
      collectedServiceCharge: 580000, // €5800 collected
      distributableBalance: 730000, // 1500 + 5800
      targetDistributionTotal: 685000, // computed
      approvedDistributionTotal: 685000,
      closingBalance: 45000, // 730000 - 685000
      status: "CLOSED",
      lockedAt: new Date("2025-01-05"),
      lockedBy: bulead.id,
      notes: "December 2024 - Christmas period, high sales",
    },
  });
  console.log(`Created period: Dec 2024 (CLOSED)`);

  // Create period entries for the December period
  // Waiter entries (with sales)
  const dec24Entries = [
    {
      employeeId: "emp-1",
      positionId: waiterPos.id,
      workedHours: 176,
      overtimeHours: 16,
      netWaiterSales: 3200000, // €32,000
      calculatedGrossServiceCharge: Math.round(3200000 * 0.039), // 124800
      calculatedNetServiceCharge: Math.round(Math.round(3200000 * 0.039) * 0.815), // 101712
      targetNetHourlyServiceCharge: 199, // ~€1.99/hr
      targetServiceChargeAmount: Math.round(176 * 199), // 35024
      bonus: 5000, // €50
      overtimePayment: 2400, // €24
      manualCorrection: 0,
      finalApprovedAmount: Math.round(176 * 199) + 5000 + 2400, // 42424
      overrideFlag: false,
    },
    {
      employeeId: "emp-2",
      positionId: waiterPos.id,
      workedHours: 160,
      overtimeHours: 8,
      netWaiterSales: 2800000, // €28,000
      calculatedGrossServiceCharge: Math.round(2800000 * 0.039),
      calculatedNetServiceCharge: Math.round(Math.round(2800000 * 0.039) * 0.815),
      targetNetHourlyServiceCharge: 199,
      targetServiceChargeAmount: Math.round(160 * 199),
      bonus: 0,
      overtimePayment: 1600,
      manualCorrection: 0,
      finalApprovedAmount: Math.round(160 * 199) + 1600,
      overrideFlag: false,
    },
    {
      employeeId: "emp-3",
      positionId: baristaPos.id,
      workedHours: 168,
      overtimeHours: 0,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 0.9), // 179
      targetServiceChargeAmount: Math.round(168 * Math.round(199 * 0.9)),
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: Math.round(168 * Math.round(199 * 0.9)),
      overrideFlag: false,
    },
    {
      employeeId: "emp-4",
      positionId: baristaPos.id,
      workedHours: 152,
      overtimeHours: 0,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 0.9),
      targetServiceChargeAmount: Math.round(152 * Math.round(199 * 0.9)),
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 500,
      finalApprovedAmount: Math.round(152 * Math.round(199 * 0.9)) + 500,
      overrideFlag: false,
    },
    {
      employeeId: "emp-5",
      positionId: shiftLeadPos.id,
      workedHours: 176,
      overtimeHours: 8,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 1.15),
      targetServiceChargeAmount: Math.round(176 * Math.round(199 * 1.15)),
      bonus: 0,
      overtimePayment: 1800,
      manualCorrection: 0,
      finalApprovedAmount: Math.round(176 * Math.round(199 * 1.15)) + 1800,
      overrideFlag: false,
    },
    {
      employeeId: "emp-6",
      positionId: shiftLeadPos.id,
      workedHours: 160,
      overtimeHours: 0,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 1.15),
      targetServiceChargeAmount: Math.round(160 * Math.round(199 * 1.15)),
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: Math.round(160 * Math.round(199 * 1.15)),
      overrideFlag: false,
    },
    {
      employeeId: "emp-7",
      positionId: asmPos.id,
      workedHours: 176,
      overtimeHours: 0,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 1.3),
      targetServiceChargeAmount: Math.round(176 * Math.round(199 * 1.3)),
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: Math.round(176 * Math.round(199 * 1.3)),
      overrideFlag: false,
    },
    {
      employeeId: "emp-8",
      positionId: managerPos.id,
      workedHours: 176,
      overtimeHours: 0,
      netWaiterSales: null,
      calculatedGrossServiceCharge: null,
      calculatedNetServiceCharge: null,
      targetNetHourlyServiceCharge: Math.round(199 * 1.5),
      targetServiceChargeAmount: Math.round(176 * Math.round(199 * 1.5)),
      bonus: 10000, // €100 holiday bonus
      overtimePayment: 0,
      manualCorrection: 0,
      // Override: manager gets flat amount
      finalApprovedAmount: 65000,
      overrideFlag: true,
      overrideReason: "Fixed managerial amount agreed with BU Lead",
    },
  ];

  for (const entry of dec24Entries) {
    await prisma.monthlyEmployeeEntry.upsert({
      where: {
        periodId_employeeId: {
          periodId: period.id,
          employeeId: entry.employeeId,
        },
      },
      update: {},
      create: {
        periodId: period.id,
        ...entry,
      },
    });
  }
  console.log(`Created ${dec24Entries.length} entries for Dec 2024`);

  // Add approval record for the closed period
  await prisma.periodApproval.create({
    data: {
      periodId: period.id,
      userId: manager.id,
      action: "SUBMITTED",
      comment: "Ready for approval - December period complete",
    },
  });

  await prisma.periodApproval.create({
    data: {
      periodId: period.id,
      userId: bulead.id,
      action: "APPROVED",
      comment: "Approved - all figures verified",
    },
  });

  await prisma.periodApproval.create({
    data: {
      periodId: period.id,
      userId: bulead.id,
      action: "CLOSED",
      comment: "Period closed and payroll processed",
    },
  });

  // Create a draft period for January 2025
  const jan25 = await prisma.monthlyPeriod.upsert({
    where: { month_year: { month: 1, year: 2025 } },
    update: {},
    create: {
      month: 1,
      year: 2025,
      seasonId: season.id,
      openingBalance: 45000, // carry-over from December
      collectedServiceCharge: 0,
      distributableBalance: 45000,
      targetDistributionTotal: 0,
      approvedDistributionTotal: 0,
      closingBalance: 45000,
      status: "DRAFT",
      notes: "January 2025 - enter collected SC and employee hours",
    },
  });
  console.log(`Created draft period: Jan 2025`);

  // Audit log entry for seed
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SEED",
      entityType: "System",
      entityId: "seed",
      after: { message: "Database seeded with initial data" },
    },
  });

  console.log("\nSeed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("  Admin:    admin@cafe.com / admin123");
  console.log("  Manager:  manager@cafe.com / manager123");
  console.log("  BU Lead:  lead@cafe.com / lead123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
