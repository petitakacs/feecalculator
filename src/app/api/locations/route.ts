import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CreateLocationSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true, periods: true } } },
  });
  return NextResponse.json(locations);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "settings:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const location = await prisma.location.create({ data: parsed.data });
  return NextResponse.json(location, { status: 201 });
}
