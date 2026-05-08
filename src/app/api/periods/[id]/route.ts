import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdatePeriodSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { calculateDistributableBalance } from "@/lib/calculation-engine";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await prisma.monthlyPeriod.findUnique({
    where: { id: params.id },
    include: {
      season: true,
      entries: {
        include: { employee: true, position: true },
        orderBy: [{ employee: { name: "asc" } }],
      },
      approvals: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(period);
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

  const existing = await prisma.monthlyPeriod.findUnique({ where: { id: params.id } });
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
    where: { id: params.id },
    data: updateData,
    include: { season: true },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "MonthlyPeriod",
    entityId: params.id,
    periodId: params.id,
    before: { collectedServiceCharge: existing.collectedServiceCharge },
    after: { collectedServiceCharge: updated.collectedServiceCharge },
  });

  return NextResponse.json(updated);
}
