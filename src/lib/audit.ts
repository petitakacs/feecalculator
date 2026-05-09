import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  periodId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      periodId: params.periodId,
      before: params.before as Prisma.InputJsonValue | undefined,
      after: params.after as Prisma.InputJsonValue | undefined,
    },
  });
}
