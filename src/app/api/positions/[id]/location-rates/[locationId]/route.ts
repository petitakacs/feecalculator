import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  const { id, locationId } = await params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.positionLocationRate.delete({
    where: { positionId_locationId: { positionId: id, locationId } },
  });

  return NextResponse.json({ success: true });
}
