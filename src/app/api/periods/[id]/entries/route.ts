import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateEntrySchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.monthlyEmployeeEntry.findMany({
    where: { periodId: id },
    include: { employee: { include: { position: true, location: true, variation: true } }, position: true, workingLocation: true },
    orderBy: [{ employee: { name: "asc" } }, { position: { name: "asc" } }],
  });

  return NextResponse.json(entries);
}

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
  const { employeeId, positionId: explicitPositionId, entryLabel, workingLocationId, isLoanEntry, ...entryData } = body;

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { position: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Use explicitly provided positionId (for multi-role entries) or default to employee's primary position
  const positionId = explicitPositionId ?? employee.positionId;

  const entry = await prisma.monthlyEmployeeEntry.upsert({
    where: {
      periodId_employeeId_positionId: { periodId: id, employeeId, positionId },
    },
    create: {
      periodId: id,
      employeeId,
      positionId,
      entryLabel: entryLabel ?? null,
      workingLocationId: workingLocationId ?? null,
      isLoanEntry: isLoanEntry ?? false,
      workedHours: entryData.workedHours ?? 0,
      overtimeHours: entryData.overtimeHours ?? 0,
      netWaiterSales: entryData.netWaiterSales ?? null,
      bonus: entryData.bonus ?? 0,
      overtimePayment: entryData.overtimePayment ?? 0,
      manualCorrection: entryData.manualCorrection ?? 0,
      notes: entryData.notes ?? null,
    },
    update: {
      entryLabel: entryLabel ?? null,
      workingLocationId: workingLocationId ?? null,
      isLoanEntry: isLoanEntry ?? false,
      workedHours: entryData.workedHours ?? 0,
      overtimeHours: entryData.overtimeHours ?? 0,
      netWaiterSales: entryData.netWaiterSales ?? null,
      bonus: entryData.bonus ?? 0,
      overtimePayment: entryData.overtimePayment ?? 0,
      manualCorrection: entryData.manualCorrection ?? 0,
      notes: entryData.notes ?? null,
    },
    include: { employee: { include: { position: true } }, position: true, workingLocation: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPSERT_ENTRY",
    entityType: "MonthlyEmployeeEntry",
    entityId: entry.id,
    periodId: id,
    after: { employeeId, workedHours: entry.workedHours },
  });

  return NextResponse.json(entry);
}

export async function PATCH(
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
  const { entryId, ...updateData } = body;

  if (!entryId) {
    return NextResponse.json({ error: "entryId is required" }, { status: 400 });
  }

  const parsed = UpdateEntrySchema.safeParse(updateData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.monthlyEmployeeEntry.findUnique({ where: { id: entryId } });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (existing.periodId !== id) {
    return NextResponse.json({ error: "Entry does not belong to this period" }, { status: 403 });
  }

  // Set override when a non-null approved amount differs from the computed target,
  // or when targetNetHourlyServiceCharge is manually provided (client already sends overrideFlag:true).
  const shouldSetOverride =
    parsed.data.finalApprovedAmount != null &&
    parsed.data.finalApprovedAmount !== existing.targetServiceChargeAmount;

  const updated = await prisma.monthlyEmployeeEntry.update({
    where: { id: entryId },
    data: {
      ...parsed.data,
      overrideFlag: shouldSetOverride || parsed.data.overrideFlag || existing.overrideFlag,
    },
    include: { employee: { include: { position: true, location: true, variation: true } }, position: true, workingLocation: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE_ENTRY",
    entityType: "MonthlyEmployeeEntry",
    entityId: entryId,
    periodId: id,
    before: { workedHours: existing.workedHours, bonus: existing.bonus },
    after: { workedHours: updated.workedHours, bonus: updated.bonus },
  });

  return NextResponse.json(updated);
}
