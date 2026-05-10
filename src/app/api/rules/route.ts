import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BusinessRuleSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "rules:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await prisma.businessRule.findMany({
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "rules:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = BusinessRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const rule = await prisma.businessRule.create({
    data: {
      ...parsed.data,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entityType: "BusinessRule",
    entityId: rule.id,
    after: {
      serviceChargePercent: Number(rule.serviceChargePercent),
      employeeContribution: Number(rule.employeeContribution),
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
