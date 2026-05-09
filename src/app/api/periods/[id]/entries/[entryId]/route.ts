import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { id, entryId } = await params;
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

  const entry = await prisma.monthlyEmployeeEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.periodId !== id) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.monthlyEmployeeEntry.delete({ where: { id: entryId } });

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "MonthlyEmployeeEntry",
    entityId: entryId,
    periodId: id,
    before: { employeeId: entry.employeeId, positionId: entry.positionId },
  });

  return NextResponse.json({ ok: true });
}
