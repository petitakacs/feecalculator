import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true, period: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          All system mutations and approval actions
        </p>
      </div>
      <AuditLogTable
        logs={logs.map((log) => ({
          id: log.id,
          periodId: log.periodId ?? undefined,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          before: log.before as Record<string, unknown> | undefined,
          after: log.after as Record<string, unknown> | undefined,
          createdAt: log.createdAt.toISOString(),
          user: {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
            role: log.user.role,
            active: log.user.active,
            createdAt: log.user.createdAt.toISOString(),
            updatedAt: log.user.updatedAt.toISOString(),
          },
        }))}
      />
    </div>
  );
}
