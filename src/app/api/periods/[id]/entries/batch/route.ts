import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  const body = await req.json();
  const { employeeIds } = body as { employeeIds: string[] };

  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return NextResponse.json({ error: "employeeIds array is required" }, { status: 400 });
  }

  // Get existing entries for this period
  const existingEntries = await prisma.monthlyEmployeeEntry.findMany({
    where: { periodId: id },
    select: { employeeId: true },
  });
  const existingEmployeeIds = new Set(existingEntries.map((e) => e.employeeId));

  // Get employees that don't already have entries
  const missingIds = employeeIds.filter((eid) => !existingEmployeeIds.has(eid));

  if (missingIds.length === 0) {
    return NextResponse.json({ created: 0, skipped: employeeIds.length });
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: missingIds } },
  });

  const created: string[] = [];
  for (const employee of employees) {
    const entry = await prisma.monthlyEmployeeEntry.create({
      data: {
        periodId: id,
        employeeId: employee.id,
        positionId: employee.positionId,
        workedHours: 0,
        overtimeHours: 0,
        bonus: 0,
        overtimePayment: 0,
        manualCorrection: 0,
      },
    });
    await createAuditLog({
      userId: session.user.id,
      action: "UPSERT_ENTRY",
      entityType: "MonthlyEmployeeEntry",
      entityId: entry.id,
      periodId: id,
      after: { employeeId: employee.id, source: "batch" },
    });
    created.push(entry.id);
  }

  const skipped = employeeIds.length - created.length;
  return NextResponse.json({ created: created.length, skipped });
}
