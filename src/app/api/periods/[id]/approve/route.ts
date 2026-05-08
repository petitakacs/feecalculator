import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalActionSchema } from "@/lib/validators";
import { canTransitionStatus } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { PeriodStatus } from "@/types";

const actionToStatus: Record<string, PeriodStatus> = {
  SUBMITTED: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "DRAFT",
  REOPENED: "DRAFT",
  CLOSED: "CLOSED",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = await prisma.monthlyPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

  const body = await req.json();
  const parsed = ApprovalActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const newStatus = actionToStatus[parsed.data.action];
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const currentStatus = period.status as PeriodStatus;

  if (!canTransitionStatus(session.user.role, currentStatus, newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${currentStatus} to ${newStatus} with role ${session.user.role}` },
      { status: 403 }
    );
  }

  // If approving, compute approved distribution from entries
  let approvedDistributionTotal = period.approvedDistributionTotal;
  if (parsed.data.action === "APPROVED") {
    const entries = await prisma.monthlyEmployeeEntry.findMany({
      where: { periodId: id },
    });
    approvedDistributionTotal = entries.reduce((sum, e) => {
      const amount =
        e.finalApprovedAmount ??
        (e.targetServiceChargeAmount ?? 0) +
          e.bonus +
          e.overtimePayment +
          e.manualCorrection;
      return sum + amount;
    }, 0);
  }

  const closingBalance =
    period.openingBalance + period.collectedServiceCharge - approvedDistributionTotal;

  await prisma.monthlyPeriod.update({
    where: { id: id },
    data: {
      status: newStatus,
      approvedDistributionTotal:
        parsed.data.action === "APPROVED" ? approvedDistributionTotal : undefined,
      closingBalance:
        parsed.data.action === "APPROVED" ? closingBalance : undefined,
      lockedAt:
        newStatus === "CLOSED" ? new Date() : undefined,
      lockedBy:
        newStatus === "CLOSED" ? session.user.id : undefined,
    },
  });

  await prisma.periodApproval.create({
    data: {
      periodId: id,
      userId: session.user.id,
      action: parsed.data.action,
      comment: parsed.data.comment,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: parsed.data.action,
    entityType: "MonthlyPeriod",
    entityId: id,
    periodId: id,
    before: { status: currentStatus },
    after: { status: newStatus },
  });

  return NextResponse.json({ success: true, newStatus });
}
