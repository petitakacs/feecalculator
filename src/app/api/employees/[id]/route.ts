import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateEmployeeSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { position: true },
  });

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.employee.findUnique({ where: { id: params.id } });
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
    where: { id: params.id },
    data: updateData,
    include: { position: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "Employee",
    entityId: params.id,
    before: { name: existing.name },
    after: { name: updated.name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.employee.update({
    where: { id: params.id },
    data: { active: false },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "Employee",
    entityId: params.id,
    before: { name: existing.name, active: existing.active },
    after: { active: false },
  });

  return NextResponse.json({ success: true });
}
