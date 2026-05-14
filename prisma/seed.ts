import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: Seed must not run in production. Aborting.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database (development/test only)...");

  // Passwords come from env vars to avoid hardcoded credentials in version control.
  // Defaults are intentionally weak and only suitable for local development.
  const adminPassword = await hash(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin1", 12);
  const managerPassword = await hash(process.env.SEED_MANAGER_PASSWORD ?? "ChangeMe!Manager1", 12);

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
      passwordHash: await hash(process.env.SEED_LEAD_PASSWORD ?? "ChangeMe!Lead1", 12),
      role: "BUSINESS_UNIT_LEAD",
    },
  });

  console.log(`Created users: ${admin.email}, ${manager.email}, ${bulead.email}`);

  // Create locations
  const [loc1, loc2, loc3] = await Promise.all([
    prisma.location.upsert({
      where: { name: "Főétterem" },
      update: {},
      create: { name: "Főétterem", address: "Budapest, Fő u. 1.", active: true },
    }),
    prisma.location.upsert({
      where: { name: "Terasz" },
      update: {},
      create: { name: "Terasz", address: "Budapest, Fő u. 1. – kert", active: true },
    }),
    prisma.location.upsert({
      where: { name: "Bár" },
      update: {},
      create: { name: "Bár", address: "Budapest, Fő u. 1. – bár", active: true },
    }),
  ]);
  console.log(`Created 3 locations`);

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

  // Create extra task types
  await Promise.all([
    prisma.extraTaskType.upsert({
      where: { name: "HR feladatok" },
      update: {},
      create: { name: "HR feladatok", bonusType: "FIXED_AMOUNT", bonusAmount: 20000, active: true },
    }),
    prisma.extraTaskType.upsert({
      where: { name: "Betanítás" },
      update: {},
      create: { name: "Betanítás", bonusType: "HOURLY_RATE", bonusAmount: 1500, active: true },
    }),
    prisma.extraTaskType.upsert({
      where: { name: "Leltározás" },
      update: {},
      create: { name: "Leltározás", bonusType: "HOURLY_RATE", bonusAmount: 1200, active: true },
    }),
  ]);
  console.log(`Created 3 extra task types`);

  // Create employees (assigned to locations)
  const employees = await Promise.all([
    prisma.employee.upsert({
      where: { id: "emp-1" },
      update: {},
      create: {
        id: "emp-1",
        name: "Kovács Anna",
        positionId: waiterPos.id,
        locationId: loc1.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2100,
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
        name: "Nagy Péter",
        positionId: waiterPos.id,
        locationId: loc1.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2100,
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
        name: "Tóth Eszter",
        positionId: baristaPos.id,
        locationId: loc2.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2000,
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
        name: "Szabó Dávid",
        positionId: baristaPos.id,
        locationId: loc2.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2000,
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
        name: "Horváth Réka",
        positionId: shiftLeadPos.id,
        locationId: loc1.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2300,
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
        name: "Varga Bálint",
        positionId: shiftLeadPos.id,
        locationId: loc3.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2300,
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
        name: "Molnár Katalin",
        positionId: asmPos.id,
        locationId: loc1.id,
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 650000,
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
        name: "Kiss Gábor",
        positionId: managerPos.id,
        locationId: loc1.id,
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 850000,
        eligibleForServiceCharge: true,
        startDate: new Date("2018-05-15"),
        active: true,
      },
    }),
  ]);
  console.log(`Created ${employees.length} employees`);

  // Seed initial PositionRateHistory from current position values
  // effectiveFrom = 2024-01-01, matching the business rule start date
  const rateHistoryStart = new Date("2024-01-01");
  await Promise.all(
    positions.map((pos) =>
      prisma.positionRateHistory.upsert({
        where: { id: `prh-${pos.id}` },
        update: {},
        create: {
          id: `prh-${pos.id}`,
          positionId: pos.id,
          multiplier: pos.multiplier,
          fixedHourlySZD: pos.fixedHourlySZD ?? null,
          effectiveFrom: rateHistoryStart,
          note: "Kiinduló szorzó (seed)",
        },
      })
    )
  );
  console.log(`Seeded PositionRateHistory for ${positions.length} positions`);

  // Seed initial EmployeeSalaryHistory from current employee values
  await Promise.all(
    employees.map((emp) =>
      prisma.employeeSalaryHistory.upsert({
        where: { id: `esh-${emp.id}` },
        update: {},
        create: {
          id: `esh-${emp.id}`,
          employeeId: emp.id,
          baseSalaryType: emp.baseSalaryType,
          baseSalaryAmount: emp.baseSalaryAmount,
          effectiveFrom: emp.startDate,
          note: "Kiinduló alapbér (seed)",
        },
      })
    )
  );
  console.log(`Seeded EmployeeSalaryHistory for ${employees.length} employees`);

  // Create a completed monthly period for December 2024 (Főétterem)
  const REF = 1400;

  const period = await prisma.monthlyPeriod.upsert({
    where: { month_year_locationId: { month: 12, year: 2024, locationId: loc1.id } },
    update: {},
    create: {
      month: 12,
      year: 2024,
      seasonId: season.id,
      locationId: loc1.id,
      openingBalance: 150000,
      collectedServiceCharge: 2200000,
      distributableBalance: 2350000,
      targetDistributionTotal: 2201240,
      approvedDistributionTotal: 2201240,
      closingBalance: 148760,
      status: "CLOSED",
      lockedAt: new Date("2025-01-05"),
      lockedBy: bulead.id,
      notes: "2024. december – ünnepi időszak, magas forgalom",
    },
  });
  console.log(`Created period: Dec 2024 (CLOSED) – Főétterem`);

  // December 2024 entries
  const dec24Entries = [
    {
      employeeId: "emp-1",
      positionId: waiterPos.id,
      workedHours: 176,
      overtimeHours: 16,
      netWaiterSales: 8000000,
      calculatedGrossServiceCharge: Math.round(8000000 * 0.039),
      calculatedNetServiceCharge: Math.round(Math.round(8000000 * 0.039) * 0.815),
      targetNetHourlyServiceCharge: REF,
      targetServiceChargeAmount: 176 * REF,
      bonus: 15000,
      overtimePayment: 25200,
      manualCorrection: 0,
      finalApprovedAmount: 176 * REF + 15000 + 25200,
      overrideFlag: false,
    },
    {
      employeeId: "emp-2",
      positionId: waiterPos.id,
      workedHours: 160,
      overtimeHours: 8,
      netWaiterSales: 7000000,
      calculatedGrossServiceCharge: Math.round(7000000 * 0.039),
      calculatedNetServiceCharge: Math.round(Math.round(7000000 * 0.039) * 0.815),
      targetNetHourlyServiceCharge: REF,
      targetServiceChargeAmount: 160 * REF,
      bonus: 0,
      overtimePayment: 16800,
      manualCorrection: 0,
      finalApprovedAmount: 160 * REF + 16800,
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.15),
      targetServiceChargeAmount: 176 * Math.round(REF * 1.15),
      bonus: 0,
      overtimePayment: 18400,
      manualCorrection: 0,
      finalApprovedAmount: 176 * Math.round(REF * 1.15) + 18400,
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.3),
      targetServiceChargeAmount: 176 * Math.round(REF * 1.3),
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: 176 * Math.round(REF * 1.3),
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.5),
      targetServiceChargeAmount: 176 * Math.round(REF * 1.5),
      bonus: 30000,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: 380000,
      overrideFlag: true,
      overrideReason: "Rögzített vezetői összeg, BU Lead jóváhagyásával",
    },
  ];

  for (const entry of dec24Entries) {
    await prisma.monthlyEmployeeEntry.upsert({
      where: {
        periodId_employeeId_positionId: {
          periodId: period.id,
          employeeId: entry.employeeId,
          positionId: entry.positionId,
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

  // Add approval records for the closed period
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

  // Create a draft period for January 2025 (Főétterem)
  await prisma.monthlyPeriod.upsert({
    where: { month_year_locationId: { month: 1, year: 2025, locationId: loc1.id } },
    update: {},
    create: {
      month: 1,
      year: 2025,
      seasonId: season.id,
      locationId: loc1.id,
      openingBalance: 148760,
      collectedServiceCharge: 0,
      distributableBalance: 148760,
      targetDistributionTotal: 0,
      approvedDistributionTotal: 0,
      closingBalance: 148760,
      status: "DRAFT",
      notes: "2025. január – add meg a befolyt SC összeget és a dolgozói órákat",
    },
  });
  console.log(`Created draft period: Jan 2025 – Főétterem`);

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
  console.log("Users created: admin@cafe.com, manager@cafe.com, lead@cafe.com");
  console.log("Use SEED_ADMIN_PASSWORD / SEED_MANAGER_PASSWORD / SEED_LEAD_PASSWORD env vars to set passwords.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
