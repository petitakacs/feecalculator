import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UpdateExtraTaskTypeSchema } from "@/lib/validators";
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
  const parsed = UpdateExtraTaskTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const type = await prisma.extraTaskType.update({ where: { id }, data: parsed.data });
  return NextResponse.json(type);
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

  const assignmentCount = await prisma.monthlyExtraTask.count({
    where: { extraTaskTypeId: id },
  });
  if (assignmentCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: used in ${assignmentCount} period assignment(s)` },
      { status: 409 }
    );
  }

  await prisma.extraTaskType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
