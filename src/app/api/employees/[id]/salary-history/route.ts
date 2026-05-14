import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const CreateSalaryHistorySchema = z.object({
  baseSalaryType: z.enum(["HOURLY", "MONTHLY"]),
  baseSalaryAmount: z.number().int().min(0),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await prisma.employeeSalaryHistory.findMany({
    where: { employeeId: id },
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json(history);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return NextResponse.json({ error: "Dolgozó nem található" }, { status: 404 });

  const body = await req.json();
  const parsed = CreateSalaryHistorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);

  // Close out any currently-open salary record
  await prisma.employeeSalaryHistory.updateMany({
    where: {
      employeeId: id,
      effectiveTo: null,
      effectiveFrom: { lt: effectiveFrom },
    },
    data: { effectiveTo: new Date(effectiveFrom.getTime() - 86400000) },
  });

  const record = await prisma.employeeSalaryHistory.create({
    data: {
      employeeId: id,
      baseSalaryType: parsed.data.baseSalaryType,
      baseSalaryAmount: parsed.data.baseSalaryAmount,
      effectiveFrom,
      note: parsed.data.note,
    },
  });

  // Keep the employee record in sync
  await prisma.employee.update({
    where: { id },
    data: {
      baseSalaryType: parsed.data.baseSalaryType,
      baseSalaryAmount: parsed.data.baseSalaryAmount,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
