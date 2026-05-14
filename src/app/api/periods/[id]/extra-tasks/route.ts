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

  const [taskType, fullPeriod] = await Promise.all([
    prisma.extraTaskType.findUnique({ where: { id: parsed.data.extraTaskTypeId } }),
    prisma.monthlyPeriod.findUnique({ where: { id }, select: { seasonId: true } }),
  ]);
  if (!taskType) return NextResponse.json({ error: "Extra task type not found" }, { status: 404 });

  // Check for seasonal rate override for this extra task type
  const seasonRate = fullPeriod?.seasonId
    ? await prisma.seasonExtraTaskRate.findUnique({
        where: { seasonId_extraTaskTypeId: { seasonId: fullPeriod.seasonId, extraTaskTypeId: taskType.id } },
      })
    : null;

  // Also check date-based rate history for this task type
  const periodDate = new Date(period.year, period.month - 1, 1);
  const rateHistory = await prisma.extraTaskRateHistory.findFirst({
    where: {
      extraTaskTypeId: taskType.id,
      effectiveFrom: { lte: periodDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  // Resolve effective rates: season override > date-based history > static fields
  const effectiveBonusType = seasonRate?.bonusAmount != null || seasonRate?.rateMultiplier != null
    ? taskType.bonusType  // season rate uses same type but different amount
    : rateHistory?.bonusType ?? taskType.bonusType;
  const effectiveBonusAmount = seasonRate?.bonusAmount ?? rateHistory?.bonusAmount ?? taskType.bonusAmount;
  const effectiveRateMultiplier = seasonRate?.rateMultiplier != null
    ? Number(seasonRate.rateMultiplier)
    : rateHistory?.rateMultiplier != null
    ? Number(rateHistory.rateMultiplier)
    : taskType.rateMultiplier != null ? Number(taskType.rateMultiplier) : 0;

  const isMultiplierType =
    effectiveBonusType === "MULTIPLIER_FULL_HOURLY" ||
    effectiveBonusType === "MULTIPLIER_SERVICE_CHARGE_HOURLY";

  if (isMultiplierType && !parsed.data.hours) {
    return NextResponse.json({ error: "Az óraszám megadása kötelező ennél a típusnál" }, { status: 400 });
  }

  // Compute amount
  let amount: number;
  if (effectiveBonusType === "FIXED_AMOUNT") {
    amount = effectiveBonusAmount;
  } else if (effectiveBonusType === "HOURLY_RATE") {
    const hours = Number(parsed.data.hours ?? 0);
    amount = Math.round(effectiveBonusAmount * hours);
  } else {
    // Multiplier types: need the employee's rate from their period entry
    const multiplier = effectiveRateMultiplier;
    const hours = Number(parsed.data.hours ?? 0);
    const employeeEntry = await prisma.monthlyEmployeeEntry.findFirst({
      where: { periodId: id, employeeId: parsed.data.employeeId },
      include: { employee: true },
    });

    if (!employeeEntry) {
      return NextResponse.json({ error: "A dolgozónak nincs bejegyzése ebben az időszakban" }, { status: 422 });
    }

    if (effectiveBonusType === "MULTIPLIER_SERVICE_CHARGE_HOURLY") {
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
