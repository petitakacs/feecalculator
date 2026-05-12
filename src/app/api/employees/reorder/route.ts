import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const ReorderSchema = z.object({
  ids: z.array(z.string().max(36)).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role, "employees:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await Promise.all(
    parsed.data.ids.map((id, index) =>
      prisma.employee.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ success: true });
}
