import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const UpdateUserSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "BUSINESS_UNIT_LEAD", "STORE_MANAGER", "FINANCE_VIEWER", "PAYROLL_EXPORT_USER"]).optional(),
  name: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-deactivation
  if (id === session.user.id) {
    const body = await req.json();
    if (body.active === false) {
      return NextResponse.json({ error: "Saját magadat nem lehet inaktiválni" }, { status: 422 });
    }
  }

  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Érvénytelen adat" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(user);
}
