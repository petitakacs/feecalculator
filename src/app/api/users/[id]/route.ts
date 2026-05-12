import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z
    .enum([
      "ADMIN",
      "BUSINESS_UNIT_LEAD",
      "STORE_MANAGER",
      "FINANCE_VIEWER",
      "PAYROLL_EXPORT_USER",
    ])
    .optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const result = updateUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  // Prevent self-deactivation
  if (id === session.user.id && result.data.active === false) {
    return NextResponse.json(
      { error: "Saját magadat nem lehet inaktiválni" },
      { status: 422 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Felhasználó nem található" }, { status: 404 });
  }

  // Prevent demoting the last admin
  if (result.data.role && target.role === "ADMIN" && result.data.role !== "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", active: true },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Az utolsó admin nem léptethető vissza" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = { ...result.data };
  if (result.data.password) {
    updateData.passwordHash = await hash(result.data.password, 12);
    delete updateData.password;
  }

  if (result.data.email && result.data.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Ez az e-mail cím már foglalt" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Saját magadat nem lehet inaktiválni" },
      { status: 422 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Felhasználó nem található" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Az utolsó admin nem inaktiválható" },
        { status: 400 }
      );
    }
  }

  await prisma.user.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
