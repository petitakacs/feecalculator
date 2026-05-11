import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdatePeriodSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { calculateDistributableBalance } from "@/lib/calculation-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id },
    include: {
      season: true,
      entries: {
        include: { employee: true, position: true },
        orderBy: [{ employee: { name: "asc" } }],
      },
      approvals: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(period);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.monthlyPeriod.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "CLOSED") {
    return NextResponse.json({ error: "Period is closed and cannot be modified" }, { status: 422 });
  }

  const body = await req.json();
  const parsed = UpdatePeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Recompute distributable balance if relevant fields changed
  const openingBalance = parsed.data.openingBalance ?? existing.openingBalance;
  const collected = parsed.data.collectedServiceCharge ?? existing.collectedServiceCharge;
  updateData.distributableBalance = calculateDistributableBalance(openingBalance, collected);

  const updated = await prisma.monthlyPeriod.update({
    where: { id },
    data: updateData,
    include: { season: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "MonthlyPeriod",
    entityId: id,
    periodId: id,
    before: { collectedServiceCharge: existing.collectedServiceCharge },
    after: { collectedServiceCharge: updated.collectedServiceCharge },
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
  if (!hasPermission(session.user.role, "periods:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.monthlyPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (period.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Csak DRAFT státuszú periódus törölhető" },
      { status: 422 }
    );
  }

  // Delete in correct order due to relation constraints
  await prisma.auditLog.deleteMany({ where: { periodId: id } });
  await prisma.periodApproval.deleteMany({ where: { periodId: id } });
  await prisma.monthlyEmployeeEntry.deleteMany({ where: { periodId: id } });
  await prisma.monthlyPeriod.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    action: "DELETE",
    entityType: "MonthlyPeriod",
    entityId: id,
    before: { month: period.month, year: period.year, status: period.status },
  });

  return NextResponse.json({ success: true });
}
