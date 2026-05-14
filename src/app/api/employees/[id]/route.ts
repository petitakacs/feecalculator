import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdateEmployeeSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { position: true },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { startDate, endDate, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

  const updated = await prisma.employee.update({
    where: { id },
    data: updateData,
    include: { position: true },
  });

  // When the salary changes, record a new history entry effective today
  const salaryChanged =
    (parsed.data.baseSalaryAmount !== undefined && parsed.data.baseSalaryAmount !== existing.baseSalaryAmount) ||
    (parsed.data.baseSalaryType !== undefined && parsed.data.baseSalaryType !== existing.baseSalaryType);
  if (salaryChanged) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.employeeSalaryHistory.updateMany({
      where: { employeeId: id, effectiveTo: null, effectiveFrom: { lt: today } },
      data: { effectiveTo: new Date(today.getTime() - 86400000) },
    });
    await prisma.employeeSalaryHistory.create({
      data: {
        employeeId: id,
        baseSalaryType: parsed.data.baseSalaryType ?? existing.baseSalaryType,
        baseSalaryAmount: parsed.data.baseSalaryAmount ?? existing.baseSalaryAmount,
        effectiveFrom: today,
        note: "Alapbér módosítva az admin felületen",
      },
    });
  }

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "Employee",
    entityId: id,
    before: { name: existing.name },
    after: { name: updated.name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.employee.update({
    where: { id },
    data: { active: false },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "Employee",
    entityId: id,
    before: { name: existing.name, active: existing.active },
    after: { active: false },
  });

  return NextResponse.json({ success: true });
}
