import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CreateSeasonSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seasons = await prisma.season.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json(seasons);
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "seasons:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateSeasonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const season = await prisma.season.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CREATE",
    entityType: "Season",
    entityId: season.id,
    after: { name: season.name },
  });

  return NextResponse.json(season, { status: 201 });
}
