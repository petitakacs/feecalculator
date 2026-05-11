import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AssignExtraTaskSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
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
  const session = await getAuthSession(req);
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

  const isMultiplierType =
    taskType.bonusType === "MULTIPLIER_FULL_HOURLY" ||
    taskType.bonusType === "MULTIPLIER_SERVICE_CHARGE_HOURLY";

  if (isMultiplierType && !parsed.data.hours) {
    return NextResponse.json({ error: "Az óraszám megadása kötelező ennél a típusnál" }, { status: 400 });
  }

  // Compute amount
  let amount: number;
  if (taskType.bonusType === "FIXED_AMOUNT") {
    amount = taskType.bonusAmount;
  } else if (taskType.bonusType === "HOURLY_RATE") {
    const hours = Number(parsed.data.hours ?? 0);
    amount = Math.round(taskType.bonusAmount * hours);
  } else {
    // Multiplier types: need the employee's rate from their period entry
    const multiplier = Number(taskType.rateMultiplier ?? 0);
    const hours = Number(parsed.data.hours ?? 0);
    const employeeEntry = await prisma.monthlyEmployeeEntry.findFirst({
      where: { periodId: id, employeeId: parsed.data.employeeId },
      include: { employee: true },
    });

    if (!employeeEntry) {
      return NextResponse.json({ error: "A dolgozónak nincs bejegyzése ebben az időszakban" }, { status: 422 });
    }

    if (taskType.bonusType === "MULTIPLIER_SERVICE_CHARGE_HOURLY") {
      if (employeeEntry.targetNetHourlyServiceCharge == null) {
        return NextResponse.json({ error: "A szervízdíj órabér még nem kalkulált. Futtasd le a kalkulációt először." }, { status: 422 });
      }
      amount = Math.round(multiplier * Number(employeeEntry.targetNetHourlyServiceCharge) * hours);
    } else {
      // MULTIPLIER_FULL_HOURLY: use employee base hourly rate
      const emp = employeeEntry.employee;
      if (!emp) return NextResponse.json({ error: "Dolgozó nem található" }, { status: 404 });
      const hourlyRate = emp.baseSalaryType === "HOURLY"
        ? Number(emp.baseSalaryAmount)
        : Math.round(Number(emp.baseSalaryAmount) / 160);
      amount = Math.round(multiplier * hourlyRate * hours);
    }
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
