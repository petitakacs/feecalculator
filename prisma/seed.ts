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
        name: "Kovács Anna",
        positionId: waiterPos.id,
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2100, // 2 100 Ft/óra
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
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2000, // 2 000 Ft/óra
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
        baseSalaryType: "HOURLY",
        baseSalaryAmount: 2300, // 2 300 Ft/óra
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
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 650000, // 650 000 Ft/hó
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
        baseSalaryType: "MONTHLY",
        baseSalaryAmount: 850000, // 850 000 Ft/hó
        eligibleForServiceCharge: true,
        startDate: new Date("2018-05-15"),
        active: true,
      },
    }),
  ]);
  console.log(`Created ${employees.length} employees`);

  // Create a completed monthly period for December 2024
  // Referencia óradíj kalkuláció (dec. 2024):
  // emp-1: 8 000 000 Ft eladás → gross SC = 312 000, net SC = 254 280
  // emp-2: 7 000 000 Ft eladás → gross SC = 273 000, net SC = 222 495
  // Össz waiter net SC = 476 775 Ft, össz óra = 336
  // Referencia óradíj = 476 775 / 336 ≈ 1 419 → kerekítve: 1 400 Ft/óra
  const REF = 1400;

  const period = await prisma.monthlyPeriod.upsert({
    where: { month_year: { month: 12, year: 2024 } },
    update: {},
    create: {
      month: 12,
      year: 2024,
      seasonId: season.id,
      openingBalance: 150000,       // 150 000 Ft áthozat
      collectedServiceCharge: 2200000, // 2 200 000 Ft befolyt SC
      distributableBalance: 2350000,   // 150 000 + 2 200 000
      targetDistributionTotal: 2201240,
      approvedDistributionTotal: 2201240,
      closingBalance: 148760,          // 2 350 000 - 2 201 240
      status: "CLOSED",
      lockedAt: new Date("2025-01-05"),
      lockedBy: bulead.id,
      notes: "2024. december – ünnepi időszak, magas forgalom",
    },
  });
  console.log(`Created period: Dec 2024 (CLOSED)`);

  // December 2024 bejegyzések (REF = 1 400 Ft/óra)
  const dec24Entries = [
    {
      employeeId: "emp-1",
      positionId: waiterPos.id,
      workedHours: 176,
      overtimeHours: 16,
      netWaiterSales: 8000000, // 8 000 000 Ft net eladás
      calculatedGrossServiceCharge: Math.round(8000000 * 0.039),   // 312 000
      calculatedNetServiceCharge: Math.round(Math.round(8000000 * 0.039) * 0.815), // 254 280
      targetNetHourlyServiceCharge: REF,
      targetServiceChargeAmount: 176 * REF,                        // 246 400
      bonus: 15000,       // 15 000 Ft prémium
      overtimePayment: 25200, // 16 óra * 1 575 Ft
      manualCorrection: 0,
      finalApprovedAmount: 176 * REF + 15000 + 25200,              // 286 600
      overrideFlag: false,
    },
    {
      employeeId: "emp-2",
      positionId: waiterPos.id,
      workedHours: 160,
      overtimeHours: 8,
      netWaiterSales: 7000000, // 7 000 000 Ft net eladás
      calculatedGrossServiceCharge: Math.round(7000000 * 0.039),
      calculatedNetServiceCharge: Math.round(Math.round(7000000 * 0.039) * 0.815),
      targetNetHourlyServiceCharge: REF,
      targetServiceChargeAmount: 160 * REF,                        // 224 000
      bonus: 0,
      overtimePayment: 16800, // 8 óra * 2 100 Ft
      manualCorrection: 0,
      finalApprovedAmount: 160 * REF + 16800,                      // 240 800
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
      targetNetHourlyServiceCharge: Math.round(REF * 0.9),         // 1 260
      targetServiceChargeAmount: 168 * Math.round(REF * 0.9),     // 211 680
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: 168 * Math.round(REF * 0.9),
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
      targetNetHourlyServiceCharge: Math.round(REF * 0.9),
      targetServiceChargeAmount: 152 * Math.round(REF * 0.9),     // 191 520
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 8000, // +8 000 Ft korrekció
      finalApprovedAmount: 152 * Math.round(REF * 0.9) + 8000,    // 199 520
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.15),        // 1 610
      targetServiceChargeAmount: 176 * Math.round(REF * 1.15),    // 283 360
      bonus: 0,
      overtimePayment: 18400, // 8 óra * 2 300 Ft
      manualCorrection: 0,
      finalApprovedAmount: 176 * Math.round(REF * 1.15) + 18400,  // 301 760
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.15),
      targetServiceChargeAmount: 160 * Math.round(REF * 1.15),    // 257 600
      bonus: 0,
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: 160 * Math.round(REF * 1.15),
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.3),         // 1 820
      targetServiceChargeAmount: 176 * Math.round(REF * 1.3),     // 320 320
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
      targetNetHourlyServiceCharge: Math.round(REF * 1.5),         // 2 100
      targetServiceChargeAmount: 176 * Math.round(REF * 1.5),     // 369 600
      bonus: 30000, // 30 000 Ft ünnepi prémium
      overtimePayment: 0,
      manualCorrection: 0,
      finalApprovedAmount: 380000, // fix megállapodott összeg
      overrideFlag: true,
      overrideReason: "Rögzített vezetői összeg, BU Lead jóváhagyásával",
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
      openingBalance: 148760, // decemberi záróegyenleg
      collectedServiceCharge: 0,
      distributableBalance: 148760,
      targetDistributionTotal: 0,
      approvedDistributionTotal: 0,
      closingBalance: 148760,
      status: "DRAFT",
      notes: "2025. január – add meg a befolyt SC összeget és a dolgozói órákat",
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
