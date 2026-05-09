import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AssignExtraTaskSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await prisma.monthlyExtraTask.findMany({
    where: { periodId: id },
    include: { employee: true, extraTaskType: true },
    orderBy: [{ employee: { name: "asc" } }, { extraTaskType: { name: "asc" } }],
  });
  return NextResponse.json(tasks);
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
  const parsed = AssignExtraTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const taskType = await prisma.extraTaskType.findUnique({
    where: { id: parsed.data.extraTaskTypeId },
  });
  if (!taskType) return NextResponse.json({ error: "Extra task type not found" }, { status: 404 });

  // Compute amount
  let amount: number;
  if (taskType.bonusType === "FIXED_AMOUNT") {
    amount = taskType.bonusAmount;
  } else {
    const hours = Number(parsed.data.hours ?? 0);
    amount = Math.round(taskType.bonusAmount * hours);
  }

  const task = await prisma.monthlyExtraTask.upsert({
    where: {
      periodId_employeeId_extraTaskTypeId: {
        periodId: id,
        employeeId: parsed.data.employeeId,
        extraTaskTypeId: parsed.data.extraTaskTypeId,
      },
    },
    create: {
      periodId: id,
      employeeId: parsed.data.employeeId,
      extraTaskTypeId: parsed.data.extraTaskTypeId,
      hours: parsed.data.hours ?? null,
      amount,
      notes: parsed.data.notes ?? null,
    },
    update: {
      hours: parsed.data.hours ?? null,
      amount,
      notes: parsed.data.notes ?? null,
    },
    include: { employee: true, extraTaskType: true },
  });

  return NextResponse.json(task, { status: 201 });
}
