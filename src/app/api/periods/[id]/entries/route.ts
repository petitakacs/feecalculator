import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateEntrySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.monthlyEmployeeEntry.findMany({
    where: { periodId: params.id },
    include: { employee: { include: { position: true } }, position: true },
    orderBy: [{ employee: { name: "asc" } }],
  });

  return NextResponse.json(entries);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  const body = await req.json();
  const { employeeId, ...entryData } = body;

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { position: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const entry = await prisma.monthlyEmployeeEntry.upsert({
    where: { periodId_employeeId: { periodId: params.id, employeeId } },
    create: {
      periodId: params.id,
      employeeId,
      positionId: employee.positionId,
      workedHours: entryData.workedHours ?? 0,
      overtimeHours: entryData.overtimeHours ?? 0,
      netWaiterSales: entryData.netWaiterSales ?? null,
      bonus: entryData.bonus ?? 0,
      overtimePayment: entryData.overtimePayment ?? 0,
      manualCorrection: entryData.manualCorrection ?? 0,
      notes: entryData.notes ?? null,
    },
    update: {
      workedHours: entryData.workedHours ?? 0,
      overtimeHours: entryData.overtimeHours ?? 0,
      netWaiterSales: entryData.netWaiterSales ?? null,
      bonus: entryData.bonus ?? 0,
      overtimePayment: entryData.overtimePayment ?? 0,
      manualCorrection: entryData.manualCorrection ?? 0,
      notes: entryData.notes ?? null,
    },
    include: { employee: { include: { position: true } }, position: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPSERT_ENTRY",
    entityType: "MonthlyEmployeeEntry",
    entityId: entry.id,
    periodId: params.id,
    after: { employeeId, workedHours: entry.workedHours },
  });

  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({ where: { id: params.id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
  if (period.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed" }, { status: 422 });
  }

  const body = await req.json();
  const { entryId, ...updateData } = body;

  if (!entryId) {
    return NextResponse.json({ error: "entryId is required" }, { status: 400 });
  }

  const parsed = UpdateEntrySchema.safeParse(updateData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
  }

  const existing = await prisma.monthlyEmployeeEntry.findUnique({ where: { id: entryId } });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  // Check if override flag should be set
  const shouldSetOverride =
    parsed.data.finalApprovedAmount !== undefined &&
    parsed.data.finalApprovedAmount !== existing.targetServiceChargeAmount;

  const updated = await prisma.monthlyEmployeeEntry.update({
    where: { id: entryId },
    data: {
      ...parsed.data,
      overrideFlag: shouldSetOverride || parsed.data.overrideFlag || existing.overrideFlag,
    },
    include: { employee: { include: { position: true } }, position: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE_ENTRY",
    entityType: "MonthlyEmployeeEntry",
    entityId: entryId,
    periodId: params.id,
    before: { workedHours: existing.workedHours, bonus: existing.bonus },
    after: { workedHours: updated.workedHours, bonus: updated.bonus },
  });

  return NextResponse.json(updated);
}
