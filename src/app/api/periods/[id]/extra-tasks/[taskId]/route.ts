import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { taskId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "periods:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.monthlyExtraTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
