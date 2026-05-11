import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdateLocationSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const location = await prisma.location.update({ where: { id }, data: parsed.data });
  return NextResponse.json(location);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employeeCount = await prisma.employee.count({ where: { locationId: id } });
  if (employeeCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${employeeCount} employee(s) assigned to this location` },
      { status: 409 }
    );
  }

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
