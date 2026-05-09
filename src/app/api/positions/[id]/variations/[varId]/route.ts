import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const UpdateVariationSchema = z.object({
  name: z.string().min(1).optional(),
  multiplierDelta: z.number().optional(),
  fixedHourlySZD: z.number().int().min(0).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateVariationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const variation = await prisma.positionVariation.update({
    where: { id: varId },
    data: parsed.data,
  });

  return NextResponse.json(variation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; varId: string }> }
) {
  const { varId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "positions:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.positionVariation.delete({ where: { id: varId } });
  return NextResponse.json({ success: true });
}
