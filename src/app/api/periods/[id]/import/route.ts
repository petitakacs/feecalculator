import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { parseImportFile, processImportRows } from "@/lib/import";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "import:data")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows: rawRows, error: parseError } = parseImportFile(buffer);
  if (parseError) {
    return NextResponse.json({ error: parseError }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: { position: true },
  });

  const employeesTyped = employees.map((e) => ({
    id: e.id,
    name: e.name,
    active: e.active,
    positionId: e.positionId,
    baseSalaryType: e.baseSalaryType,
    baseSalaryAmount: e.baseSalaryAmount,
    eligibleForServiceCharge: e.eligibleForServiceCharge,
    startDate: e.startDate.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  const { rows, errors, matchedCount, unmatchedNames } = processImportRows(
    rawRows,
    employeesTyped
  );

  // Apply matching rows
  const employeeNameMap = new Map(employees.map((e) => [e.name.toLowerCase().trim(), e]));

  for (const row of rows) {
    const employee = employeeNameMap.get(row.employeeName.toLowerCase());
    if (!employee) continue;

    await prisma.monthlyEmployeeEntry.upsert({
      where: {
        periodId_employeeId: { periodId: params.id, employeeId: employee.id },
      },
      create: {
        periodId: params.id,
        employeeId: employee.id,
        positionId: employee.positionId,
        workedHours: row.hours,
        overtimeHours: row.otHours,
        netWaiterSales: row.waiterSales ?? null,
        bonus: row.bonus,
        overtimePayment: row.otPayment,
        manualCorrection: row.correction,
        notes: row.notes ?? null,
      },
      update: {
        workedHours: row.hours,
        overtimeHours: row.otHours,
        netWaiterSales: row.waiterSales ?? null,
        bonus: row.bonus,
        overtimePayment: row.otPayment,
        manualCorrection: row.correction,
        notes: row.notes ?? null,
      },
    });
  }

  // Log the import
  await prisma.importLog.create({
    data: {
      periodId: params.id,
      fileName: file.name,
      rowCount: rawRows.length,
      errors: errors.length > 0 ? (errors as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      importedBy: session.user.id,
    },
  });

  return NextResponse.json({
    success: true,
    totalRows: rawRows.length,
    matchedCount,
    errorCount: errors.length,
    errors,
    unmatchedNames,
  });
}
